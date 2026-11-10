"""Item 24: planos.js é a fonte única de preços. Barra o PR se algum HTML divergir.

Uso: python3 scripts/validar_precos.py index.html admin.html lp.html
Confere em cada arquivo:
  - todo "R$ xx,xx/mês" (ou "R$xx/mês") é o preço do Pro ou o preço depois da oferta;
  - todo link pay.kiwify.com.br é o checkout de planos.js;
  - "50 primeiras vagas" / "primeiros 50" bate com vagasFundador.
"""
import json
import re
import subprocess
import sys

cfg = json.loads(subprocess.run(
    ["node", "-e",
     "global.window={};require('./planos.js');const P=window.PLANOS;"
     "console.log(JSON.stringify({pro:P.lista.pro.preco,depois:P.lista.pro.precoDepois,"
     "checkout:P.checkout,vagas:P.vagasFundador}))"],
    capture_output=True, text=True, check=True).stdout)

def num(txt):
    return round(float(txt.replace(".", "").replace(",", ".")), 2)

validos = {round(cfg["pro"], 2), round(cfg["depois"], 2)}
falhou = False
for arq in sys.argv[1:]:
    code = open(arq, encoding="utf-8").read()
    erros = []
    for m in re.finditer(r"R\$\s?(\d+(?:,\d{2})?)\s*(?:<[^>]+>\s*)*/\s*m[eê]s", code):
        if num(m.group(1)) not in validos:
            linha = code.count("\n", 0, m.start()) + 1
            erros.append(f"linha {linha}: preço {m.group(0)!r} difere de planos.js {sorted(validos)}")
    for m in re.finditer(r"https://pay\.kiwify\.com\.br/[A-Za-z0-9]+", code):
        if m.group(0) != cfg["checkout"]:
            linha = code.count("\n", 0, m.start()) + 1
            erros.append(f"linha {linha}: link {m.group(0)} difere de {cfg['checkout']}")
    for m in re.finditer(r"(\d+)\s+primeir[oa]s\s+(?:vagas|assinantes)|primeir[oa]s\s+(\d+)\s+(?:vagas|assinantes)", code):
        n = int(m.group(1) or m.group(2))
        if n != cfg["vagas"]:
            linha = code.count("\n", 0, m.start()) + 1
            erros.append(f"linha {linha}: {m.group(0)!r} difere de vagasFundador={cfg['vagas']}")
    print(f"== {arq}: " + ("OK" if not erros else f"{len(erros)} erro(s)"))
    for e in erros:
        print("  ERRO:", e)
    falhou = falhou or bool(erros)

sys.exit(1 if falhou else 0)
