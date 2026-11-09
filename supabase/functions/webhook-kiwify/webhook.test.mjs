// Testes do webhook-kiwify sem rede: simula Deno, Supabase, Resend e a Kiwify.
// Rodar: node --experimental-strip-types --test supabase/functions/webhook-kiwify/webhook.test.mjs
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const TOKEN = "token-de-teste";
let handler;
let env;
let calls;
let fail; // { "POST /rest/v1/subscriptions": 500 }
let users; // usuários do Auth, em páginas de 200

globalThis.Deno = {
  env: { get: (k) => env[k] },
  serve: (fn) => { handler = fn; },
};

globalThis.fetch = async (url, opt = {}) => {
  const u = new URL(url);
  const method = opt.method || "GET";
  const key = `${method} ${u.pathname}`;
  calls.push({ key, url: String(url), body: opt.body ? JSON.parse(opt.body) : null, headers: opt.headers });
  if (fail[key]) return new Response(JSON.stringify({ message: "falhou" }), { status: fail[key] });
  if (key === "GET /auth/v1/admin/users") {
    const page = Number(u.searchParams.get("page"));
    return Response.json({ users: users.slice((page - 1) * 200, page * 200) });
  }
  if (key === "POST /auth/v1/admin/users") return Response.json({ id: "novo-id", email: calls.at(-1).body.email });
  if (key === "POST /auth/v1/admin/generate_link") return Response.json({ action_link: "https://link" });
  if (key === "GET /rest/v1/subscriptions") return Response.json([]);
  if (key === "POST /rest/v1/webhook_logs") return Response.json([{ id: 42 }], { status: 201 });
  if (key === "POST /rest/v1/subscriptions") return Response.json([{ id: "s1" }], { status: 201 });
  if (key.startsWith("PATCH ")) return new Response(null, { status: 204 });
  if (key === "POST /emails") return Response.json({ id: "e1" });
  return new Response("rota não simulada: " + key, { status: 599 });
};

env = { KIWIFY_WEBHOOK_TOKEN: TOKEN, RESEND_KEY: "re_x", SUPABASE_URL: "https://sb.test", SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_x" }) };
await import("./index.ts");

function pedido(extra = {}) {
  return {
    order_id: "ped-1", order_ref: "ABC", order_status: "paid", webhook_event_type: "order_approved",
    Product: { product_name: "MoneyFlow 3D Pro", metadata: { plan: "pro" } },
    Customer: { email: "Cliente@X.com", full_name: "<b>Cliente</b>", CPF: "12345678900", mobile: "+5562999999999" },
    Commissions: { charge_amount: 2350 },
    ...extra,
  };
}

async function enviar(body, { assinar = true, assinatura } = {}) {
  const raw = JSON.stringify(body);
  const sig = assinatura ?? (assinar ? createHmac("sha1", TOKEN).update(raw).digest("hex") : "");
  const req = new Request(`https://fn.test/webhook-kiwify?signature=${sig}`, { method: "POST", body: raw });
  return handler(req);
}

const feitas = (k) => calls.filter((c) => c.key === k);

beforeEach(() => {
  calls = []; fail = {}; users = [];
  env.KIWIFY_WEBHOOK_TOKEN = TOKEN;
});

test("assinatura inválida: 401 e nada é gravado", async () => {
  const r = await enviar(pedido(), { assinatura: "abc" });
  assert.equal(r.status, 401);
  assert.equal(calls.length, 0);
});

test("compra aprovada de cliente novo: cria usuário, assinatura, plano, e-mail e histórico", async () => {
  const r = await enviar(pedido());
  assert.equal(r.status, 200);
  assert.equal(feitas("POST /auth/v1/admin/users").length, 1);
  const sub = feitas("POST /rest/v1/subscriptions")[0].body;
  assert.equal(sub.plan, "pro");
  assert.equal(sub.amount, 2350);
  assert.equal(feitas("PATCH /rest/v1/profiles")[0].body.plan, "pro");
  const email = feitas("POST /emails")[0].body;
  assert.ok(!email.html.includes("<b>Cliente</b>"), "nome escapado no e-mail");
  const log = feitas("POST /rest/v1/webhook_logs")[0].body;
  assert.equal(log.event, "order_approved");
  assert.equal(log.email, "Cliente@X.com");
  assert.equal(log.status, "received");
  const texto = JSON.stringify(log);
  assert.ok(!texto.includes("12345678900") && !texto.includes("99999"), "CPF e telefone não vão para o histórico");
  assert.equal(feitas("PATCH /rest/v1/webhook_logs").at(-1).body.status, "processed");
});

test("cliente já existe na página 2: não cria outro usuário", async () => {
  users = Array.from({ length: 200 }, (_, i) => ({ id: "u" + i, email: `outro${i}@x.com` }));
  users.push({ id: "alvo", email: "cliente@x.com" });
  const r = await enviar(pedido());
  assert.equal(r.status, 200);
  assert.equal(feitas("POST /auth/v1/admin/users").length, 0);
  assert.ok(feitas("PATCH /rest/v1/profiles")[0].url.includes("eq.alvo"));
});

test("pagamento pendente: 200, histórico marcado como ignorado", async () => {
  const r = await enviar(pedido({ order_status: "waiting_payment", webhook_event_type: "billet_created" }));
  assert.equal(r.status, 200);
  assert.equal(feitas("POST /rest/v1/subscriptions").length, 0);
  assert.equal(feitas("PATCH /rest/v1/webhook_logs").at(-1).body.status, "ignored");
});

test("falha ao gravar assinatura: 500 (Kiwify tenta de novo) e histórico com erro", async () => {
  fail["POST /rest/v1/subscriptions"] = 500;
  const r = await enviar(pedido());
  assert.equal(r.status, 500);
  assert.equal(feitas("POST /emails").length, 0);
  assert.equal(feitas("PATCH /rest/v1/webhook_logs").at(-1).body.status, "error");
});

test("pedido duplicado: não processa de novo", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {
    if ((opt.method || "GET") === "GET" && new URL(url).pathname === "/rest/v1/subscriptions") {
      calls.push({ key: "GET /rest/v1/subscriptions" });
      return Response.json([{ id: "já" }]);
    }
    return orig(url, opt);
  };
  try {
    const r = await enviar(pedido());
    assert.equal(r.status, 200);
    assert.equal(feitas("POST /rest/v1/subscriptions").length, 0);
    assert.equal(feitas("PATCH /rest/v1/webhook_logs").at(-1).body.status, "duplicate");
  } finally {
    globalThis.fetch = orig;
  }
});

test("falha no histórico não derruba a liberação do acesso", async () => {
  fail["POST /rest/v1/webhook_logs"] = 500;
  const r = await enviar(pedido());
  assert.equal(r.status, 200);
  assert.equal(feitas("POST /rest/v1/subscriptions").length, 1);
});
