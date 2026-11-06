import os

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

os.environ.setdefault("SUPABASE_URL", "https://sb.test")
os.environ.setdefault("SUPABASE_SECRET_KEY", "sb_secret_test")
os.environ.setdefault("RESEND_API_KEY", "re_test")

from app.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

SB = "https://sb.test"
ADMIN_ID = "11111111-1111-1111-1111-111111111111"
USER_ID = "22222222-2222-2222-2222-222222222222"
OTHER_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture
def client():
    app = create_app(Settings())
    with TestClient(app) as c:
        yield c


def mock_auth(mock, role="admin"):
    mock.get(f"{SB}/auth/v1/user").mock(
        return_value=httpx.Response(200, json={"id": ADMIN_ID})
    )
    mock.get(f"{SB}/rest/v1/profiles").mock(
        return_value=httpx.Response(200, json=[{"id": ADMIN_ID, "role": role}])
    )


AUTH = {"Authorization": "Bearer token-do-admin"}


def test_sem_token_retorna_401(client):
    r = client.delete(f"/admin/users/{USER_ID}")
    assert r.status_code == 401


@respx.mock
def test_token_invalido_retorna_401(client):
    respx.get(f"{SB}/auth/v1/user").mock(return_value=httpx.Response(401, json={}))
    r = client.delete(f"/admin/users/{USER_ID}", headers=AUTH)
    assert r.status_code == 401


@respx.mock
def test_usuario_comum_retorna_403(client):
    mock_auth(respx, role="user")
    r = client.delete(f"/admin/users/{USER_ID}", headers=AUTH)
    assert r.status_code == 403


@respx.mock
def test_secret_key_vai_so_no_servidor(client):
    mock_auth(respx)
    delete = respx.delete(f"{SB}/auth/v1/admin/users/{USER_ID}").mock(
        return_value=httpx.Response(200, json={})
    )
    respx.delete(f"{SB}/rest/v1/profiles").mock(return_value=httpx.Response(204))
    respx.post(f"{SB}/rest/v1/admin_logs").mock(return_value=httpx.Response(201))
    r = client.delete(f"/admin/users/{USER_ID}", headers=AUTH)
    assert r.status_code == 200
    assert delete.calls.last.request.headers["apikey"] == "sb_secret_test"
    assert "sb_secret" not in r.text


@respx.mock
def test_admin_nao_exclui_a_si_mesmo(client):
    mock_auth(respx)
    r = client.delete(f"/admin/users/{ADMIN_ID}", headers=AUTH)
    assert r.status_code == 400


@respx.mock
def test_usuario_existente_atualiza_o_certo_nao_o_primeiro(client):
    """Problema 5: antes pegava users[0]. Agora casa o e-mail exato."""
    mock_auth(respx)
    respx.post(f"{SB}/auth/v1/admin/users").mock(
        return_value=httpx.Response(422, json={"msg": "User already registered"})
    )
    respx.get(f"{SB}/auth/v1/admin/users").mock(
        return_value=httpx.Response(
            200,
            json={"users": [
                {"id": OTHER_ID, "email": "primeiro@x.com"},
                {"id": USER_ID, "email": "Alvo@X.com"},
            ]},
        )
    )
    patch = respx.patch(f"{SB}/rest/v1/profiles").mock(return_value=httpx.Response(204))
    respx.post(f"{SB}/rest/v1/admin_logs").mock(return_value=httpx.Response(201))
    r = client.post(
        "/admin/users", headers=AUTH,
        json={"email": "alvo@x.com", "name": "Alvo", "plan": "pro", "mode": "password", "password": "SenhaForte123!"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["user_id"] == USER_ID
    assert f"eq.{USER_ID}" in str(patch.calls.last.request.url)


@respx.mock
def test_plano_invalido_rejeitado(client):
    mock_auth(respx)
    r = client.post("/admin/users", headers=AUTH, json={"email": "a@b.com", "plan": "vip"})
    assert r.status_code == 422


@respx.mock
def test_convite_envia_email_com_modelo_fixo_e_escapa_nome(client):
    mock_auth(respx)
    respx.post(f"{SB}/auth/v1/admin/users").mock(
        return_value=httpx.Response(200, json={"id": USER_ID})
    )
    respx.patch(f"{SB}/rest/v1/profiles").mock(return_value=httpx.Response(204))
    respx.post(f"{SB}/auth/v1/admin/generate_link").mock(
        return_value=httpx.Response(200, json={"action_link": "https://link"})
    )
    resend = respx.post("https://api.resend.com/emails").mock(
        return_value=httpx.Response(200, json={"id": "e1"})
    )
    respx.post(f"{SB}/rest/v1/admin_logs").mock(return_value=httpx.Response(201))
    r = client.post(
        "/admin/users", headers=AUTH,
        json={"email": "novo@x.com", "name": "<script>x</script>", "mode": "invite"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["email_sent"] is True
    sent = resend.calls.last.request.content.decode()
    assert "<script>x" not in sent
    assert "novo@x.com" in sent


@respx.mock
def test_falha_no_email_aparece_para_o_admin(client):
    """Problema 4: falha de envio não pode ser silenciosa."""
    mock_auth(respx)
    respx.post(f"{SB}/auth/v1/admin/generate_link").mock(
        return_value=httpx.Response(200, json={"action_link": "https://link"})
    )
    respx.post("https://api.resend.com/emails").mock(
        return_value=httpx.Response(401, json={"message": "API key is invalid"})
    )
    r = client.post("/admin/users/access-email", headers=AUTH, json={"email": "a@b.com"})
    assert r.status_code == 502
    assert "Resend" in r.json()["detail"]
