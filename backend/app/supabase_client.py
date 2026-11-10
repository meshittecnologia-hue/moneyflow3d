"""Acesso ao Supabase com a secret key, apenas do lado do servidor."""
import httpx

from .config import Settings


class SupabaseError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def _message(resp: httpx.Response) -> str:
    try:
        data = resp.json()
    except ValueError:
        return resp.text or f"HTTP {resp.status_code}"
    if isinstance(data, dict):
        for key in ("msg", "message", "error_description", "error"):
            val = data.get(key)
            if isinstance(val, str) and val:
                return val
    return str(data)


class SupabaseAdmin:
    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self.url = settings.supabase_url
        self.key = settings.supabase_secret_key
        self.http = client

    def _headers(self) -> dict:
        # Secret keys novas vão só no header apikey.
        return {"apikey": self.key, "Content-Type": "application/json"}

    async def _check(self, resp: httpx.Response) -> httpx.Response:
        if resp.status_code >= 400:
            raise SupabaseError(resp.status_code, _message(resp))
        return resp

    # ---------- Autenticação de quem chama ----------
    async def get_user_from_token(self, access_token: str) -> dict | None:
        """Valida o token de sessão do usuário junto ao Supabase Auth."""
        resp = await self.http.get(
            f"{self.url}/auth/v1/user",
            headers={"apikey": self.key, "Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code != 200:
            return None
        return resp.json()

    # ---------- Perfis ----------
    async def get_profile(self, user_id: str) -> dict | None:
        resp = await self.http.get(
            f"{self.url}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "*"},
            headers=self._headers(),
        )
        await self._check(resp)
        rows = resp.json()
        return rows[0] if rows else None

    async def update_profile(self, user_id: str, fields: dict) -> None:
        resp = await self.http.patch(
            f"{self.url}/rest/v1/profiles",
            params={"id": f"eq.{user_id}"},
            json=fields,
            headers={**self._headers(), "Prefer": "return=minimal"},
        )
        await self._check(resp)

    async def delete_profile(self, user_id: str) -> None:
        resp = await self.http.delete(
            f"{self.url}/rest/v1/profiles",
            params={"id": f"eq.{user_id}"},
            headers=self._headers(),
        )
        await self._check(resp)

    async def insert_admin_log(self, row: dict) -> None:
        resp = await self.http.post(
            f"{self.url}/rest/v1/admin_logs",
            json=row,
            headers={**self._headers(), "Prefer": "return=minimal"},
        )
        await self._check(resp)

    async def insert_registro_acesso(self, row: dict) -> None:
        resp = await self.http.post(
            f"{self.url}/rest/v1/registros_acesso",
            json=row,
            headers={**self._headers(), "Prefer": "return=minimal"},
        )
        await self._check(resp)

    # ---------- Usuários (Auth Admin API) ----------
    async def create_user(self, email: str, password: str, name: str) -> dict:
        resp = await self.http.post(
            f"{self.url}/auth/v1/admin/users",
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": name},
            },
            headers=self._headers(),
        )
        await self._check(resp)
        return resp.json()

    async def find_user_by_email(self, email: str) -> dict | None:
        """Procura o usuário pelo e-mail EXATO, página por página.

        Corrige o problema 5 da auditoria: a API de admin ignora o filtro
        ?email= e devolve a lista completa; pegar o item [0] alterava o
        usuário errado.
        """
        target = email.strip().lower()
        page = 1
        while True:
            resp = await self.http.get(
                f"{self.url}/auth/v1/admin/users",
                params={"page": page, "per_page": 200},
                headers=self._headers(),
            )
            await self._check(resp)
            users = resp.json().get("users", [])
            for u in users:
                if (u.get("email") or "").strip().lower() == target:
                    return u
            if len(users) < 200:
                return None
            page += 1

    async def delete_user(self, user_id: str) -> None:
        resp = await self.http.delete(
            f"{self.url}/auth/v1/admin/users/{user_id}", headers=self._headers()
        )
        await self._check(resp)

    async def generate_recovery_link(self, email: str, redirect_to: str) -> str:
        resp = await self.http.post(
            f"{self.url}/auth/v1/admin/generate_link",
            json={"type": "recovery", "email": email, "redirect_to": redirect_to},
            headers=self._headers(),
        )
        await self._check(resp)
        data = resp.json()
        link = data.get("action_link") or (data.get("properties") or {}).get(
            "action_link"
        )
        if not link:
            raise SupabaseError(502, "Supabase não retornou o link de acesso")
        return link
