"""Envio de e-mail com modelos FIXOS.

Corrige o problema 2 da auditoria: ninguém de fora escolhe destinatário
livre, assunto ou HTML. Só existem os modelos abaixo, e só o backend envia.
"""
import html

import httpx

from .config import Settings


def _layout(titulo: str, nome: str, texto: str, link: str, app_url: str) -> str:
    nome_seguro = html.escape(nome)
    link_seguro = html.escape(link, quote=True)
    app_seguro = html.escape(app_url, quote=True)
    return f"""
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#f0f0f0;border-radius:12px;overflow:hidden">
  <div style="background:#ff6b2b;padding:24px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:24px">⬡ MoneyFlow 3D</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px">Precificação Inteligente para Makers</p>
  </div>
  <div style="padding:32px">
    <h2 style="color:#ff6b2b;margin-top:0">{titulo}</h2>
    <p style="color:#ccc;line-height:1.6">Olá <strong style="color:#fff">{nome_seguro}</strong>,</p>
    <p style="color:#ccc;line-height:1.6">{texto}</p>
    <div style="text-align:center;margin:32px 0">
      <a href="{link_seguro}" style="background:#ff6b2b;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block">Acessar MoneyFlow 3D →</a>
    </div>
    <p style="color:#666;font-size:12px;text-align:center">Link válido por 24 horas. Se não solicitou este acesso, ignore este email.</p>
  </div>
  <div style="background:#1a1a1a;padding:16px;text-align:center">
    <p style="color:#555;font-size:11px;margin:0">MoneyFlow 3D · MeshIT Tecnologia · <a href="{app_seguro}" style="color:#ff6b2b;text-decoration:none">moneyflow3d.com.br</a></p>
  </div>
</div>"""


TEMPLATES = {
    "invite": (
        "Você foi convidado para o MoneyFlow 3D",
        "Você foi convidado!",
        "Você recebeu acesso ao <strong style=\"color:#fff\">MoneyFlow 3D</strong> — o sistema completo de precificação e gestão para makers de impressão 3D FDM. Clique no botão abaixo para definir sua senha e acessar o sistema:",
    ),
    "access": (
        "Acesse o MoneyFlow 3D — link de acesso",
        "Acesse sua conta",
        "Clique no botão abaixo para definir ou redefinir sua senha e acessar o <strong style=\"color:#fff\">MoneyFlow 3D</strong>:",
    ),
}


class EmailError(Exception):
    pass


async def send_template(
    settings: Settings,
    client: httpx.AsyncClient,
    template: str,
    to: str,
    name: str,
    link: str,
) -> None:
    subject, titulo, texto = TEMPLATES[template]
    body = _layout(titulo, name, texto, link, settings.app_url)
    resp = await client.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {settings.resend_api_key}"},
        json={"from": settings.email_from, "to": [to], "subject": subject, "html": body},
        timeout=10.0,
    )
    if resp.status_code >= 400:
        raise EmailError(f"Resend recusou o envio (HTTP {resp.status_code}): {resp.text[:200]}")
