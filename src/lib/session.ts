import type { Permission } from "./db";

export interface Session {
  id: string;
  username: string;
  name: string;
  role: "admin" | "employee";
  permissions: Permission[];
}

const KEY = "sj_session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as any;
    return {
      ...s,
      permissions: Array.isArray(s.permissions) ? s.permissions : ["clients", "campaigns"],
    } as Session;
  } catch {
    return null;
  }
}

export function setSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
