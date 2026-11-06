# MoneyFlow 3D

SaaS de precificação e gestão para makers de impressão 3D FDM — MeshIT Tecnologia.

## Estrutura

```
moneyflow3d/
├── index.html, admin.html, lp.html   Frontend (servido pelo GitHub Pages)
├── backend/                          API Python (FastAPI) — roda no Render
│   ├── app/main.py                   Rotas e checagem de admin
│   ├── app/supabase_client.py        Único lugar que usa a secret key
│   ├── app/emails.py                 Modelos fixos de e-mail (Resend)
│   └── tests/                        Testes automáticos (pytest)
├── supabase/functions/               Edge Functions
├── scripts/validar_html.py           Regras 1 e 2 de qualidade + varredura de segredos
└── .github/workflows/verificacao.yml Roda a validação e os testes em todo PR
```

**Regra de ouro:** o navegador só conhece a chave pública (`sb_publishable_...`).
Toda operação que precisa de privilégio passa pelo backend, que confere o login
e o `role=admin` antes de agir.

## Fluxo de branches (GitHub Flow com homologação)

| Branch            | Ambiente                       | Quem publica             |
|-------------------|--------------------------------|--------------------------|
| `Desenvolvimento` | Desenvolvimento / homologação  | commits do dia a dia     |
| `main`            | Produção (moneyflow3d.com.br)  | só via Pull Request      |

1. Toda alteração é feita na branch `Desenvolvimento`.
2. A cada push, a verificação automática roda (aba **Actions** do GitHub).
3. Quando estiver pronto, abra um Pull Request `Desenvolvimento → main`.
4. Revise as mudanças na aba **Files changed** do PR e confira se a verificação passou.
5. Clique em **Merge pull request**. O GitHub Pages publica a `main` em produção.

Nunca envie arquivos direto para a `main` (sem "Add files via upload" na `main`).

## Backend — rodar localmente

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest -q          # testes
cp .env.example .env         # preencher com as chaves (NUNCA versionar o .env)
uvicorn app.main:app --reload
```

## Variáveis de ambiente do backend

| Variável              | O que é                                         |
|-----------------------|-------------------------------------------------|
| `SUPABASE_URL`        | URL do projeto Supabase                         |
| `SUPABASE_SECRET_KEY` | Secret key nova (`sb_secret_...`) — só no Render |
| `RESEND_API_KEY`      | Chave do Resend — só no Render                  |
| `APP_URL`             | URL do app (destino dos links de senha)         |
| `ALLOWED_ORIGINS`     | Sites autorizados a chamar a API (CORS)         |
