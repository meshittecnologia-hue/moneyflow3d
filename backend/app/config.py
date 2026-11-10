"""Configuração lida de variáveis de ambiente.

Nenhuma chave secreta fica no código. Em produção, os valores são
cadastrados no painel do provedor de hospedagem (Render).
"""
import os


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Variável de ambiente obrigatória ausente: {name}")
    return value


class Settings:
    def __init__(self) -> None:
        self.supabase_url = _required("SUPABASE_URL").rstrip("/")
        # Secret key nova do Supabase (sb_secret_...). Nunca vai para o navegador.
        self.supabase_secret_key = _required("SUPABASE_SECRET_KEY")
        self.resend_api_key = _required("RESEND_API_KEY")
        self.email_from = os.environ.get(
            "EMAIL_FROM", "MoneyFlow 3D <noreply@moneyflow3d.com.br>"
        )
        self.app_url = os.environ.get("APP_URL", "https://moneyflow3d.com.br")
        # Tarefas agendadas (GitHub Actions): token próprio, só para /tarefas/*.
        self.tarefa_token = os.environ.get("TAREFA_TOKEN", "").strip()
        # Exclusão de contas inativas: só apaga de verdade com LIMPEZA_EXCLUIR=1.
        # Sem isso, conta quantas excluiria (relatório) e não apaga nada.
        self.limpeza_excluir = os.environ.get("LIMPEZA_EXCLUIR", "").strip() == "1"
        # Origens do navegador autorizadas a chamar a API (separadas por vírgula).
        self.allowed_origins = [
            o.strip()
            for o in os.environ.get(
                "ALLOWED_ORIGINS", "https://moneyflow3d.com.br"
            ).split(",")
            if o.strip()
        ]


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
