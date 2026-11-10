"""Regras 1 e 2 de qualidade do MoneyFlow 3D, automatizadas.

Uso: python3 scripts/validar_html.py admin.html index.html lp.html
Falha (exit 1) se: JS com erro de sintaxe, ou chave secreta no arquivo.
IDs faltando são listados como aviso.
"""
import re
import subprocess
import sys
import tempfile

SEGREDOS = [
    (r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", "JWT (chave legada do Supabase)"),
    (r"sb_secret_[A-Za-z0-9_-]+", "secret key do Supabase"),
    (r"\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]+", "chave do Resend"),
]

falhou = False
for arq in sys.argv[1:]:
    code = open(arq, encoding="utf-8").read()
    print(f"== {arq}")
    for padrao, nome in SEGREDOS:
        if re.search(padrao, code):
            print(f"  ERRO: {nome} encontrada no arquivo")
            falhou = True
    # Item 22: todo script externo com versão exata e assinatura de integridade (SRI).
    for tag in re.findall(r"<script[^>]*\bsrc=\"https?://[^\"]+\"[^>]*>", code):
        src = re.search(r'src="([^"]+)"', tag).group(1)
        if "integrity=" not in tag:
            print(f"  ERRO: script externo sem integrity (SRI): {src}")
            falhou = True
        if re.search(r"@\d+(/|$)|@latest", src):
            print(f"  ERRO: script externo sem versão exata: {src}")
            falhou = True
    # Item 16: o JS também vem de arquivos locais (js/...). Junta tudo na ordem de carga.
    locais = re.findall(r'<script src="((?:js/)[^"?]+)(?:\?v=[0-9a-f]*)?"></script>', code)
    externos = "\n".join(open(f, encoding="utf-8").read() for f in locais)
    if locais:
        print(f"  arquivos JS: {len(locais)}")
    for padrao, nome in SEGREDOS:
        if re.search(padrao, externos):
            print(f"  ERRO: {nome} encontrada em js/")
            falhou = True
    js = "\n".join(re.findall(r"<script>(.*?)</script>", code, re.DOTALL)) + "\n" + externos
    code_js_e_html = code + "\n" + externos
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as t:
        t.write(js)
    r = subprocess.run(
        ["node", "-e", "const c=require('fs').readFileSync(process.argv[1],'utf8');try{new Function(c);console.log('JS OK')}catch(e){console.log('ERRO JS:',e.message);process.exit(1)}", t.name],
        capture_output=True, text=True,
    )
    print("  " + r.stdout.strip())
    if r.returncode:
        falhou = True
    js_ids = set(re.findall(r"getElementById\('([^']+)'\)", code_js_e_html))
    html_ids = set(re.findall(r'\bid=["\']([^"\']+)["\']', code))
    faltando = js_ids - html_ids
    print("  IDs faltando (aviso):", sorted(faltando) if faltando else "nenhum")

sys.exit(1 if falhou else 0)
