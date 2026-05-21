export const MAIL_API = "https://emailmarketing-zq3j.onrender.com";

export interface SendMailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail(payload: SendMailPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${MAIL_API}/send-mail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status} ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }
}

export async function pingMail(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${MAIL_API}/`, { method: "GET", signal: ctrl.signal, mode: "no-cors" });
    clearTimeout(t);
    // no-cors gives opaque response; if no throw, it's reachable
    return true;
  } catch {
    return false;
  }
}
