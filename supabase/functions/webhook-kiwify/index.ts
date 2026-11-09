// webhook-kiwify — MoneyFlow 3D
// Recebe os eventos da Kiwify, libera o acesso na compra aprovada e grava o histórico.
//
// Segredos (Supabase → Edge Functions → Secrets), nunca no código:
//   KIWIFY_WEBHOOK_TOKEN  token do webhook cadastrado na Kiwify
//   RESEND_KEY            chave do Resend (e-mail de boas-vindas)
//   SUPABASE_SECRET_KEYS  injetada pelo Supabase
// Verify JWT precisa ficar DESLIGADO (a Kiwify não manda JWT).

const WEBHOOK_TOKEN = Deno.env.get("KIWIFY_WEBHOOK_TOKEN") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ?? "";

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
    options: { redirect_to: "https://moneyflow3d.com.br" },
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
  <p style="font-size:13px;color:#999">O link expira em 24h. Apos criar sua senha, faca login normalmente em <a href="https://moneyflow3d.com.br" style="color:#a78bfa">moneyflow3d.com.br</a>.</p>
  <div class="footer">MoneyFlow 3D - MeshIT Tecnologia | <a href="https://moneyflow3d.com.br" style="color:#a78bfa">moneyflow3d.com.br</a></div>
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
  const signature = (url.searchParams.get("signature") || "").toLowerCase();
  const tokenLegado = url.searchParams.get("token") || req.headers.get("X-Kiwify-Token") || "";
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(WEBHOOK_TOKEN), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const esperado = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(rawBody))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return signature === esperado || tokenLegado === WEBHOOK_TOKEN;
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

    if (orderStatus !== "paid") {
      console.log("Status nao e paid, ignorando:", orderStatus);
      await marcarLog(logId, "ignored");
      return new Response("OK", { status: 200 });
    }

    const orderId: string = body?.order_id ?? body?.id ?? "";
    const name: string = body?.Customer?.full_name ?? body?.customer?.full_name ?? body?.customer?.name ?? "Cliente";
    const plan: string = body?.Product?.metadata?.plan ?? body?.product?.metadata?.plan ?? "maker";
    console.log(`Pedido: ${orderId} | Plano: ${plan}`);

    if (!email) {
      await marcarLog(logId, "error");
      return new Response("Email nao encontrado", { status: 400 });
    }

    // Deduplicação: pedido já processado não cria nada de novo.
    // Se o acesso foi liberado mas o e-mail falhou, a nova tentativa da Kiwify reenvia só o e-mail.
    if (orderId) {
      const oid = encodeURIComponent(orderId);
      const dup = await sbFetch(`/rest/v1/subscriptions?external_id=eq.${oid}&select=id`);
      if (Array.isArray(dup) && dup.length > 0) {
        const ok = await sbFetch(`/rest/v1/webhook_logs?payload->>order_id=eq.${oid}&status=eq.processed&select=id&limit=1`);
        if (Array.isArray(ok) && ok.length > 0) {
          await marcarLog(logId, "duplicate");
          return new Response("OK - duplicado ignorado", { status: 200 });
        }
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
      platform: "kiwify",
      plan,
      status: "active",
      amount: body?.Commissions?.charge_amount ?? body?.payment?.charge_amount ?? body?.amount ?? null,
      started_at: new Date().toISOString(),
    });
    await sbFetch(`/rest/v1/profiles?id=eq.${userId}`, "PATCH", { plan });
    await sendEmail(email, name, plan, link);

    await marcarLog(logId, "processed");
    return new Response("Done", { status: 200 });
  } catch (err) {
    console.error("Erro no webhook:", (err as Error).message);
    await marcarLog(logId, "error");
    return new Response("Erro interno", { status: 500 });
  }
});
