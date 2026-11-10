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
    # Item 25: nada de código no HTML (onclick=, onchange=...) e toda ação data-* aponta para função que existe.
    # Bloco <script> sem src ou link javascript: também quebram com a CSP ligada.
    for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>\s*\S", code):
        print(f"  ERRO: <script> com código dentro do HTML (linha {code[:m.start()].count(chr(10)) + 1}); mova para js/")
        falhou = True
    if re.search(r"""(?:href|src)\s*=\s*["']\s*javascript:""", code, re.I):
        print("  ERRO: link javascript: no HTML (bloqueado pela CSP)")
        falhou = True
    tudo = code_js_e_html
    # O "event" implícito do onclick antigo não existe mais do jeito antigo: com js/eventos.js,
    # event.currentTarget é a página inteira. Use o parâmetro da função ou "this".
    sem_atributos = re.sub(r"data-[a-z]+=([\"']).*?\1", "", tudo, flags=re.S)
    for m in re.finditer(r"(?<![\w.$])event\.(currentTarget|target|srcElement)", sem_atributos):
        linha = sem_atributos[max(0, m.start() - 60):m.end() + 20].replace("\n", " ")
        if "function" in linha and "(event" in linha:
            continue
        print(f"  ERRO: uso do 'event' implícito (quebra com data-*): ...{linha}...")
        falhou = True
    for m in re.finditer(r"\son([a-z]+)\s*=\s*[\"'\\]", tudo):
        trecho = tudo[max(0, m.start() - 40):m.end() + 40].replace("\n", " ")
        print(f"  ERRO: evento escrito no HTML (use data-{m.group(1)}): ...{trecho}...")
        falhou = True
    definidas = set(re.findall(r"\bfunction\s+([A-Za-z_$][\w$]*)", tudo)) | set(re.findall(r"window\.([A-Za-z_$][\w$]*)\s*=", tudo))
    usadas = set()
    for attr in re.findall(r"data-(?:click|change|input|enter|keydown|drop|dragover|dragleave|mouseover|mouseout)=([\"'])(.*?)\1", tudo, re.S):
        for nome in re.findall(r"(?:^|;)\s*([A-Za-z_$][\w$]*)\s*\(", attr[1].replace("&#39;", "'")):
            usadas.add(nome)
    faltam = sorted(usadas - definidas - {"event"})
    if faltam:
        print("  ERRO: ação data-* chama função que não existe:", faltam)
        falhou = True
    elif usadas:
        print(f"  ações data-*: {len(usadas)} funções, todas existem")
    js_ids = set(re.findall(r"getElementById\('([^']+)'\)", code_js_e_html))
    html_ids = set(re.findall(r'\bid=["\']([^"\']+)["\']', code))
    faltando = js_ids - html_ids
    print("  IDs faltando (aviso):", sorted(faltando) if faltando else "nenhum")

sys.exit(1 if falhou else 0)
