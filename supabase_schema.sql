-- ZenterPrime Complete Database Setup Schema
-- 14-Day Evaluation Edition Support

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS sync_user ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.sync_user() CASCADE;

DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.login_verifications CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.purchase_bills CASCADE;
DROP TABLE IF EXISTS public.sales_invoices CASCADE;
DROP TABLE IF EXISTS public.stock_items CASCADE;
DROP TABLE IF EXISTS public.duties_taxes CASCADE;
DROP TABLE IF EXISTS public.cashbooks CASCADE;

-- 1. Profiles Table for Evaluation Licensing
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  active_company_id uuid,
  full_name text,
  trial_start timestamptz DEFAULT now(),
  trial_end timestamptz DEFAULT (now() + interval '14 days'),
  license_type text DEFAULT 'evaluation',
  license_status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- 2. Login Verifications Table (Storing Supabase Server Timestamps created_at and expires_at = +14 days)
CREATE TABLE public.login_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  otp text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '14 days')
);

-- 3. Core Accounting Tables
CREATE TABLE public.companies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
  name text NOT NULL, 
  gstin text, 
  address text, 
  is_deleted boolean DEFAULT false, 
  created_at timestamptz DEFAULT now(), 
  user_id uuid DEFAULT auth.uid(),
  created_by uuid DEFAULT auth.uid()
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.vendors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, 
  name text NOT NULL, 
  email text, 
  phone text, 
  gstin text, 
  pan text, 
  state text, 
  account_number text, 
  account_name text, 
  ifsc_code text, 
  address text, 
  balance numeric DEFAULT 0, 
  party_type text DEFAULT 'vendor', 
  is_customer boolean DEFAULT false, 
  is_deleted boolean DEFAULT false, 
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, 
  name text NOT NULL, 
  email text, 
  phone text, 
  gstin text, 
  pan text, 
  state text, 
  account_number text, 
  account_name text, 
  ifsc_code text, 
  address text, 
  balance numeric DEFAULT 0, 
  party_type text DEFAULT 'customer', 
  is_customer boolean DEFAULT true, 
  is_deleted boolean DEFAULT false, 
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.purchase_bills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, 
  vendor_name text NOT NULL, 
  bill_number text NOT NULL, 
  date date NOT NULL DEFAULT CURRENT_DATE, 
  total_without_gst numeric DEFAULT 0, 
  total_gst numeric DEFAULT 0, 
  grand_total numeric DEFAULT 0, 
  status text DEFAULT 'Pending', 
  is_deleted boolean DEFAULT false, 
  description text, 
  items jsonb DEFAULT '{}'::jsonb, 
  round_off numeric DEFAULT 0, 
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.sales_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, 
  customer_name text NOT NULL, 
  invoice_number text NOT NULL, 
  date date NOT NULL DEFAULT CURRENT_DATE, 
  total_without_gst numeric DEFAULT 0, 
  total_gst numeric DEFAULT 0, 
  grand_total numeric DEFAULT 0, 
  status text DEFAULT 'Pending', 
  is_deleted boolean DEFAULT false, 
  description text, 
  items jsonb DEFAULT '{}'::jsonb, 
  round_off numeric DEFAULT 0, 
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.stock_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, 
  name text NOT NULL, 
  hsn text, 
  rate numeric DEFAULT 0, 
  selling_price numeric DEFAULT 0, 
  tax_rate numeric DEFAULT 0, 
  unit text DEFAULT 'PCS', 
  in_stock numeric DEFAULT 0, 
  sku text, 
  description text, 
  kg_per_bag numeric DEFAULT 0, 
  is_deleted boolean DEFAULT false, 
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.duties_taxes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, 
  name text NOT NULL, 
  type text DEFAULT 'Charge', 
  calc_method text DEFAULT 'Percentage', 
  rate numeric DEFAULT 0, 
  fixed_amount numeric DEFAULT 0, 
  apply_on text DEFAULT 'Subtotal', 
  applicable_to text DEFAULT 'Both', 
  is_default boolean DEFAULT false, 
  is_deleted boolean DEFAULT false, 
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.cashbooks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, 
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, 
  date date NOT NULL, 
  income_total numeric DEFAULT 0, 
  expense_total numeric DEFAULT 0, 
  balance numeric DEFAULT 0, 
  raw_data jsonb DEFAULT '{}'::jsonb, 
  is_deleted boolean DEFAULT false, 
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duties_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbooks ENABLE ROW LEVEL SECURITY;

-- Set Policies
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can manage own verifications" ON public.login_verifications FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Manage own companies" ON public.companies FOR ALL TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Manage own users" ON public.users FOR ALL TO authenticated USING (auth.uid() = id);
CREATE POLICY "Manage company vendors" ON public.vendors FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company customers" ON public.customers FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company purchase bills" ON public.purchase_bills FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company sales" ON public.sales_invoices FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company stock" ON public.stock_items FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company taxes" ON public.duties_taxes FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company cashbook" ON public.cashbooks FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));

-- Auto-create user profiles & login_verifications with server timestamps on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, now())
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.profiles (
    id, 
    trial_start, 
    trial_end, 
    license_type, 
    license_status, 
    created_at
  )
  VALUES (
    new.id, 
    now(), 
    now() + interval '14 days', 
    'evaluation', 
    'active', 
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.login_verifications (
    user_id,
    otp,
    created_at,
    expires_at
  )
  VALUES (
    new.id,
    '',
    now(),
    now() + interval '14 days'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
