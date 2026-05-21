const KEYS = {
  employees: "sj_employees",
  clients: "sj_clients",
  templates: "sj_templates",
  campaigns: "sj_campaigns",
  sendHistory: "sj_send_history",
};

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export const ALL_PERMISSIONS = ["dashboard", "clients", "campaigns", "templates"] as const;
export type Permission = typeof ALL_PERMISSIONS[number];

export interface Employee {
  id: string;
  username: string;
  password: string;
  name: string;
  role: "admin" | "employee";
  permissions: Permission[];
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  mobile: string;
  country: string;
  state: string | null;
  website: string | null;
  company: string | null;
  added_by: string;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  html: string;
  created_by: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  country: string | null;
  template_id: string;
  date_from: string | null;
  date_to: string | null;
  total_recipients: number;
  success_count: number;
  fail_count: number;
  status: "pending" | "running" | "completed" | "failed";
  started_by: string;
  created_at: string;
}

export interface SendHistory {
  id: string;
  campaign_id: string | null;
  client_id: string | null;
  client_email: string;
  template_id: string | null;
  template_name: string | null;
  status: "success" | "fail";
  error: string | null;
  sent_by: string;
  sent_at: string;
}

function seed() {
  const employees = read<Employee>(KEYS.employees);
  if (employees.length === 0) {
    write<Employee>(KEYS.employees, [
      {
        id: uid(),
        username: "admin",
        password: "123",
        name: "Administrator",
        role: "admin",
        permissions: [...ALL_PERMISSIONS],
        created_at: now(),
      },
    ]);
  }
}

if (typeof window !== "undefined") seed();

function normalizeEmployee(e: any): Employee {
  return {
    ...e,
    permissions: Array.isArray(e.permissions) ? e.permissions : ["clients", "campaigns"],
  };
}

export const db = {
  employees: {
    getAll(): Employee[] {
      return read<any>(KEYS.employees)
        .map(normalizeEmployee)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
    getByUsername(username: string): Employee | null {
      const e = read<any>(KEYS.employees).find((e) => e.username === username);
      return e ? normalizeEmployee(e) : null;
    },
    getById(id: string): Employee | null {
      const e = read<any>(KEYS.employees).find((e) => e.id === id);
      return e ? normalizeEmployee(e) : null;
    },
    insert(data: Omit<Employee, "id" | "created_at">): { error: string | null } {
      const all = read<any>(KEYS.employees);
      if (all.some((e: any) => e.username === data.username)) {
        return { error: "23505" };
      }
      all.push({ ...data, id: uid(), created_at: now() });
      write(KEYS.employees, all);
      return { error: null };
    },
    delete(id: string): { error: string | null } {
      const all = read<any>(KEYS.employees).filter((e: any) => e.id !== id);
      write(KEYS.employees, all);
      return { error: null };
    },
  },

  clients: {
    getAll(): Client[] {
      return read<Client>(KEYS.clients).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    getById(id: string): Client | null {
      return read<Client>(KEYS.clients).find((c) => c.id === id) ?? null;
    },
    insert(data: Omit<Client, "id" | "created_at">): { error: string | null } {
      const all = read<Client>(KEYS.clients);
      if (all.some((c) => c.email === data.email)) return { error: "23505_email" };
      if (all.some((c) => c.mobile === data.mobile)) return { error: "23505_mobile" };
      all.push({ ...data, id: uid(), created_at: now() });
      write(KEYS.clients, all);
      return { error: null };
    },
    delete(id: string): { error: string | null } {
      write(KEYS.clients, read<Client>(KEYS.clients).filter((c) => c.id !== id));
      return { error: null };
    },
  },

  templates: {
    getAll(): Template[] {
      return read<Template>(KEYS.templates).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    getById(id: string): Template | null {
      return read<Template>(KEYS.templates).find((t) => t.id === id) ?? null;
    },
    insert(data: Omit<Template, "id" | "created_at">): { error: string | null } {
      const all = read<Template>(KEYS.templates);
      all.push({ ...data, id: uid(), created_at: now() });
      write(KEYS.templates, all);
      return { error: null };
    },
    update(id: string, data: Partial<Omit<Template, "id" | "created_at">>): { error: string | null } {
      const all = read<Template>(KEYS.templates).map((t) =>
        t.id === id ? { ...t, ...data } : t
      );
      write(KEYS.templates, all);
      return { error: null };
    },
    delete(id: string): { error: string | null } {
      write(KEYS.templates, read<Template>(KEYS.templates).filter((t) => t.id !== id));
      return { error: null };
    },
  },

  campaigns: {
    getAll(): Campaign[] {
      return read<Campaign>(KEYS.campaigns).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    getById(id: string): Campaign | null {
      return read<Campaign>(KEYS.campaigns).find((c) => c.id === id) ?? null;
    },
    insert(data: Omit<Campaign, "id" | "created_at">): { id: string; error: string | null } {
      const all = read<Campaign>(KEYS.campaigns);
      const record: Campaign = { ...data, id: uid(), created_at: now() };
      all.push(record);
      write(KEYS.campaigns, all);
      return { id: record.id, error: null };
    },
    update(id: string, data: Partial<Omit<Campaign, "id" | "created_at">>): { error: string | null } {
      const all = read<Campaign>(KEYS.campaigns).map((c) =>
        c.id === id ? { ...c, ...data } : c
      );
      write(KEYS.campaigns, all);
      return { error: null };
    },
  },

  sendHistory: {
    getAll(): SendHistory[] {
      return read<SendHistory>(KEYS.sendHistory);
    },
    getByCampaignId(campaignId: string): SendHistory[] {
      return read<SendHistory>(KEYS.sendHistory)
        .filter((h) => h.campaign_id === campaignId)
        .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
    },
    getByClientId(clientId: string): SendHistory[] {
      return read<SendHistory>(KEYS.sendHistory)
        .filter((h) => h.client_id === clientId)
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    },
    getClientIdsByCampaignId(campaignId: string): Set<string> {
      return new Set(
        read<SendHistory>(KEYS.sendHistory)
          .filter((h) => h.campaign_id === campaignId && h.client_id)
          .map((h) => h.client_id as string)
      );
    },
    insert(data: Omit<SendHistory, "id" | "sent_at">): void {
      const all = read<SendHistory>(KEYS.sendHistory);
      all.push({ ...data, id: uid(), sent_at: now() });
      write(KEYS.sendHistory, all);
    },
    countByStatus(status: "success" | "fail"): number {
      return read<SendHistory>(KEYS.sendHistory).filter((h) => h.status === status).length;
    },
  },
};
