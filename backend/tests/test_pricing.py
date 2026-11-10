"""Paridade da fórmula: o Python precisa dar exatamente o resultado do JavaScript do index.html.

O teste extrai calcCustos() do index.html real e o executa no Node com as mesmas
entradas. Se a fórmula mudar em qualquer um dos lados, este teste falha.
"""
import json
import math
import random
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from app.pricing import (
    CUSTO_KG_PADRAO, IMPRESSORA_PADRAO, MARKETPLACES,
    Filamento, Impressora, calc_custos, lucro_marketplace,
)

RAIZ = Path(__file__).resolve().parents[2]
INDEX = RAIZ / "index.html"


def codigo_do_app() -> str:
    """index.html + js/*.js (o JavaScript saiu do index.html no item 16)."""
    partes = [INDEX.read_text(encoding="utf-8")]
    partes += [f.read_text(encoding="utf-8") for f in sorted((RAIZ / "js").glob("*.js"))]
    return "\n".join(partes)
NODE = shutil.which("node")


def _js_fonte(nome: str) -> str:
    html = codigo_do_app()
    m = re.search(r"^function " + nome + r"\(\)\{.*?^\}", html, re.S | re.M)
    assert m, f"{nome}() não encontrada no index.html"
    return m.group(0)


def _js_constantes() -> dict:
    html = codigo_do_app()
    fee = dict(re.findall(r"\{id:'(\w+)',\s*name:'[^']*',\s*fee:([\d.]+)\}", html))
    return {k: float(v) for k, v in fee.items()}


def _caso_aleatorio(rng: random.Random) -> dict:
    tem_imp = rng.random() > 0.15
    tem_fil = rng.random() > 0.15
    return {
        "imp": {"id": 1, "inv": rng.choice([0, 3500, 9500, 22000]) + rng.random() * 1000,
                "roi": rng.choice([0, 6, 12, 18, 24]), "watts": rng.uniform(80, 1200),
                "hpd": rng.uniform(1, 24), "fail": rng.uniform(0, 20)} if tem_imp else None,
        "fil": {"id": 7, "custo": rng.choice([0, 89.9, 120, 170, 249.5]),
                "peso": rng.choice([250, 500, 750, 1000, 2000])} if tem_fil else None,
        "kwh": rng.uniform(0.5, 1.4),
        "inputs": {
            "c-grams": rng.uniform(0, 800), "c-emb": rng.uniform(0, 15), "c-ins": rng.uniform(0, 10),
            "c-th": rng.randint(0, 40), "c-tm": rng.randint(0, 59), "c-ts": rng.randint(0, 59),
            "c-hora": rng.uniform(0, 80), "c-tman": rng.uniform(0, 120),
            "c-markup": rng.uniform(0, 400), "c-desconto": rng.uniform(0, 50),
        },
    }


def _roda_js(casos: list[dict]) -> list[dict]:
    script = """
const casos = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const out = [];
for (const c of casos) {
  const valores = Object.assign({'c-imp': c.imp ? String(c.imp.id) : '', 'c-fil': c.fil ? String(c.fil.id) : ''}, c.inputs);
  const document = { getElementById: id => ({ value: valores[id] === undefined ? '' : String(valores[id]) }) };
  const DB = { impressoras: c.imp ? [c.imp] : [], filamentos: c.fil ? [c.fil] : [], config: { kwh: c.kwh } };
  function gv(id){return parseFloat(document.getElementById(id).value)||0;}
  %s
  out.push(calcCustos());
}
process.stdout.write(JSON.stringify(out));
""" % _js_fonte("calcCustos")
    r = subprocess.run([NODE, "-e", script], input=json.dumps(casos), capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


def _roda_py(c: dict) -> dict:
    i = c["inputs"]
    return calc_custos(
        impressora=Impressora(**{k: v for k, v in c["imp"].items() if k != "id"}) if c["imp"] else None,
        kwh=c["kwh"], gramas=i["c-grams"],
        filamento=Filamento(custo=c["fil"]["custo"], peso=c["fil"]["peso"]) if c["fil"] else None,
        embalagem=i["c-emb"], insumos=i["c-ins"],
        horas=i["c-th"], minutos=i["c-tm"], segundos=i["c-ts"],
        valor_hora=i["c-hora"], minutos_manual=i["c-tman"],
        markup_pct=i["c-markup"], desconto_pct=i["c-desconto"],
    )


@pytest.mark.skipif(NODE is None, reason="Node.js necessário para comparar com o JavaScript")
def test_paridade_com_o_javascript_do_index_html():
    rng = random.Random(20261108)
    casos = [_caso_aleatorio(rng) for _ in range(500)]
    # casos de borda: sem impressora, sem filamento, roi 0, filamento sem custo, tudo zero
    casos.append({"imp": None, "fil": None, "kwh": 0.9, "inputs": {k: 0 for k in casos[0]["inputs"]}})
    casos.append({"imp": {"id": 1, "inv": 9500, "roi": 0, "watts": 350, "hpd": 8, "fail": 5},
                  "fil": {"id": 7, "custo": 0, "peso": 1000}, "kwh": 0.9, "inputs": casos[0]["inputs"]})
    js = _roda_js(casos)
    assert len(js) == len(casos)
    for n, (c, esperado) in enumerate(zip(casos, js)):
        obtido = _roda_py(c)
        assert set(obtido) == set(esperado), f"caso {n}: chaves diferentes"
        for k, v in esperado.items():
            assert math.isclose(obtido[k], v, rel_tol=1e-12, abs_tol=1e-9), f"caso {n}, {k}: py={obtido[k]} js={v}"


def test_constantes_iguais_ao_index_html():
    html = codigo_do_app()
    assert "{inv:9500,roi:18,watts:350,hpd:8,fail:5}" in html
    assert IMPRESSORA_PADRAO == {"inv": 9500.0, "roi": 18.0, "watts": 350.0, "hpd": 8.0, "fail": 5.0}
    assert ":120;" in _js_fonte("calcCustos") and CUSTO_KG_PADRAO == 120.0
    assert _js_constantes() == MARKETPLACES


def test_exemplo_conferido_a_mao():
    # Impressora: R$ 9.500, ROI 18 meses, 350 W, 8 h/dia, 5% de falha. Energia R$ 0,90/kWh.
    # Peça: 100 g de PLA a R$ 120/kg, 2 h de impressão, R$ 2 embalagem, R$ 1 insumos,
    # 10 min de mão de obra a R$ 30/h, markup 200%, sem desconto.
    r = calc_custos(
        impressora=Impressora(9500, 18, 350, 8, 5), kwh=0.9, gramas=100,
        filamento=Filamento(120, 1000), embalagem=2, insumos=1,
        horas=2, minutos=0, segundos=0, valor_hora=30, minutos_manual=10,
        markup_pct=200, desconto_pct=0,
    )
    depr_h = 9500 / (18 * 8 * 25)          # 2,6389 R$/h
    energia_h = 0.35 * 0.9                 # 0,315 R$/h
    maquina = (depr_h + energia_h) * 2     # 5,9078
    total = maquina * 1.05 + 12 + 2 + 1 + 5
    assert math.isclose(r["total"], total)
    assert math.isclose(r["base"], total * 3)
    m = lucro_marketplace(r["base"], r["total"], MARKETPLACES["ml"])
    assert math.isclose(m["liquido"], r["base"] - r["total"] - r["base"] * 0.115)
