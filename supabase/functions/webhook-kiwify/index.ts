// webhook-kiwify — MoneyFlow 3D
// Recebe os eventos da Kiwify, libera o acesso na compra aprovada e grava o histórico.
//
// Segredos (Supabase → Edge Functions → Secrets), nunca no código:
//   KIWIFY_WEBHOOK_TOKEN  token do webhook cadastrado na Kiwify
//   RESEND_KEY            chave do Resend (e-mail de boas-vindas)
//   SUPABASE_SECRET_KEYS  injetada pelo Supabase
//   APP_URL               (opcional) endereço do site; padrão https://moneyflow3d.com.br
// Verify JWT precisa ficar DESLIGADO (a Kiwify não manda JWT).

const WEBHOOK_TOKEN = Deno.env.get("KIWIFY_WEBHOOK_TOKEN") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ?? "";
// Endereço do site nos links do e-mail. Homologação define APP_URL nos Secrets; produção usa o padrão.
const APP_URL = (Deno.env.get("APP_URL") || "https://moneyflow3d.com.br").replace(/\/$/, "");

const PLAN_LABELS: Record<string, string> = { maker: "Maker", pro: "Pro", free: "Free" };

// Erro de gravação não pode passar em silêncio: lança, o webhook responde 500 e a Kiwify tenta de novo.
async function sbFetch(path: string, method = "GET", body?: unknown) {
  const res = await fetch(SUPABASE_URL + path, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} -> HTTP ${res.status}: ${text.slice(0, 200)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Procura pelo e-mail EXATO em todas as páginas (antes olhava só os 50 primeiros).
async function getUserByEmail(email: string) {
  const alvo = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page++) {
    const data = await sbFetch(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = data?.users ?? [];
    const exato = users.find((u: { email?: string }) => (u.email ?? "").toLowerCase() === alvo);
    if (exato) return exato;
    if (users.length < 200) return null;
  }
  return null;
}

async function createUser(email: string, name: string) {
  return await sbFetch("/auth/v1/admin/users", "POST", {
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: name },
  });
}

async function generatePasswordLink(email: string) {
  const data = await sbFetch("/auth/v1/admin/generate_link", "POST", {
    type: "recovery",
    email,
    options: { redirect_to: APP_URL },
  });
  return data?.action_link ?? null;
}

function esc(v: string) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function sendEmail(to: string, name: string, plan: string, link: string) {
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;background:#0a0a0f;color:#e0e0e0;margin:0;padding:20px}
  .card{background:#12121a;border:1px solid #1e1e2e;border-radius:12px;max-width:520px;margin:0 auto;padding:32px}
  h1{color:#a78bfa;margin:0 0 8px}
  .badge{background:#1a1a2e;color:#a78bfa;border:1px solid #7c3aed;padding:4px 14px;border-radius:20px;font-size:13px;display:inline-block;margin-bottom:20px}
  .btn{display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px;font-weight:700;margin:24px 0}
  .footer{margin-top:24px;font-size:12px;color:#666;border-top:1px solid #1e1e2e;padding-top:16px}
</style></head>
<body>
<div class="card">
  <h1>MoneyFlow 3D</h1>
  <span class="badge">Plano ${esc(planLabel)}</span>
  <p>Ola, <strong>${esc(name)}</strong>!</p>
  <p>Sua assinatura foi confirmada. Clique no botao abaixo para criar sua senha e acessar a plataforma:</p>
  <a href="${esc(link)}" class="btn">Criar minha senha e acessar</a>
  <p style="font-size:13px;color:#999">O link expira em 24h. Apos criar sua senha, faca login normalmente em <a href="${APP_URL}" style="color:#a78bfa">${APP_URL.replace("https://", "")}</a>.</p>
  <div class="footer">MoneyFlow 3D - MeshIT Tecnologia | <a href="${APP_URL}" style="color:#a78bfa">${APP_URL.replace("https://", "")}</a></div>
</div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "MoneyFlow 3D <noreply@moneyflow3d.com.br>",
      to: [to],
      subject: `Bem-vindo ao MoneyFlow 3D - Plano ${planLabel}!`,
      html,
    }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Histórico: só o necessário. A Kiwify manda CPF, telefone e endereço — nada disso é guardado.
function resumo(body: Record<string, any>) {
  return {
    order_id: body?.order_id ?? body?.id ?? null,
    order_ref: body?.order_ref ?? null,
    order_status: body?.order_status ?? body?.status ?? null,
    webhook_event_type: body?.webhook_event_type ?? null,
    product: body?.Product?.product_name ?? body?.product?.name ?? null,
    plan: body?.Product?.metadata?.plan ?? body?.product?.metadata?.plan ?? null,
    amount: body?.Commissions?.charge_amount ?? body?.payment?.charge_amount ?? body?.amount ?? null,
    payment_method: body?.payment_method ?? null,
  };
}

async function gravarLog(evento: string, email: string, status: string, body: Record<string, any>) {
  try {
    const row = await sbFetch("/rest/v1/webhook_logs", "POST", {
      platform: "kiwify",
      event: evento || null,
      email: email || null,
      status,
      payload: resumo(body),
    });
    return Array.isArray(row) ? row[0]?.id ?? null : null;
  } catch (e) {
    console.error("Falha ao gravar webhook_logs:", (e as Error).message);
    return null;
  }
}

async function marcarLog(id: number | null, status: string) {
  if (!id) return;
  try {
    await sbFetch(`/rest/v1/webhook_logs?id=eq.${id}`, "PATCH", { status, processed_at: new Date().toISOString() });
  } catch (e) {
    console.error("Falha ao atualizar webhook_logs:", (e as Error).message);
  }
}

async function assinaturaValida(url: URL, req: Request, rawBody: string) {
  if (!WEBHOOK_TOKEN) {
    console.error("KIWIFY_WEBHOOK_TOKEN não configurado nos Secrets da função");
    return false;
  }
  // Kiwify assina o corpo bruto com HMAC-SHA1 usando o token do webhook e envia em ?signature=
  // Token na URL (?token=) não é mais aceito: ele aparecia nos logs do Supabase.
  const signature = (url.searchParams.get("signature") || "").toLowerCase();
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(WEBHOOK_TOKEN), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const esperado = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(rawBody))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return signature.length === 40 && signature === esperado;
}

// ---------- Regras de assinatura ----------
type Sub = { id: string; user_id: string; external_id: string | null; plan: string; status: string; next_billing_at: string | null; started_at: string | null };
type Tipo = "compra" | "renovacao" | "reembolso" | "chargeback" | "cancelamento" | "atraso" | "ignorar";

// O tipo vem primeiro do webhook_event_type (no cancelamento o order_status pode continuar "paid").
function classificar(evento: string, orderStatus: string): Tipo {
  const e = (evento || "").toLowerCase();
  const st = (orderStatus || "").toLowerCase();
  if (e === "order_refunded" || e === "compra_reembolsada" || st === "refunded") return "reembolso";
  if (e === "chargeback" || st === "chargedback" || st === "chargeback") return "chargeback";
  if (e === "subscription_canceled" || e === "subscription_cancelled") return "cancelamento";
  if (e === "subscription_late") return "atraso";
  if (e === "subscription_renewed") return "renovacao";
  if (st === "paid") return "compra";
  return "ignorar";
}

function dataValida(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v).replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function umMesDepois(base: string | null): Date | null {
  const d = dataValida(base);
  if (!d) return null;
  d.setMonth(d.getMonth() + 1);
  return d;
}

async function buscarAssinatura(subId: string, orderId: string, email: string): Promise<Sub | null> {
  const sel = "select=id,user_id,external_id,plan,status,next_billing_at,started_at&order=created_at.desc&limit=1";
  if (subId) {
    const r = await sbFetch(`/rest/v1/subscriptions?external_subscription_id=eq.${encodeURIComponent(subId)}&${sel}`);
    if (Array.isArray(r) && r[0]) return r[0];
  }
  if (orderId) {
    const r = await sbFetch(`/rest/v1/subscriptions?external_id=eq.${encodeURIComponent(orderId)}&${sel}`);
    if (Array.isArray(r) && r[0]) return r[0];
  }
  if (email) {
    const u = await getUserByEmail(email);
    if (u?.id) {
      const r = await sbFetch(`/rest/v1/subscriptions?user_id=eq.${u.id}&status=eq.active&platform=eq.kiwify&${sel}`);
      if (Array.isArray(r) && r[0]) return r[0];
    }
  }
  return null;
}

// Admin e plano interno nunca perdem acesso por evento da Kiwify.
async function perfilProtegido(userId: string) {
  const r = await sbFetch(`/rest/v1/profiles?id=eq.${userId}&select=role,plan`);
  const p = Array.isArray(r) ? r[0] : null;
  return !!p && (p.role === "admin" || p.plan === "interno");
}

async function outraAssinaturaAtiva(userId: string, exceto: string) {
  const r = await sbFetch(`/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active&id=neq.${exceto}&select=id&limit=1`);
  return Array.isArray(r) && r.length > 0;
}

async function bloquearAcesso(userId: string, subIdInterno: string) {
  if (await perfilProtegido(userId)) return "protegido";
  if (await outraAssinaturaAtiva(userId, subIdInterno)) return "outra_ativa";
  await sbFetch(`/rest/v1/profiles?id=eq.${userId}`, "PATCH", { plan: "free", plan_expires_at: null });
  return "bloqueado";
}

async function jaProcessado(orderId: string, evento: string) {
  if (!orderId) return false;
  const r = await sbFetch(
    `/rest/v1/webhook_logs?payload->>order_id=eq.${encodeURIComponent(orderId)}&event=eq.${encodeURIComponent(evento)}&status=eq.processed&select=id&limit=1`,
  );
  return Array.isArray(r) && r.length > 0;
}

Deno.serve(async (req: Request) => {
  let logId: number | null = null;
  try {
    const rawBody = await req.text();
    const url = new URL(req.url);
    if (!(await assinaturaValida(url, req, rawBody))) {
      console.log("Webhook com assinatura invalida (signature ausente ou incorreta)");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(rawBody || "{}");
    const orderStatus: string = body?.order_status ?? body?.status ?? "";
    const evento: string = body?.webhook_event_type || orderStatus;
    const email: string = (body?.Customer?.email ?? body?.customer?.email ?? "").trim();
    logId = await gravarLog(evento, email, "received", body);

    const tipo = classificar(evento, orderStatus);
    if (tipo === "ignorar") {
      console.log("Evento sem acao:", evento, orderStatus);
      await marcarLog(logId, "ignored");
      return new Response("OK", { status: 200 });
    }

    const orderId: string = body?.order_id ?? body?.id ?? "";
    const subKiwify: string = body?.subscription_id ?? body?.Subscription?.id ?? "";
    const name: string = body?.Customer?.full_name ?? body?.customer?.full_name ?? body?.customer?.name ?? "Cliente";
    const planMeta: string = body?.Product?.metadata?.plan ?? body?.product?.metadata?.plan ?? "";
    const proximaCobranca = dataValida(body?.Subscription?.next_payment);
    console.log(`Evento: ${evento} | Tipo: ${tipo} | Pedido: ${orderId} | Assinatura Kiwify: ${subKiwify}`);

    if (await jaProcessado(orderId, evento)) {
      await marcarLog(logId, "duplicate");
      return new Response("OK - duplicado ignorado", { status: 200 });
    }

    // Reembolso, chargeback, cancelamento e atraso mexem numa assinatura que já existe.
    if (tipo === "reembolso" || tipo === "chargeback" || tipo === "cancelamento" || tipo === "atraso") {
      const sub = await buscarAssinatura(subKiwify, orderId, email);
      if (!sub) {
        console.error("Assinatura nao encontrada para", tipo, orderId, subKiwify);
        await marcarLog(logId, "not_found");
        return new Response("Assinatura nao encontrada", { status: 200 });
      }
      const agora = new Date();
      if (tipo === "atraso") {
        // Regra do Antonio (09/11): pagamento atrasado bloqueia na hora; o pagamento depois reativa (renovação).
        await sbFetch(`/rest/v1/subscriptions?id=eq.${sub.id}`, "PATCH", { status: "overdue" });
        console.log("Acesso:", await bloquearAcesso(sub.user_id, sub.id));
      } else if (tipo === "cancelamento") {
        // Usa até o fim do período pago; depois a rotina de hora em hora bloqueia.
        const ate = dataValida(body?.Subscription?.customer_access?.access_until) ?? proximaCobranca ??
          dataValida(sub.next_billing_at) ?? umMesDepois(sub.started_at);
        await sbFetch(`/rest/v1/subscriptions?id=eq.${sub.id}`, "PATCH", {
          status: "cancelled", cancelled_at: agora.toISOString(), next_billing_at: ate ? ate.toISOString() : null,
        });
        if (!ate || ate <= agora) {
          console.log("Cancelamento sem periodo restante:", await bloquearAcesso(sub.user_id, sub.id));
        } else if (!(await perfilProtegido(sub.user_id)) && !(await outraAssinaturaAtiva(sub.user_id, sub.id))) {
          await sbFetch(`/rest/v1/profiles?id=eq.${sub.user_id}`, "PATCH", { plan_expires_at: ate.toISOString() });
        }
      } else {
        await sbFetch(`/rest/v1/subscriptions?id=eq.${sub.id}`, "PATCH", {
          status: tipo === "reembolso" ? "refunded" : "chargeback", cancelled_at: agora.toISOString(),
        });
        console.log("Acesso:", await bloquearAcesso(sub.user_id, sub.id));
      }
      await marcarLog(logId, "processed");
      return new Response("Done", { status: 200 });
    }

    // Renovação: reativa a assinatura existente, sem criar outra e sem e-mail de boas-vindas.
    const existente = subKiwify ? await buscarAssinatura(subKiwify, "", "") : null;
    // Mesmo pedido da compra original (nova tentativa) não é renovação.
    if (tipo === "renovacao" || (existente && existente.external_id !== orderId)) {
      const sub = existente ?? await buscarAssinatura("", orderId, email);
      if (sub) {
        await sbFetch(`/rest/v1/subscriptions?id=eq.${sub.id}`, "PATCH", {
          status: "active", cancelled_at: null, next_billing_at: proximaCobranca ? proximaCobranca.toISOString() : null,
        });
        if (!(await perfilProtegido(sub.user_id))) {
          await sbFetch(`/rest/v1/profiles?id=eq.${sub.user_id}`, "PATCH", { plan: sub.plan, plan_expires_at: null });
        }
        await marcarLog(logId, "processed");
        return new Response("Done - renovado", { status: 200 });
      }
      if (tipo === "renovacao") {
        await marcarLog(logId, "not_found");
        return new Response("Assinatura nao encontrada", { status: 200 });
      }
    }

    // Único produto hoje é o "MoneyFlow 3D Pro": quem compra recebe o plano pro (decisão do Antonio, 09/11).
    const plan: string = planMeta || "pro";

    if (!email) {
      await marcarLog(logId, "error");
      return new Response("Email nao encontrado", { status: 400 });
    }

    // Compra repetida: se o acesso já foi liberado mas o e-mail falhou, reenvia só o e-mail.
    if (orderId) {
      const dup = await sbFetch(`/rest/v1/subscriptions?external_id=eq.${encodeURIComponent(orderId)}&select=id`);
      if (Array.isArray(dup) && dup.length > 0) {
        const link = await generatePasswordLink(email);
        if (!link) throw new Error("Não foi possível gerar o link de acesso");
        await sendEmail(email, name, plan, link);
        await marcarLog(logId, "processed");
        return new Response("Done - e-mail reenviado", { status: 200 });
      }
    }

    let user = await getUserByEmail(email);
    if (!user) user = await createUser(email, name);
    const userId = user?.id;
    if (!userId) throw new Error("Não foi possível obter o usuário");

    const link = await generatePasswordLink(email);
    if (!link) throw new Error("Não foi possível gerar o link de acesso");

    // Assinatura antes do e-mail (evita reenvio em retry)
    await sbFetch("/rest/v1/subscriptions", "POST", {
      user_id: userId,
      external_id: orderId || null,
      external_subscription_id: subKiwify || null,
      platform: "kiwify",
      plan,
      status: "active",
      amount: body?.Commissions?.charge_amount ?? body?.payment?.charge_amount ?? body?.amount ?? null,
      started_at: new Date().toISOString(),
      next_billing_at: proximaCobranca ? proximaCobranca.toISOString() : null,
    });
    if (!(await perfilProtegido(userId))) {
      await sbFetch(`/rest/v1/profiles?id=eq.${userId}`, "PATCH", { plan, plan_expires_at: null });
    }
    await sendEmail(email, name, plan, link);

    await marcarLog(logId, "processed");
    return new Response("Done", { status: 200 });
  } catch (err) {
    console.error("Erro no webhook:", (err as Error).message);
    await marcarLog(logId, "error");
    return new Response("Erro interno", { status: 500 });
  }
});
