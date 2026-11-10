"""Item 16: carimbo de versão nos arquivos locais (?v=<hash do conteúdo>).

Por quê: o navegador e a Cloudflare guardam CSS/JS por alguns minutos. Sem o carimbo,
logo depois de publicar, alguém poderia receber o index.html novo com um js/ antigo.
Com o carimbo, qualquer mudança no arquivo muda o endereço e força baixar de novo.

Uso:
  python3 scripts/versionar.py            # atualiza os carimbos em index.html/admin.html/lp.html
  python3 scripts/versionar.py --checar   # só confere (CI): falha se algum carimbo estiver velho
"""
import hashlib
import re
import sys

PAGINAS = ["index.html", "admin.html", "lp.html"]
REF = re.compile(r'(?P<attr>(?:src|href))="(?P<path>(?:js|css)/[^"?]+|planos\.js)(?:\?v=[0-9a-f]*)?"')


def carimbo(caminho: str) -> str:
    return hashlib.sha256(open(caminho, "rb").read()).hexdigest()[:10]


def processar(checar: bool) -> int:
    velhos = 0
    for pagina in PAGINAS:
        texto = open(pagina, encoding="utf-8").read()

        def troca(m):
            nonlocal velhos
            novo = f'{m.group("attr")}="{m.group("path")}?v={carimbo(m.group("path"))}"'
            if novo != m.group(0):
                velhos += 1
                if checar:
                    print(f"  {pagina}: carimbo desatualizado em {m.group('path')}")
            return novo

        novo_texto = REF.sub(troca, texto)
        if not checar and novo_texto != texto:
            open(pagina, "w", encoding="utf-8").write(novo_texto)
            print(f"atualizado: {pagina}")
    return velhos


if __name__ == "__main__":
    checar = "--checar" in sys.argv
    n = processar(checar)
    if checar:
        if n:
            print(f"ERRO: {n} carimbo(s) desatualizado(s). Rode: python3 scripts/versionar.py")
            sys.exit(1)
        print("carimbos de versão OK")
