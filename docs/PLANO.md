# MoneyFlow 3D — Plano de Correção e Separação Front/Back

Atualizado em 10/11/2026 (01h15) · Versão viva (editável, com diagramas): https://claude.ai/artifact/A5yhyA9VDmnz4pSLtQXwHt

## Resumo

Dos 34 problemas da auditoria de 04/11/2026, **21 estão resolvidos, 2 parcialmente e 11 pendentes**. Os 5 urgentes de segurança estão fechados ou mitigados; o backend Python está no ar e a Fase 1 foi concluída em 09/11; o que falta é o ambiente de homologação, a troca das chaves que passaram pelo chat e separar o restante do frontend. Previsão de conclusão: **19/12/2026**, em 6 fases.

Como usamos este plano:

- Um item por vez. Cada item só é marcado como feito depois de validado com prova (teste, log ou consulta ao banco), seguindo as Regras de Qualidade do projeto.
- Toda mudança de código vai para a branch `Desenvolvimento` e chega à produção (`main`) só por Pull Request, com a verificação automática verde.
- Ações que envolvem senha, chave secreta, criação de conta ou pagamento são do Antonio; o restante é preparado com passo a passo e link.

## Situação dos 34 itens

| # | Problema | Nível | Situação | Prova ou o que falta |
| --- | --- | --- | --- | --- |
| 1 | Chave mestra exposta | Urgente | Feito | Chaves legadas desativadas e segredo JWT revogado; a chave vazada recebe 401 em todos os testes |
| 2 | Envio de e-mail aberto | Urgente | Feito | `send-email` desativada; responde 410 (log de 06/11 15:29) |
| 3 | Repositório público com chaves no histórico | Urgente | Feito | Todas as chaves do histórico estão revogadas; repositório segue público por decisão (ver item 29) |
| 4 | E-mail de novas contas não chega | Urgente | Feito | Convite pelo painel admin testado em produção em 08/11: e-mail enviado |
| 5 | Painel altera o usuário errado | Urgente | Feito | Testado em 08/11: recadastro mudou só o usuário-alvo, nenhuma outra conta |
| 6 | Lista de usuários completa | Alto | Feito | Teste como usuário comum: 0 perfis de outros visíveis |
| 7 | Regras de acesso incompletas | Alto | Feito | RLS em todas as tabelas; acesso sem login devolve 401 ou vazio |
| 8 | Usuário se promove sozinho | Alto | Feito | Trava no banco; teste bloqueou virar admin, trocar plano e renovar teste |
| 9 | Plano Pro e teste burláveis | Alto | Feito | Função `tem_acesso()` no banco, incluindo conta bloqueada |
| 10 | XSS em nomes | Alto | Feito | Escape no admin e no app; testado com nome malicioso |
| 11 | Logo só no navegador | Alto | Pendente | Guardar logo no Supabase Storage e nome da empresa no banco |
| 12 | Sem servidor próprio | Alto | Feito | Backend Python no Render (moneyflow3d-api.onrender.com) desde 08/11; publica a cada merge na main |
| 13 | Sem backup automático | Alto | Feito | Backup diário criptografado ativo; primeira execução em 08/11 com sucesso (27,4 KB, guardado 30 dias) |
| 14 | Sem ambiente de testes | Alto | Feito | 09–10/11: Supabase `moneyflow3d-dev` (estrutura copiada pela rotina do GitHub, sem dados), API https://moneyflow3d-api-dev.onrender.com e site https://moneyflow3d-web-dev.onrender.com ligados à branch `Desenvolvimento`; permissões conferidas iguais às de produção. Webhook e admin de teste na homologação desde 10/11 |
| 15 | Código no ar diferente do guardado | Alto | Feito | `webhook-kiwify` no ar = GitHub (conferido por hash a cada publicação); 4 funções esquecidas apagadas; cópia antiga e aberta da `send-email` removida do GitHub (no ar ela só responde 410) |
| 16 | App em um arquivo de 5 mil linhas | Alto | Pendente | Dividir em módulos |
| 17 | Fórmula sem testes | Alto | Feito | Fórmula em Python com teste de paridade: 503 casos contra o JavaScript real; teste de mutação confirmou (08/11) |
| 18 | Chave antiga do Resend no código | Moderado | Feito | Removida do `admin.html`; varredura automática bloqueia chaves em todo PR |
| 19 | Recuperação de senha improvisada | Moderado | Feito | Recuperação pelo backend em produção; e-mail entregue (Resend, 08/11); erro de configuração não fica silencioso |
| 20 | Biometria só visual | Moderado | Pendente | Decidir: login real por passkey ou renomear para bloqueio de tela |
| 21 | Sem cabeçalhos de segurança | Moderado | Pendente | Cloudflare com proxy ligado e regras de cabeçalho |
| 22 | Bibliotecas sem versão fixa | Moderado | Parcial | supabase-js 2.118.0 e jsPDF 2.5.1 fixos com SRI, em produção; falta atualizar o jsPDF para 4.x |
| 23 | Sem Política de Privacidade e Termos | Moderado | Pendente | Textos LGPD (revisão jurídica recomendada) |
| 24 | Preços repetidos e MRR errado | Moderado | Pendente | Planos e preços num único lugar, servidos pelo backend |
| 25 | 245 onclick no HTML | Moderado | Pendente | Trocar por eventos registrados no JavaScript |
| 26 | Sem verificação automática | Moderado | Feito | GitHub Actions: JS, IDs, segredos e testes do backend em todo PR |
| 27 | Sem monitoramento de erros | Moderado | Pendente | Sentry (plano gratuito) no front e no backend |
| 28 | Publicação manual direto no ar | Moderado | Feito | `main` protegida; push direto recusado e PR #2 mesclado com verificação verde (08/11) |
| 29 | Hospedagem limitada | Moderado | Pendente | Decidir: GitHub Pages + Cloudflare na frente, ou Cloudflare Pages |
| 30 | Funções esquecidas no servidor | Moderado | Feito | 09/11: código revisado (sem segredo escrito; `bright-api` mostrava o início da chave mestra, `admin-ops` enviava e-mail livre) e as 4 apagadas com autorização; restam só `webhook-kiwify` e `send-email` (desativada) |
| 31 | Commits sem descrição | Baixo | Parcial | Commits descritivos desde 06/11; faltam marcações de versão |
| 32 | Itens do orçamento como texto | Baixo | Pendente | Coluna JSON estruturada e erro visível na leitura |
| 33 | DMARC em observação | Baixo | Pendente | Subir para `quarantine` depois de 2 semanas de relatórios limpos |
| 34 | Zoom bloqueado no celular | Baixo | Feito | Removido `maximum-scale`; em produção desde 08/11 |

Encontrados durante o trabalho, fora da lista original:

| Item | Situação | Detalhe |
| --- | --- | --- |
| Webhook rejeitava toda compra real (esperava `?token=`, a Kiwify envia `?signature=`) | Feito | Teste de compra em 06/11: usuário e assinatura gravados |
| Segredo do webhook gravado no log | Feito | Removido do log |
| Segredo do webhook escrito no código da função | Feito | Lido de `KIWIFY_WEBHOOK_TOKEN` nos Secrets (09/11) |
| Webhook não grava em `webhook_logs` | Feito | Grava evento, e-mail e status, sem CPF/telefone; provado em 09/11 (processed, duplicate) |
| Token do webhook escrito no `admin.html` publicado | Feito | Removido do arquivo (PR #6) e trocado em 09/11: webhook novo "MoneyFlow 3D - Producao" (6 eventos, URL sem token); os 2 antigos apagados; token antigo recusado (testado) |
| Webhook duplicado ("Todos que sou produtor") com token na URL, que aparecia nos logs | Feito | Apagado; a função só aceita assinatura HMAC (`?token=` recusado, testado) |
| Comprador do produto "MoneyFlow 3D Pro" recebia plano `maker` | Feito | Decisão do Antonio (09/11): recebe `pro` |
| E-mail de boas-vindas da compra não saía (chave `RESEND_KEY` inválida desde 01/11) | Feito | Chave nova `supabase_webhook` (só envio) em 09/11; e-mail entregue no teste |
| Se o e-mail falhava, a nova tentativa da Kiwify virava "duplicado" e o cliente nunca recebia o link | Feito | Nova tentativa reenvia só o e-mail; teste automático cobre o caso |
| Reembolso, chargeback e cancelamento não tiram o acesso | Feito | Regra do Antonio (09/11): reembolso e chargeback bloqueiam na hora; cancelamento mantém até o fim do período pago; pagamento atrasado bloqueia na hora e o pagamento depois reativa (rotina `expirar-planos` de hora em hora + `tem_acesso` respeita `plan_expires_at`). Provado em produção: compra → renovação → cancelamento (pro até 29/11) → reembolso (free na hora) |
| Renovação mensal criaria assinatura nova e reenviaria boas-vindas | Feito | Assinatura ligada à da Kiwify (`external_subscription_id`); renovação reativa a mesma |
| 12 assinaturas "ativas" sem usuário (pedidos de teste de jul e nov) | Feito | Apagadas com autorização do Antonio em 09/11; restam 6 assinaturas reais ativas |
| Usuário de teste `@example.com` no banco | Feito | Removido em 08/11 |
| Backend e admin sem permissão no banco (`permission denied`) | Feito | Permissões restauradas em 08/11; telas de Logs, Webhooks, Módulos e Assinaturas voltaram |
| Exclusão mostrava erro mesmo concluída | Feito | Corrigido no PR #4 |
| `/auth/recover` devolvia 502 sem registrar a causa | Feito | PR #11: resposta do Supabase/Resend vai para o log (foi assim que se achou a chave antiga ainda no Render) |
| Chaves sobrando: Resend "MoneyFlow3D Webhook" (acesso total, era das funções apagadas) e "Onboarding"; secret `RESEND_API_KEY` no Supabase sem uso | Feito | Apagadas com autorização em 09/11; compra de teste depois disso enviou o e-mail normalmente |

## Arquitetura: frontend e backend Python

O frontend fica só com tela e chave pública; tudo que exige privilégio ou regra de negócio vai para o backend Python (FastAPI). O backend existe em `backend/`, com testes automáticos.

```
Navegador (index.html, admin.html, lp.html) — só chave pública
   │ token de login                         │ compra na Kiwify
   ▼                                        ▼
Backend Python · FastAPI · Render       Webhook Kiwify (Edge Function)
  guarda a secret key, confere            assinatura HMAC validada
  login e role=admin                      e-mail de boas-vindas
   │ e-mail          │ secret key             │ grava acesso
   ▼                 ▼                        ▼
 Resend          Supabase (banco com RLS, Auth, Storage)
```

O app continua lendo os dados do próprio usuário direto no Supabase, protegido pelo RLS; o backend entra onde o RLS não basta.

| O que vai para o backend Python | Situação |
| --- | --- |
| Criar e excluir usuário, enviar link de acesso | Feito, falta publicar |
| Recuperar senha (`/auth/recover`) | Fase 1 |
| Planos e preços num único lugar, MRR correto | Fase 3 |
| Fórmula de precificação com testes (resultado idêntico ao atual) | Fase 3 |
| Upload da logo da empresa | Fase 3 |
| Webhook da Kiwify | Fase 3 |

## Ambientes e fluxo Git

GitHub Flow com uma branch de homologação: a `Desenvolvimento` recebe o trabalho e a `main` é produção.

| Ambiente | Branch | Site | Backend Python | Banco Supabase | Situação |
| --- | --- | --- | --- | --- | --- |
| Desenvolvimento | `Desenvolvimento` | Local | Local, com testes automáticos | Projeto de homologação | Pronto, exceto o banco |
| Homologação | `Desenvolvimento`, publicada | Endereço de prévia | Serviço de homologação no Render | Novo projeto `moneyflow3d-dev` | Pendente (fase 2) |
| Produção | `main` (protegida) | moneyflow3d.com.br | Serviço de produção no Render | Projeto atual (São Paulo) | Site no ar; backend pendente (fase 1) |

1. Alterar na branch `Desenvolvimento`.
2. A verificação automática roda a cada envio (JS, IDs, segredos e testes do backend).
3. Conferir no ambiente de homologação, com dados de teste.
4. Abrir o Pull Request `Desenvolvimento → main` em https://github.com/meshittecnologia-hue/moneyflow3d/compare/main...Desenvolvimento
5. Com a verificação verde, clicar em **Merge pull request**.

Alterações no banco: o SQL vai para `supabase/migrations/`, roda primeiro em homologação e depois em produção.

## Cronograma

| Fase | Período | Pronta quando |
| --- | --- | --- |
| 0 · Emergência | 04/11 a 08/11 · feita | Chave vazada morta; RLS, XSS e webhook corrigidos |
| 1 · Backend no ar | 09/11 a 15/11 | Admin cria usuário e o e-mail chega |
| 2 · Homologação e proteção | 16/11 a 22/11 | Toda mudança passa antes pela homologação |
| 3 · Regras no backend Python | 23/11 a 06/12 | Fórmula em Python dá resultado idêntico |
| 4 · Frontend organizado | 07/12 a 13/12 | index.html em módulos, sem onclick |
| 5 · LGPD e entrega | 14/12 a 19/12 | Os 34 itens têm prova de conclusão |

**Fase 1 · Backend no ar**

- [x] 1.1 Criar a secret key nova do Supabase e a chave nova do Resend · itens 4 e 18 (08/11, `backend_render`)
- [x] 1.2 Publicar o backend no Render · item 12 (08/11, https://moneyflow3d-api.onrender.com)
- [x] 1.3 Ligar o painel admin e o app ao backend por Pull Request · itens 4, 5 e 19 (PR #3, 08/11)
- [x] 1.4 Recuperação de senha `/auth/recover`, com limite de tentativas · item 19 (08/11, PR #2; ativa no 1.3)
- [x] 1.5 Webhook: segredo para os segredos do Supabase, gravar em `webhook_logs`, código no GitHub · item 15 (09/11, PR #6; 9 testes no CI)
- [x] 1.6 Baixar o código das 4 funções esquecidas, revisar e remover · item 30 (09/11)
- [x] 1.7 Remover o usuário de teste `@example.com` (08/11)
- [x] 1.8 Testar pelo painel admin · itens 4 e 5 (08/11; corrigidos no caminho: permissões do banco e exclusão, PR #4)

**Fase 2 · Homologação e proteção**

- [x] 2.1 Projeto Supabase `moneyflow3d-dev` com a mesma estrutura de banco · item 14 (09/11; rotina "Homologação — copiar estrutura do banco", PR #12/#13)
- [x] 2.2 Backend e site de homologação a partir da branch `Desenvolvimento` · item 14 (10/11, PR #14)
- [x] 2.2b Webhook da Kiwify na homologação (função + segredos no `moneyflow3d-dev`) e um usuário admin de teste (10/11; compra de teste com e-mail apontando para o site de testes; primeira mudança a passar pelo fluxo homologação → PR #15 → produção)

**Como testar daqui em diante:** mudança vai para a branch `Desenvolvimento` → o Render publica sozinho em https://moneyflow3d-web-dev.onrender.com (faixa amarela) e na API de homologação → testar lá → Pull Request para `main` → produção. Para alinhar o banco de homologação com a produção: GitHub → Actions → "Homologação — copiar estrutura do banco" → Run workflow → digitar `HOMOLOGACAO` (apaga os dados de teste da homologação).
- [ ] 2.3 Proxy do Cloudflare e cabeçalhos de segurança · itens 21 e 29
- [x] 2.4 Backup diário do banco por GitHub Actions · item 13 (ativo desde 08/11)
- [x] 2.5 Liberar o zoom no celular · item 34 (08/11)
- [x] 2.6 Trocar credenciais expostas (09/11): senha do banco (backup testado), Supabase `backend_render_v2` e Resend `backend_render_v2` no Render (recuperação de senha testada), Resend `supabase_webhook_v2` no webhook (compra testada), token da Kiwify; antigas apagadas. Valores em `claude/credenciais.md` (decisão do Antonio)

**Fase 3 · Regras no backend Python**

- [x] 3.1 Fórmula de precificação em Python com testes de paridade; a fórmula não muda · item 17 (08/11)
- [ ] 3.2 Planos e preços num só lugar; MRR correto no admin · item 24
- [ ] 3.3 Logo e nome da empresa salvos no Supabase · item 11
- [ ] 3.4 Itens do orçamento como dado estruturado · item 32
- [ ] 3.5 Webhook da Kiwify migrado para o Python

**Fase 4 · Frontend organizado**

- [ ] 4.1 Dividir o `index.html` em módulos · item 16
- [ ] 4.2 Trocar os 245 onclick por eventos no JavaScript · item 25
- [ ] 4.3 Fixar versões das bibliotecas e atualizar o jsPDF · item 22 (versões fixas com SRI em 08/11; falta jsPDF 4.x)
- [ ] 4.4 Monitoramento de erros (Sentry) · item 27
- [ ] 4.5 Biometria: aplicar a decisão tomada · item 20

**Fase 5 · LGPD e entrega**

- [ ] 5.1 Política de Privacidade e Termos de Uso · item 23
- [ ] 5.2 Marcação de versões (v1.0.0) · item 31
- [ ] 5.3 DMARC de `p=none` para `quarantine` · item 33
- [ ] 5.4 Revisão final: cada um dos 34 itens com prova

## Decisões pendentes

| Decisão | Recomendação | Precisa até |
| --- | --- | --- |
| Hospedagem do site (item 29) | Cloudflare na frente do GitHub Pages; não esconde o código do navegador, só adiciona proteções | Fase 2 |
| Repositório público ou privado (item 3) | Manter público: chaves do histórico revogadas; privado no plano gratuito desativa o GitHub Pages | Fase 2 |
| Hospedagem do backend | Render gratuito agora; Railway (~US$ 5/mês) com o primeiro cliente pagante | Primeiro cliente |
| Biometria (item 20) | Renomear para bloqueio de tela; passkey real só se clientes pedirem | Fase 4 |
| Política de Privacidade e Termos (item 23) | Rascunho preparado; revisão por advogado antes de publicar | Fase 5 |
| Vendas na Kiwify | Podem ficar ativas: webhook testado e liberando acesso | Já |
