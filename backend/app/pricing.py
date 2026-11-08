"""Fórmula de precificação do MoneyFlow 3D — porta fiel de calcCustos() do index.html.

REGRA: a fórmula é o núcleo do produto e NÃO pode ser alterada. Este módulo
reproduz exatamente o cálculo do navegador; tests/test_pricing.py roda o
JavaScript real do index.html e compara os resultados nas mesmas entradas.
"""
from dataclasses import dataclass

# Impressora usada quando o usuário não tem nenhuma cadastrada (mesmo valor do JS).
IMPRESSORA_PADRAO = {"inv": 9500.0, "roi": 18.0, "watts": 350.0, "hpd": 8.0, "fail": 5.0}
# Custo por kg usado quando o filamento não tem custo (mesmo valor do JS).
CUSTO_KG_PADRAO = 120.0

# Taxas dos marketplaces (mesma tabela MPs do index.html).
MARKETPLACES = {
    "shopee_fg": 0.14,
    "shopee_std": 0.16,
    "ml": 0.115,
    "amazon": 0.15,
    "infinitypay": 0.1249,
    "pix": 0.0,
}


@dataclass(frozen=True)
class Impressora:
    inv: float   # investimento (R$)
    roi: float   # meses para pagar a impressora
    watts: float
    hpd: float   # horas de uso por dia
    fail: float  # taxa de falha (%)


@dataclass(frozen=True)
class Filamento:
    custo: float  # R$ do carretel
    peso: float   # gramas do carretel


def calc_custos(
    *,
    impressora: Impressora | None,
    kwh: float,
    gramas: float,
    filamento: Filamento | None,
    embalagem: float,
    insumos: float,
    horas: float,
    minutos: float,
    segundos: float,
    valor_hora: float,
    minutos_manual: float,
    markup_pct: float,
    desconto_pct: float,
) -> dict:
    imp = impressora or Impressora(**IMPRESSORA_PADRAO)
    fkg = (filamento.custo / (filamento.peso / 1000)) if filamento and filamento.custo > 0 else CUSTO_KG_PADRAO
    print_h = horas + minutos / 60 + segundos / 3600
    markup = markup_pct / 100
    horas_mes = imp.hpd * 25
    depr_h = (imp.inv / (imp.roi * horas_mes)) if imp.roi > 0 else 0.0
    energia_h = (imp.watts / 1000) * kwh
    maquina = (depr_h + energia_h) * print_h
    fail = maquina * (imp.fail / 100)
    filamento_custo = (gramas / 1000) * fkg
    mo = valor_hora * (minutos_manual / 60)
    total = maquina + fail + filamento_custo + embalagem + insumos + mo
    base = total * (1 + markup)
    desconto = desconto_pct / 100
    base_final = base * (1 - desconto)
    return {
        "total": total, "base": base, "baseFinal": base_final,
        "maquina": maquina, "fail": fail, "filamento": filamento_custo,
        "emb": embalagem, "ins": insumos, "mo": mo,
        "markup": markup, "desconto": desconto, "printH": print_h,
    }


def lucro_marketplace(preco: float, total: float, taxa_mp: float) -> dict:
    """Mesmo cálculo de renderBreakdown(): taxa, lucro líquido e margem %."""
    taxa = preco * taxa_mp
    liquido = preco - total - taxa
    margem = (liquido / preco * 100) if preco > 0 else 0.0
    return {"taxa": taxa, "liquido": liquido, "margem": margem}
