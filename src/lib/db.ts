import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { firestoreDb } from "./firebase";

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
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

function normalizeEmployee(data: any): Employee {
  return {
    ...data,
    permissions: Array.isArray(data.permissions) ? data.permissions : ["clients", "campaigns"],
  };
}

async function seed() {
  const snap = await getDocs(collection(firestoreDb, "employees"));
  if (snap.empty) {
    const adminId = uid();
    await setDoc(doc(firestoreDb, "employees", adminId), {
      id: adminId,
      username: "admin",
      password: "123",
      name: "Administrator",
      role: "admin",
      permissions: [...ALL_PERMISSIONS],
      created_at: now(),
    });
  }
}
seed().catch(console.error);

export const db = {
  employees: {
    async getAll(): Promise<Employee[]> {
      const snap = await getDocs(collection(firestoreDb, "employees"));
      return snap.docs
        .map((d) => normalizeEmployee(d.data()))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
    async getByUsername(username: string): Promise<Employee | null> {
      const snap = await getDocs(
        query(collection(firestoreDb, "employees"), where("username", "==", username))
      );
      if (snap.empty) return null;
      return normalizeEmployee(snap.docs[0].data());
    },
    async getById(id: string): Promise<Employee | null> {
      const d = await getDoc(doc(firestoreDb, "employees", id));
      if (!d.exists()) return null;
      return normalizeEmployee(d.data());
    },
    async insert(data: Omit<Employee, "id" | "created_at">): Promise<{ error: string | null }> {
      const existing = await getDocs(
        query(collection(firestoreDb, "employees"), where("username", "==", data.username))
      );
      if (!existing.empty) return { error: "23505" };
      const id = uid();
      await setDoc(doc(firestoreDb, "employees", id), { ...data, id, created_at: now() });
      return { error: null };
    },
    async delete(id: string): Promise<{ error: string | null }> {
      await deleteDoc(doc(firestoreDb, "employees", id));
      return { error: null };
    },
  },

  clients: {
    async getAll(): Promise<Client[]> {
      const snap = await getDocs(collection(firestoreDb, "clients"));
      return snap.docs
        .map((d) => d.data() as Client)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    async getById(id: string): Promise<Client | null> {
      const d = await getDoc(doc(firestoreDb, "clients", id));
      if (!d.exists()) return null;
      return d.data() as Client;
    },
    async insert(data: Omit<Client, "id" | "created_at">): Promise<{ error: string | null }> {
      const emailSnap = await getDocs(
        query(collection(firestoreDb, "clients"), where("email", "==", data.email))
      );
      if (!emailSnap.empty) return { error: "23505_email" };
      const mobileSnap = await getDocs(
        query(collection(firestoreDb, "clients"), where("mobile", "==", data.mobile))
      );
      if (!mobileSnap.empty) return { error: "23505_mobile" };
      const id = uid();
      await setDoc(doc(firestoreDb, "clients", id), { ...data, id, created_at: now() });
      return { error: null };
    },
    async upsertByEmailOrMobile(
      data: Omit<Client, "id" | "created_at">
    ): Promise<{ action: "inserted" | "updated"; error: string | null }> {
      const [emailSnap, mobileSnap] = await Promise.all([
        getDocs(query(collection(firestoreDb, "clients"), where("email", "==", data.email))),
        getDocs(query(collection(firestoreDb, "clients"), where("mobile", "==", data.mobile))),
      ]);

      if (!emailSnap.empty) {
        const existingId = emailSnap.docs[0].id;
        if (!mobileSnap.empty && mobileSnap.docs[0].id !== existingId) {
          return { action: "updated", error: "mobile_conflict" };
        }
        await updateDoc(doc(firestoreDb, "clients", existingId), {
          name: data.name,
          mobile: data.mobile,
          country: data.country,
          state: data.state ?? null,
          website: data.website ?? null,
          company: data.company ?? null,
          added_by: data.added_by,
        });
        return { action: "updated", error: null };
      }

      if (!mobileSnap.empty) {
        const existingId = mobileSnap.docs[0].id;
        await updateDoc(doc(firestoreDb, "clients", existingId), {
          name: data.name,
          email: data.email,
          country: data.country,
          state: data.state ?? null,
          website: data.website ?? null,
          company: data.company ?? null,
          added_by: data.added_by,
        });
        return { action: "updated", error: null };
      }

      const id = uid();
      await setDoc(doc(firestoreDb, "clients", id), { ...data, id, created_at: now() });
      return { action: "inserted", error: null };
    },
    async update(
      id: string,
      data: Partial<Omit<Client, "id" | "created_at">>
    ): Promise<{ error: string | null }> {
      const checks: Promise<void>[] = [];
      if (data.email) {
        checks.push(
          getDocs(query(collection(firestoreDb, "clients"), where("email", "==", data.email))).then((snap) => {
            if (!snap.empty && snap.docs[0].id !== id) throw new Error("23505_email");
          })
        );
      }
      if (data.mobile) {
        checks.push(
          getDocs(query(collection(firestoreDb, "clients"), where("mobile", "==", data.mobile))).then((snap) => {
            if (!snap.empty && snap.docs[0].id !== id) throw new Error("23505_mobile");
          })
        );
      }
      try {
        await Promise.all(checks);
      } catch (e: any) {
        return { error: e.message };
      }
      await updateDoc(doc(firestoreDb, "clients", id), data as any);
      return { error: null };
    },
    async delete(id: string): Promise<{ error: string | null }> {
      await deleteDoc(doc(firestoreDb, "clients", id));
      return { error: null };
    },
  },

  templates: {
    async getAll(): Promise<Template[]> {
      const snap = await getDocs(collection(firestoreDb, "templates"));
      return snap.docs
        .map((d) => d.data() as Template)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    async getById(id: string): Promise<Template | null> {
      const d = await getDoc(doc(firestoreDb, "templates", id));
      if (!d.exists()) return null;
      return d.data() as Template;
    },
    async insert(data: Omit<Template, "id" | "created_at">): Promise<{ error: string | null }> {
      const id = uid();
      await setDoc(doc(firestoreDb, "templates", id), { ...data, id, created_at: now() });
      return { error: null };
    },
    async update(
      id: string,
      data: Partial<Omit<Template, "id" | "created_at">>
    ): Promise<{ error: string | null }> {
      await updateDoc(doc(firestoreDb, "templates", id), data as any);
      return { error: null };
    },
    async delete(id: string): Promise<{ error: string | null }> {
      await deleteDoc(doc(firestoreDb, "templates", id));
      return { error: null };
    },
  },

  campaigns: {
    async getAll(): Promise<Campaign[]> {
      const snap = await getDocs(collection(firestoreDb, "campaigns"));
      return snap.docs
        .map((d) => d.data() as Campaign)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    async getById(id: string): Promise<Campaign | null> {
      const d = await getDoc(doc(firestoreDb, "campaigns", id));
      if (!d.exists()) return null;
      return d.data() as Campaign;
    },
    async insert(
      data: Omit<Campaign, "id" | "created_at">
    ): Promise<{ id: string; error: string | null }> {
      const id = uid();
      await setDoc(doc(firestoreDb, "campaigns", id), { ...data, id, created_at: now() });
      return { id, error: null };
    },
    async update(
      id: string,
      data: Partial<Omit<Campaign, "id" | "created_at">>
    ): Promise<{ error: string | null }> {
      await updateDoc(doc(firestoreDb, "campaigns", id), data as any);
      return { error: null };
    },
  },

  sendHistory: {
    async getAll(): Promise<SendHistory[]> {
      const snap = await getDocs(collection(firestoreDb, "sendHistory"));
      return snap.docs.map((d) => d.data() as SendHistory);
    },
    async getByCampaignId(campaignId: string): Promise<SendHistory[]> {
      const snap = await getDocs(
        query(collection(firestoreDb, "sendHistory"), where("campaign_id", "==", campaignId))
      );
      return snap.docs
        .map((d) => d.data() as SendHistory)
        .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
    },
    async getByClientId(clientId: string): Promise<SendHistory[]> {
      const snap = await getDocs(
        query(collection(firestoreDb, "sendHistory"), where("client_id", "==", clientId))
      );
      return snap.docs
        .map((d) => d.data() as SendHistory)
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    },
    async getClientIdsByCampaignId(campaignId: string): Promise<Set<string>> {
      const snap = await getDocs(
        query(collection(firestoreDb, "sendHistory"), where("campaign_id", "==", campaignId))
      );
      return new Set(
        snap.docs
          .map((d) => d.data() as SendHistory)
          .filter((h) => h.client_id)
          .map((h) => h.client_id as string)
      );
    },
    async insert(data: Omit<SendHistory, "id" | "sent_at">): Promise<void> {
      const id = uid();
      await setDoc(doc(firestoreDb, "sendHistory", id), { ...data, id, sent_at: now() });
    },
    async countByStatus(status: "success" | "fail"): Promise<number> {
      const snap = await getDocs(
        query(collection(firestoreDb, "sendHistory"), where("status", "==", status))
      );
      return snap.size;
    },
  },
};
