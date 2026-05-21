
-- Custom employees/users table (simple username+password login as requested)
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','employee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.employees (username, password, name, role)
VALUES ('admin', '123', 'Administrator', 'admin');

CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  company TEXT,
  added_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_country ON public.clients(country);
CREATE INDEX idx_clients_created_at ON public.clients(created_at);
CREATE INDEX idx_clients_added_by ON public.clients(added_by);

CREATE TABLE public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE RESTRICT,
  date_from TIMESTAMPTZ,
  date_to TIMESTAMPTZ,
  total_recipients INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  fail_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  started_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.send_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  client_email TEXT NOT NULL,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  template_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('success','fail')),
  error TEXT,
  sent_by TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_send_history_client ON public.send_history(client_id);
CREATE INDEX idx_send_history_campaign ON public.send_history(campaign_id);

-- Enable RLS but allow all (app-level auth)
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.send_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.send_history FOR ALL USING (true) WITH CHECK (true);
