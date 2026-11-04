import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY = Deno.env.get("RESEND_KEY") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios: to, subject, html" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MoneyFlow 3D <noreply@moneyflow3d.com.br>",
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" }
    });
  }
});
