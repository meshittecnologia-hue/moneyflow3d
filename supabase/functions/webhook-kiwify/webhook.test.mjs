// Testes do webhook-kiwify sem rede: simula Deno, Supabase (com um banco em memória), Resend e a Kiwify.
// Rodar: node --experimental-strip-types --no-warnings --test supabase/functions/webhook-kiwify/webhook.test.mjs
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const TOKEN = "token-de-teste";
let handler;
let env;
let calls;
let fail; // { "POST /rest/v1/subscriptions": 500 }
let db; // { users, profiles, subscriptions, logs }

globalThis.Deno = {
  env: { get: (k) => env[k] },
  serve: (fn) => { handler = fn; },
};

// Filtros PostgREST simples: col=eq.x, col=neq.x, payload->>k=eq.x
function filtrar(rows, params) {
  return rows.filter((r) => {
    for (const [k, v] of params) {
      if (["select", "order", "limit"].includes(k)) continue;
      const [op, ...rest] = v.split(".");
      const val = decodeURIComponent(rest.join("."));
      const atual = k.includes("->>") ? r[k.split("->>")[0]]?.[k.split("->>")[1]] : r[k];
      if (op === "eq" && String(atual) !== val) return false;
      if (op === "neq" && String(atual) === val) return false;
    }
    return true;
  });
}

globalThis.fetch = async (url, opt = {}) => {
  const u = new URL(url);
  const method = opt.method || "GET";
  const key = `${method} ${u.pathname}`;
  const body = opt.body ? JSON.parse(opt.body) : null;
  calls.push({ key, url: String(url), body });
  if (fail[key]) return new Response(JSON.stringify({ message: "falhou" }), { status: fail[key] });
  const params = [...u.searchParams.entries()];
  const tabela = { subscriptions: db.subscriptions, profiles: db.profiles, webhook_logs: db.logs }[u.pathname.split("/").pop()];

  if (key === "GET /auth/v1/admin/users") {
    const page = Number(u.searchParams.get("page"));
    return Response.json({ users: db.users.slice((page - 1) * 200, page * 200) });
  }
  if (key === "POST /auth/v1/admin/users") {
    const novo = { id: "novo-id", email: body.email };
    db.users.push(novo);
    db.profiles.push({ id: "novo-id", role: "user", plan: "free", plan_expires_at: null });
    return Response.json(novo);
  }
  if (key === "POST /auth/v1/admin/generate_link") return Response.json({ action_link: "https://link" });
  if (key === "POST /emails") return Response.json({ id: "e1" });
  if (tabela && method === "GET") {
    let r = filtrar(tabela, params);
    if (u.searchParams.get("order") === "created_at.desc") r = [...r].reverse();
    const lim = Number(u.searchParams.get("limit") || 0);
    return Response.json(lim ? r.slice(0, lim) : r);
  }
  if (tabela && method === "POST") {
    const row = { id: tabela === db.logs ? db.logs.length + 1 : "s" + (tabela.length + 1), ...body };
    tabela.push(row);
    return Response.json([row], { status: 201 });
  }
  if (tabela && method === "PATCH") {
    for (const r of filtrar(tabela, params)) Object.assign(r, body);
    return new Response(null, { status: 204 });
  }
  return new Response("rota não simulada: " + key, { status: 599 });
};

env = { KIWIFY_WEBHOOK_TOKEN: TOKEN, RESEND_KEY: "re_x", SUPABASE_URL: "https://sb.test", SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_x" }) };
await import("./index.ts");

function pedido(extra = {}) {
  return {
    order_id: "ped-1", order_ref: "ABC", order_status: "paid", webhook_event_type: "order_approved",
    subscription_id: "assin-k1",
    Subscription: { id: "assin-k1", next_payment: "2026-12-09T10:00:00.000Z" },
    Product: { product_name: "MoneyFlow 3D Pro", metadata: { plan: "pro" } },
    Customer: { email: "Cliente@X.com", full_name: "<b>Cliente</b>", CPF: "12345678900", mobile: "+5562999999999" },
    Commissions: { charge_amount: 2350 },
    ...extra,
  };
}

async function enviar(body, { assinatura } = {}) {
  const raw = JSON.stringify(body);
  const sig = assinatura ?? createHmac("sha1", TOKEN).update(raw).digest("hex");
  return handler(new Request(`https://fn.test/webhook-kiwify?signature=${sig}`, { method: "POST", body: raw }));
}

const feitas = (k) => calls.filter((c) => c.key === k);
const ultimoLog = () => db.logs.at(-1);
const perfil = (id) => db.profiles.find((p) => p.id === id);

// Cliente que já comprou: usuário, perfil pro e assinatura ativa ligada à assinatura da Kiwify.
function clienteAtivo() {
  db.users.push({ id: "u1", email: "cliente@x.com" });
  db.profiles.push({ id: "u1", role: "user", plan: "pro", plan_expires_at: null });
  db.subscriptions.push({ id: "s-1", user_id: "u1", external_id: "ped-1", external_subscription_id: "assin-k1", plan: "pro", status: "active", started_at: "2026-11-09T10:00:00Z", next_billing_at: "2026-12-09T10:00:00Z" });
}

beforeEach(() => {
  calls = []; fail = {};
  db = { users: [], profiles: [], subscriptions: [], logs: [] };
});

// ---------- Compra ----------
test("assinatura inválida: 401 e nada é gravado", async () => {
  const r = await enviar(pedido(), { assinatura: "abc" });
  assert.equal(r.status, 401);
  assert.equal(calls.length, 0);
});

test("compra aprovada de cliente novo: usuário, assinatura, plano, e-mail e histórico sem CPF", async () => {
  const r = await enviar(pedido());
  assert.equal(r.status, 200);
  assert.equal(feitas("POST /auth/v1/admin/users").length, 1);
  const sub = db.subscriptions[0];
  assert.equal(sub.plan, "pro");
  assert.equal(sub.external_subscription_id, "assin-k1");
  assert.equal(sub.next_billing_at, "2026-12-09T10:00:00.000Z");
  assert.equal(perfil("novo-id").plan, "pro");
  assert.ok(!feitas("POST /emails")[0].body.html.includes("<b>Cliente</b>"), "nome escapado");
  const texto = JSON.stringify(db.logs);
  assert.ok(!texto.includes("12345678900") && !texto.includes("99999"), "CPF e telefone fora do histórico");
  assert.equal(ultimoLog().status, "processed");
});

test("cliente já existe na página 2: não cria outro usuário", async () => {
  db.users = Array.from({ length: 200 }, (_, i) => ({ id: "x" + i, email: `outro${i}@x.com` }));
  db.users.push({ id: "alvo", email: "cliente@x.com" });
  db.profiles.push({ id: "alvo", role: "user", plan: "free" });
  const r = await enviar(pedido());
  assert.equal(r.status, 200);
  assert.equal(feitas("POST /auth/v1/admin/users").length, 0);
  assert.equal(perfil("alvo").plan, "pro");
});

test("pagamento pendente: ignorado", async () => {
  const r = await enviar(pedido({ order_status: "waiting_payment", webhook_event_type: "billet_created" }));
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions.length, 0);
  assert.equal(ultimoLog().status, "ignored");
});

test("falha ao gravar assinatura: 500 (Kiwify tenta de novo) e histórico com erro", async () => {
  fail["POST /rest/v1/subscriptions"] = 500;
  const r = await enviar(pedido());
  assert.equal(r.status, 500);
  assert.equal(feitas("POST /emails").length, 0);
  assert.equal(ultimoLog().status, "error");
});

test("mesma compra já processada: duplicado, nada de novo", async () => {
  await enviar(pedido());
  calls = [];
  const r = await enviar(pedido());
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions.length, 1);
  assert.equal(feitas("POST /emails").length, 0);
  assert.equal(ultimoLog().status, "duplicate");
});

test("e-mail falhou na compra: a nova tentativa reenvia só o e-mail", async () => {
  fail["POST /emails"] = 401;
  assert.equal((await enviar(pedido())).status, 500);
  delete fail["POST /emails"];
  calls = [];
  const r = await enviar(pedido());
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions.length, 1);
  assert.equal(feitas("POST /emails").length, 1);
  assert.equal(ultimoLog().status, "processed");
});

test("falha no histórico não derruba a liberação do acesso", async () => {
  fail["POST /rest/v1/webhook_logs"] = 500;
  const r = await enviar(pedido());
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions.length, 1);
});

// ---------- Reembolso e chargeback: bloqueia na hora ----------
test("reembolso: assinatura refunded e acesso bloqueado na hora", async () => {
  clienteAtivo();
  const r = await enviar(pedido({ order_status: "refunded", webhook_event_type: "order_refunded" }));
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions[0].status, "refunded");
  assert.ok(db.subscriptions[0].cancelled_at);
  assert.equal(perfil("u1").plan, "free");
  assert.equal(ultimoLog().status, "processed");
  assert.equal(feitas("POST /emails").length, 0);
});

test("chargeback: assinatura chargeback e acesso bloqueado", async () => {
  clienteAtivo();
  const r = await enviar(pedido({ order_status: "chargedback", webhook_event_type: "chargeback" }));
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions[0].status, "chargeback");
  assert.equal(perfil("u1").plan, "free");
});

test("reembolso de admin ou plano interno não tira o acesso", async () => {
  clienteAtivo();
  perfil("u1").plan = "interno";
  await enviar(pedido({ order_status: "refunded", webhook_event_type: "order_refunded" }));
  assert.equal(db.subscriptions[0].status, "refunded");
  assert.equal(perfil("u1").plan, "interno");
});

test("reembolso de um pedido com outra assinatura ativa: mantém o acesso", async () => {
  clienteAtivo();
  db.subscriptions.push({ id: "s-2", user_id: "u1", external_id: "ped-2", plan: "pro", status: "active" });
  await enviar(pedido({ order_status: "refunded", webhook_event_type: "order_refunded" }));
  assert.equal(db.subscriptions[0].status, "refunded");
  assert.equal(perfil("u1").plan, "pro");
});

test("reembolso sem assinatura conhecida: registrado como not_found, sem mexer em ninguém", async () => {
  const r = await enviar(pedido({ order_id: "desconhecido", subscription_id: "", Subscription: {}, order_status: "refunded", webhook_event_type: "order_refunded" }));
  assert.equal(r.status, 200);
  assert.equal(ultimoLog().status, "not_found");
});

// ---------- Cancelamento: usa até o fim do período pago ----------
test("cancelamento: assinatura cancelada, acesso mantido até o fim do período", async () => {
  clienteAtivo();
  const fim = new Date(Date.now() + 20 * 864e5).toISOString();
  const r = await enviar(pedido({ webhook_event_type: "subscription_canceled", Subscription: { id: "assin-k1", next_payment: fim } }));
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions[0].status, "cancelled");
  assert.equal(perfil("u1").plan, "pro", "continua com acesso");
  assert.equal(perfil("u1").plan_expires_at, fim);
});

test("cancelamento usa o access_until da Kiwify quando vem no evento", async () => {
  clienteAtivo();
  const fim = new Date(Date.now() + 5 * 864e5).toISOString();
  await enviar(pedido({ webhook_event_type: "subscription_canceled", Subscription: { id: "assin-k1", next_payment: null, customer_access: { access_until: fim } } }));
  assert.equal(perfil("u1").plan_expires_at, fim);
});

test("cancelamento com período já vencido: bloqueia na hora", async () => {
  clienteAtivo();
  db.subscriptions[0].next_billing_at = "2026-01-01T00:00:00Z";
  await enviar(pedido({ webhook_event_type: "subscription_canceled", Subscription: { id: "assin-k1" } }));
  assert.equal(db.subscriptions[0].status, "cancelled");
  assert.equal(perfil("u1").plan, "free");
});

test("atraso: assinatura overdue e acesso bloqueado na hora", async () => {
  clienteAtivo();
  await enviar(pedido({ webhook_event_type: "subscription_late", order_status: "waiting_payment" }));
  assert.equal(db.subscriptions[0].status, "overdue");
  assert.equal(perfil("u1").plan, "free");
});

test("atrasou e pagou depois: a cobrança paga reativa o acesso", async () => {
  clienteAtivo();
  await enviar(pedido({ webhook_event_type: "subscription_late", order_status: "waiting_payment" }));
  assert.equal(perfil("u1").plan, "free");
  const r = await enviar(pedido({ order_id: "ped-atrasado-pago", webhook_event_type: "order_approved" }));
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions.length, 1);
  assert.equal(db.subscriptions[0].status, "active");
  assert.equal(perfil("u1").plan, "pro");
  assert.equal(feitas("POST /emails").length, 0);
});

// ---------- Renovação ----------
test("renovação: reativa a mesma assinatura, sem criar outra e sem e-mail", async () => {
  clienteAtivo();
  db.subscriptions[0].status = "cancelled";
  perfil("u1").plan_expires_at = "2026-12-01T00:00:00Z";
  const r = await enviar(pedido({ order_id: "ped-renovacao", webhook_event_type: "subscription_renewed", Subscription: { id: "assin-k1", next_payment: "2027-01-09T10:00:00.000Z" } }));
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions.length, 1);
  assert.equal(db.subscriptions[0].status, "active");
  assert.equal(db.subscriptions[0].next_billing_at, "2027-01-09T10:00:00.000Z");
  assert.equal(perfil("u1").plan_expires_at, null);
  assert.equal(feitas("POST /emails").length, 0);
});

test("cobrança paga de assinatura já existente (order_approved da renovação): não duplica nem reenvia boas-vindas", async () => {
  clienteAtivo();
  const r = await enviar(pedido({ order_id: "ped-mes-2" }));
  assert.equal(r.status, 200);
  assert.equal(db.subscriptions.length, 1);
  assert.equal(feitas("POST /emails").length, 0);
});
