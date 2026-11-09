"""API do MoneyFlow 3D (FastAPI).

Regra central: o navegador nunca recebe chave secreta. Ele manda só o token
de sessão do usuário logado; aqui conferimos quem é e se é admin antes de
usar a secret key do Supabase.
"""
import secrets
import string
from contextlib import asynccontextmanager
from typing import Literal

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from .config import Settings, get_settings
from .emails import EmailError, send_template
from .rate_limit import RateLimiter
from .supabase_client import SupabaseAdmin, SupabaseError

PLANOS = {"free", "pro", "interno"}
ROLES = {"user", "admin"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(timeout=15.0)
    yield
    await app.state.http.aclose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="MoneyFlow 3D API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    # Recuperação de senha: 3 pedidos por e-mail a cada 15 min e 10 por IP a cada hora.
    app.state.recover_email_limit = RateLimiter(3, 15 * 60)
    app.state.recover_ip_limit = RateLimiter(10, 60 * 60)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    register_routes(app)
    return app


# ---------- Dependências ----------
def get_sb(request: Request) -> SupabaseAdmin:
    return SupabaseAdmin(request.app.state.settings, request.app.state.http)


async def require_admin(
    authorization: str = Header(default=""),
    sb: SupabaseAdmin = Depends(get_sb),
) -> dict:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Login obrigatório")
    token = authorization[7:].strip()
    user = await sb.get_user_from_token(token)
    if not user or not user.get("id"):
        raise HTTPException(401, "Sessão inválida ou expirada")
    profile = await sb.get_profile(user["id"])
    if not profile or profile.get("role") != "admin":
        raise HTTPException(403, "Acesso restrito a administradores")
    return profile


# ---------- Modelos ----------
class CreateUserIn(BaseModel):
    email: EmailStr
    name: str = Field(default="", max_length=120)
    plan: str = "free"
    role: str = "user"
    mode: Literal["invite", "password"] = "invite"
    password: str | None = Field(default=None, min_length=8, max_length=128)
    modules: list[str] = []


class RecoverIn(BaseModel):
    email: EmailStr


class AccessEmailIn(BaseModel):
    email: EmailStr
    name: str = Field(default="", max_length=120)


def _temp_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Tmp_" + "".join(secrets.choice(alphabet) for _ in range(16)) + "!1a"


def _sb_error(e: SupabaseError) -> HTTPException:
    status = e.status if 400 <= e.status < 500 else 502
    return HTTPException(status, e.message)


def register_routes(app: FastAPI) -> None:
    @app.get("/health")
    async def health():
        return {"ok": True}

    @app.post("/auth/recover")
    async def recover(body: RecoverIn, request: Request, sb: SupabaseAdmin = Depends(get_sb)):
        """Envia o link de nova senha. Resposta sempre igual: não revela se o e-mail existe."""
        settings: Settings = app.state.settings
        email = body.email.lower()
        ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
            request.client.host if request.client else "?"
        )
        if not app.state.recover_ip_limit.allow(ip) or not app.state.recover_email_limit.allow(email):
            raise HTTPException(429, "Muitas tentativas. Aguarde alguns minutos e tente de novo.")
        try:
            link = await sb.generate_recovery_link(email, settings.app_url)
        except SupabaseError as e:
            if e.status in (400, 404, 422):
                return {"ok": True}  # e-mail inexistente: mesma resposta, nada enviado
            # Chave errada, Supabase fora do ar etc.: erro visível, nunca silencioso.
            raise HTTPException(502, "Não foi possível gerar o link agora. Tente de novo em instantes.") from e
        try:
            await send_template(
                settings, app.state.http, "recover", email, email.split("@")[0], link
            )
        except EmailError as e:
            # Falha real de envio aparece para quem pediu (erro silencioso é proibido).
            raise HTTPException(502, "Não foi possível enviar o e-mail agora. Tente de novo em instantes.") from e
        return {"ok": True}

    @app.post("/admin/users")
    async def create_user(
        body: CreateUserIn,
        admin: dict = Depends(require_admin),
        sb: SupabaseAdmin = Depends(get_sb),
    ):
        settings: Settings = app.state.settings
        if body.plan not in PLANOS:
            raise HTTPException(422, f"Plano inválido: {body.plan}")
        if body.role not in ROLES:
            raise HTTPException(422, f"Tipo de acesso inválido: {body.role}")
        if body.mode == "password" and not body.password:
            raise HTTPException(422, "Senha obrigatória no modo senha direta")

        email = body.email.lower()
        password = body.password if body.mode == "password" else _temp_password()
        existed = False
        try:
            try:
                user = await sb.create_user(email, password, body.name)
            except SupabaseError as e:
                if e.status != 422 and "already" not in e.message.lower():
                    raise
                user = await sb.find_user_by_email(email)
                if not user:
                    raise HTTPException(
                        409, "Usuário já existe mas não foi localizado pelo e-mail"
                    )
                existed = True

            user_id = user["id"]
            await sb.update_profile(
                user_id, {"name": body.name, "plan": body.plan, "role": body.role}
            )

            email_sent = False
            email_error = None
            if body.mode == "invite":
                link = await sb.generate_recovery_link(email, settings.app_url)
                try:
                    await send_template(
                        settings, app.state.http, "invite", email,
                        body.name or email.split("@")[0], link,
                    )
                    email_sent = True
                except EmailError as e:
                    email_error = str(e)

            await sb.insert_admin_log(
                {
                    "admin_id": admin["id"],
                    "action": "invite_user" if body.mode == "invite" else "create_user",
                    "target_user": user_id,
                    "details": {
                        "plan": body.plan, "role": body.role,
                        "modules": body.modules, "existed": existed,
                        "email_sent": email_sent,
                    },
                }
            )
        except SupabaseError as e:
            raise _sb_error(e)

        return {
            "user_id": user_id,
            "existed": existed,
            "email_sent": email_sent,
            "email_error": email_error,
        }

    @app.delete("/admin/users/{user_id}")
    async def delete_user(
        user_id: str,
        admin: dict = Depends(require_admin),
        sb: SupabaseAdmin = Depends(get_sb),
    ):
        if user_id == admin["id"]:
            raise HTTPException(400, "Você não pode excluir a própria conta")
        try:
            alvo = await sb.get_profile(user_id) or {}
            # O registro vem ANTES da exclusão: admin_logs.target_user aponta para profiles
            # (ON DELETE SET NULL). Gravar depois falhava e mostrava erro com a exclusão feita.
            await sb.insert_admin_log(
                {"admin_id": admin["id"], "action": "delete_user", "target_user": user_id,
                 "details": {"email": alvo.get("email"), "name": alvo.get("name")}}
            )
            await sb.delete_user(user_id)
            await sb.delete_profile(user_id)
        except SupabaseError as e:
            raise _sb_error(e)
        return {"deleted": True}

    @app.post("/admin/users/access-email")
    async def access_email(
        body: AccessEmailIn,
        admin: dict = Depends(require_admin),
        sb: SupabaseAdmin = Depends(get_sb),
    ):
        settings: Settings = app.state.settings
        email = body.email.lower()
        try:
            link = await sb.generate_recovery_link(email, settings.app_url)
        except SupabaseError as e:
            raise _sb_error(e)
        try:
            await send_template(
                settings, app.state.http, "access", email,
                body.name or email.split("@")[0], link,
            )
        except EmailError as e:
            raise HTTPException(502, str(e))
        try:
            await sb.insert_admin_log(
                {"admin_id": admin["id"], "action": "send_password_email", "details": {"email": email}}
            )
        except SupabaseError:
            pass  # o e-mail já saiu; falha de log não deve virar erro para o admin
        return {"email_sent": True}


app = None
try:
    app = create_app()
except RuntimeError:
    # Sem variáveis de ambiente (ex.: rodando testes). Os testes criam o app.
    pass
