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


# ---------- /auth/recover (item 19) ----------
@respx.mock
def test_recover_envia_link_para_email_existente(client):
    respx.post(f"{SB}/auth/v1/admin/generate_link").mock(
        return_value=httpx.Response(200, json={"action_link": "https://link-recover"})
    )
    resend = respx.post("https://api.resend.com/emails").mock(
        return_value=httpx.Response(200, json={"id": "e1"})
    )
    r = client.post("/auth/recover", json={"email": "Cliente@X.com"})
    assert r.status_code == 200 and r.json() == {"ok": True}
    sent = resend.calls.last.request.content.decode()
    assert "cliente@x.com" in sent and "https://link-recover" in sent


@respx.mock
def test_recover_email_inexistente_mesma_resposta_sem_envio(client):
    respx.post(f"{SB}/auth/v1/admin/generate_link").mock(
        return_value=httpx.Response(404, json={"msg": "User not found"})
    )
    resend = respx.post("https://api.resend.com/emails").mock(
        return_value=httpx.Response(200, json={"id": "e1"})
    )
    r = client.post("/auth/recover", json={"email": "nao-existe@x.com"})
    assert r.status_code == 200 and r.json() == {"ok": True}
    assert not resend.called


@respx.mock
def test_recover_limite_por_email(client):
    respx.post(f"{SB}/auth/v1/admin/generate_link").mock(
        return_value=httpx.Response(404, json={"msg": "User not found"})
    )
    codes = [client.post("/auth/recover", json={"email": "spam@x.com"}).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


@respx.mock
def test_recover_falha_de_envio_e_visivel(client):
    respx.post(f"{SB}/auth/v1/admin/generate_link").mock(
        return_value=httpx.Response(200, json={"action_link": "https://link"})
    )
    respx.post("https://api.resend.com/emails").mock(
        return_value=httpx.Response(500, json={"message": "down"})
    )
    r = client.post("/auth/recover", json={"email": "a@x.com"})
    assert r.status_code == 502


def test_recover_email_invalido(client):
    assert client.post("/auth/recover", json={"email": "nao-e-email"}).status_code == 422


def test_rate_limiter_libera_depois_da_janela():
    from app.rate_limit import RateLimiter
    rl = RateLimiter(2, 60)
    assert rl.allow("k", now=0) and rl.allow("k", now=1)
    assert not rl.allow("k", now=2)
    assert rl.allow("k", now=61)


@respx.mock
def test_recover_chave_supabase_errada_nao_e_silencioso(client, caplog):
    """Erro de configuração (401 do Supabase) precisa aparecer, não virar 'ok', e ficar no log."""
    respx.post(f"{SB}/auth/v1/admin/generate_link").mock(
        return_value=httpx.Response(401, json={"message": "Invalid API key"})
    )
    r = client.post("/auth/recover", json={"email": "a@x.com"})
    assert r.status_code == 502
    assert "401" in caplog.text and "Invalid API key" in caplog.text


@respx.mock
def test_exclusao_grava_log_antes_de_apagar(client):
    """Bug de 08/11: o log depois da exclusão violava a FK e mostrava erro com a exclusão feita."""
    ordem = []
    respx.get(f"{SB}/auth/v1/user").mock(return_value=httpx.Response(200, json={"id": ADMIN_ID}))
    def perfil(request):
        if f"eq.{ADMIN_ID}" in str(request.url):
            return httpx.Response(200, json=[{"id": ADMIN_ID, "role": "admin"}])
        return httpx.Response(200, json=[{"id": USER_ID, "email": "alvo@x.com", "name": "Alvo"}])
    respx.get(f"{SB}/rest/v1/profiles").mock(side_effect=perfil)
    respx.post(f"{SB}/rest/v1/admin_logs").mock(side_effect=lambda r: (ordem.append("log"), httpx.Response(201))[1])
    respx.delete(f"{SB}/auth/v1/admin/users/{USER_ID}").mock(side_effect=lambda r: (ordem.append("auth"), httpx.Response(200, json={}))[1])
    respx.delete(f"{SB}/rest/v1/profiles").mock(side_effect=lambda r: (ordem.append("perfil"), httpx.Response(204))[1])
    r = client.delete(f"/admin/users/{USER_ID}", headers=AUTH)
    assert r.status_code == 200, r.text
    assert ordem == ["log", "auth", "perfil"]


# ---------- Registro de acesso (Marco Civil, art. 15) ----------
@respx.mock
def test_acesso_sem_token_retorna_401(client):
    assert client.post("/acesso").status_code == 401


@respx.mock
def test_acesso_token_invalido_retorna_401(client):
    respx.get(f"{SB}/auth/v1/user").mock(return_value=httpx.Response(401, json={"msg": "bad jwt"}))
    assert client.post("/acesso", headers={"Authorization": "Bearer ruim"}).status_code == 401


@respx.mock
def test_acesso_grava_ip_real_da_cloudflare(client):
    # Formato real visto na homologação: cliente, Cloudflare, rede interna do Render.
    respx.get(f"{SB}/auth/v1/user").mock(return_value=httpx.Response(200, json={"id": USER_ID}))
    grava = respx.post(f"{SB}/rest/v1/registros_acesso").mock(return_value=httpx.Response(201))
    cadeia = "6.6.6.6, 200.1.2.3, 172.71.234.65, 10.27.41.133"
    r = client.post(
        "/acesso",
        headers={"Authorization": "Bearer tok", "X-Forwarded-For": cadeia,
                 "CF-Connecting-IP": "200.1.2.3", "User-Agent": "Teste/1.0"},
    )
    assert r.status_code == 200 and r.json() == {"ok": True}
    import json
    row = json.loads(grava.calls.last.request.content)
    assert row["user_id"] == USER_ID
    assert row["ip"] == "200.1.2.3"  # nem o forjado (6.6.6.6) nem o interno (10.x)
    assert row["ip_cadeia"] == cadeia
    assert row["user_agent"] == "Teste/1.0"
    assert grava.calls.last.request.headers["apikey"] == "sb_secret_test"


def test_ip_do_cliente_sem_cloudflare_pula_rede_interna():
    from app.main import _ip_do_cliente
    assert _ip_do_cliente("", "6.6.6.6, 200.1.2.3, 10.27.41.133", "10.0.0.9") == "200.1.2.3"
    assert _ip_do_cliente("lixo", "200.1.2.3", "") == "200.1.2.3"
    assert _ip_do_cliente("", "10.1.1.1", "10.0.0.9") == "10.0.0.9"
    assert _ip_do_cliente("2804:14c::1", "", "") == "2804:14c::1"


@respx.mock
def test_acesso_limite_por_usuario(client):
    respx.get(f"{SB}/auth/v1/user").mock(return_value=httpx.Response(200, json={"id": OTHER_ID}))
    respx.post(f"{SB}/rest/v1/registros_acesso").mock(return_value=httpx.Response(201))
    codes = [client.post("/acesso", headers={"Authorization": "Bearer t"}).status_code for _ in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429


@respx.mock
def test_acesso_falha_no_banco_aparece(client):
    respx.get(f"{SB}/auth/v1/user").mock(return_value=httpx.Response(200, json={"id": USER_ID}))
    respx.post(f"{SB}/rest/v1/registros_acesso").mock(return_value=httpx.Response(500, json={"message": "erro"}))
    assert client.post("/acesso", headers={"Authorization": "Bearer t"}).status_code == 502


# ---------- Limpeza de contas inativas (Política de Privacidade) ----------
import json as _json
from datetime import datetime as _dt, timedelta as _td, timezone as _tz


def _dias_atras(d):
    return (_dt.now(_tz.utc) - _td(days=d)).isoformat()


@pytest.fixture
def tarefa_client(monkeypatch):
    def _make(excluir=False):
        monkeypatch.setenv("TAREFA_TOKEN", "tok-tarefa")
        monkeypatch.setenv("LIMPEZA_EXCLUIR", "1" if excluir else "")
        return TestClient(create_app(Settings()))
    return _make


TAREFA = {"X-Tarefa-Token": "tok-tarefa"}


@respx.mock
def test_limpeza_sem_token_401(tarefa_client):
    with tarefa_client() as c:
        assert c.post("/tarefas/limpeza-contas").status_code == 401
        assert c.post("/tarefas/limpeza-contas", headers={"X-Tarefa-Token": "errado"}).status_code == 401


@respx.mock
def test_limpeza_sem_token_configurado_503(client):
    assert client.post("/tarefas/limpeza-contas", headers=TAREFA).status_code == 503


@respx.mock
def test_limpeza_avisa_aos_75_dias_e_marca(tarefa_client):
    respx.post(f"{SB}/rest/v1/rpc/contas_para_limpeza").mock(return_value=httpx.Response(200, json=[
        {"id": USER_ID, "email": "a@x.com", "nome": "Ana", "ultimo_acesso": _dias_atras(76), "aviso_exclusao_em": None}]))
    resend = respx.post("https://api.resend.com/emails").mock(return_value=httpx.Response(200, json={"id": "e"}))
    marca = respx.patch(f"{SB}/rest/v1/profiles").mock(return_value=httpx.Response(204))
    with tarefa_client() as c:
        r = c.post("/tarefas/limpeza-contas", headers=TAREFA)
    assert r.json()["avisados"] == 1 and r.json()["excluidos"] == 0
    corpo = _json.loads(resend.calls.last.request.content)
    assert corpo["to"] == ["a@x.com"] and "15 dias" in corpo["subject"]
    assert _json.loads(marca.calls.last.request.content)["aviso_exclusao_em"]


@respx.mock
def test_limpeza_falha_no_email_nao_marca_aviso(tarefa_client):
    respx.post(f"{SB}/rest/v1/rpc/contas_para_limpeza").mock(return_value=httpx.Response(200, json=[
        {"id": USER_ID, "email": "a@x.com", "nome": "Ana", "ultimo_acesso": _dias_atras(80), "aviso_exclusao_em": None}]))
    respx.post("https://api.resend.com/emails").mock(return_value=httpx.Response(500, json={}))
    marca = respx.patch(f"{SB}/rest/v1/profiles").mock(return_value=httpx.Response(204))
    with tarefa_client(excluir=True) as c:
        r = c.post("/tarefas/limpeza-contas", headers=TAREFA)
    assert r.json()["erros"] == 1 and not marca.called


@respx.mock
def test_limpeza_reativa_quem_voltou_depois_do_aviso(tarefa_client):
    respx.post(f"{SB}/rest/v1/rpc/contas_para_limpeza").mock(return_value=httpx.Response(200, json=[
        {"id": USER_ID, "email": "a@x.com", "nome": "Ana", "ultimo_acesso": _dias_atras(1), "aviso_exclusao_em": _dias_atras(10)}]))
    marca = respx.patch(f"{SB}/rest/v1/profiles").mock(return_value=httpx.Response(204))
    apaga = respx.delete(f"{SB}/auth/v1/admin/users/{USER_ID}").mock(return_value=httpx.Response(200))
    with tarefa_client(excluir=True) as c:
        r = c.post("/tarefas/limpeza-contas", headers=TAREFA)
    assert r.json()["reativados"] == 1 and not apaga.called
    assert _json.loads(marca.calls.last.request.content) == {"aviso_exclusao_em": None}


@respx.mock
def test_limpeza_modo_relatorio_nao_apaga(tarefa_client):
    respx.post(f"{SB}/rest/v1/rpc/contas_para_limpeza").mock(return_value=httpx.Response(200, json=[
        {"id": USER_ID, "email": "a@x.com", "nome": "Ana", "ultimo_acesso": _dias_atras(95), "aviso_exclusao_em": _dias_atras(20)}]))
    apaga = respx.delete(f"{SB}/auth/v1/admin/users/{USER_ID}").mock(return_value=httpx.Response(200))
    with tarefa_client(excluir=False) as c:
        r = c.post("/tarefas/limpeza-contas", headers=TAREFA)
    assert r.json() == {"avisados": 0, "reativados": 0, "excluidos": 0, "excluiria": 1, "erros": 0, "modo": "relatorio"}
    assert not apaga.called


@respx.mock
def test_limpeza_exclui_aos_90_dias_com_aviso_de_15(tarefa_client):
    respx.post(f"{SB}/rest/v1/rpc/contas_para_limpeza").mock(return_value=httpx.Response(200, json=[
        {"id": USER_ID, "email": "a@x.com", "nome": "Ana", "ultimo_acesso": _dias_atras(95), "aviso_exclusao_em": _dias_atras(16)},
        # avisado há só 5 dias: ainda não pode excluir
        {"id": OTHER_ID, "email": "b@x.com", "nome": "Bia", "ultimo_acesso": _dias_atras(100), "aviso_exclusao_em": _dias_atras(5)}]))
    log_admin = respx.post(f"{SB}/rest/v1/admin_logs").mock(return_value=httpx.Response(201))
    respx.post(f"{SB}/storage/v1/object/list/logos").mock(return_value=httpx.Response(200, json=[{"name": "logo.png"}]))
    apaga_logo = respx.delete(f"{SB}/storage/v1/object/logos").mock(return_value=httpx.Response(200, json=[]))
    apaga = respx.delete(f"{SB}/auth/v1/admin/users/{USER_ID}").mock(return_value=httpx.Response(200))
    apaga_outro = respx.delete(f"{SB}/auth/v1/admin/users/{OTHER_ID}").mock(return_value=httpx.Response(200))
    with tarefa_client(excluir=True) as c:
        r = c.post("/tarefas/limpeza-contas", headers=TAREFA)
    assert r.json()["excluidos"] == 1 and apaga.called and not apaga_outro.called
    assert _json.loads(apaga_logo.calls.last.request.content) == {"prefixes": [f"{USER_ID}/logo.png"]}
    assert _json.loads(log_admin.calls.last.request.content)["action"] == "auto_delete_inactive"
    assert "a@x.com" not in r.text  # resposta só com números (log do Actions é público)
