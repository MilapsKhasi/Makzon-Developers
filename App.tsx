
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import Customers from './pages/Customers';
import Bills from './pages/Bills';
import Sales from './pages/Sales';
import Stock from './pages/Stock';
import Masters from './pages/Masters';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Purchases from './pages/Purchases';
import DutiesTaxes from './pages/DutiesTaxes';
import Cashbook from './pages/Cashbook';
import Auth from './pages/Auth';
import Companies from './pages/Companies';
import SplashScreen from './components/SplashScreen';
import { CompanyProvider, useCompany } from './context/CompanyContext';
import { supabase } from './lib/supabase';
import { Database, AlertCircle, Copy, Check } from 'lucide-react';

const AppContent = () => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashExiting, setIsSplashExiting] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const { activeCompany, loading: companyLoading } = useCompany();

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setIsSplashExiting(true);
      setTimeout(() => setShowSplash(false), 700);
    }, 2500);

    const checkSchema = async (sess: any) => {
      if (!sess) return;
      try {
        const { error } = await supabase.from('companies').select('id').limit(1);
        if (error && (error.message.includes('not found') || error.message.includes('does not exist'))) {
          setDbError("SCHEMA_MISSING");
        }
      } catch (e) {
        console.error("Schema check error:", e);
      }
    };

    const initAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession) await checkSchema(currentSession);
      setAuthLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'SIGNED_IN') checkSchema(newSession);
      if (event === 'SIGNED_OUT') {
        localStorage.clear();
        setDbError(null);
      }
    });

    return () => {
      clearTimeout(splashTimer);
      subscription.unsubscribe();
    };
  }, []);

  const copySql = () => {
    const sql = `
-- 1. Create Profiles Table for Multi-tenancy Context
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  active_company_id uuid,
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- 2. Create Core Tables
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

-- 2.1 Create OTP Verification Table
CREATE TABLE public.login_verifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  otp text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.vendors (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, name text NOT NULL, email text, phone text, gstin text, pan text, state text, account_number text, account_name text, ifsc_code text, address text, balance numeric DEFAULT 0, party_type text DEFAULT 'vendor', is_customer boolean DEFAULT false, is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.bills (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, vendor_name text NOT NULL, bill_number text NOT NULL, date date NOT NULL DEFAULT CURRENT_DATE, total_without_gst numeric DEFAULT 0, total_gst numeric DEFAULT 0, grand_total numeric DEFAULT 0, status text DEFAULT 'Pending', is_deleted boolean DEFAULT false, description text, items jsonb DEFAULT '{}'::jsonb, round_off numeric DEFAULT 0, created_at timestamptz DEFAULT now());
CREATE TABLE public.sales_invoices (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, customer_name text NOT NULL, invoice_number text NOT NULL, date date NOT NULL DEFAULT CURRENT_DATE, total_without_gst numeric DEFAULT 0, total_gst numeric DEFAULT 0, grand_total numeric DEFAULT 0, status text DEFAULT 'Pending', is_deleted boolean DEFAULT false, description text, items jsonb DEFAULT '{}'::jsonb, round_off numeric DEFAULT 0, created_at timestamptz DEFAULT now());
CREATE TABLE public.stock_items (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, name text NOT NULL, hsn text, rate numeric DEFAULT 0, tax_rate numeric DEFAULT 0, unit text DEFAULT 'PCS', in_stock numeric DEFAULT 0, sku text, description text, kg_per_bag numeric DEFAULT 0, is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.duties_taxes (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, name text NOT NULL, type text DEFAULT 'Charge', calc_method text DEFAULT 'Percentage', rate numeric DEFAULT 0, fixed_amount numeric DEFAULT 0, apply_on text DEFAULT 'Subtotal', is_default boolean DEFAULT false, is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.cashbooks (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, date date NOT NULL, income_total numeric DEFAULT 0, expense_total numeric DEFAULT 0, balance numeric DEFAULT 0, raw_data jsonb DEFAULT '{}'::jsonb, is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now());

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duties_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_verifications ENABLE ROW LEVEL SECURITY;

-- 4. Set Policies
CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);
CREATE POLICY "Manage own companies" ON public.companies FOR ALL TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Manage company data" ON public.vendors FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company bills" ON public.bills FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company sales" ON public.sales_invoices FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company stock" ON public.stock_items FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company taxes" ON public.duties_taxes FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage company cashbook" ON public.cashbooks FOR ALL TO authenticated USING (company_id IN (SELECT id FROM companies WHERE created_by = auth.uid()));
CREATE POLICY "Manage own OTPs" ON public.login_verifications FOR ALL TO authenticated USING (auth.uid() = user_id);
    `.trim();
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showSplash) return <SplashScreen isExiting={isSplashExiting} />;

  if (authLoading || companyLoading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  if (session && dbError === "SCHEMA_MISSING") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Database className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2 capitalize">Database Setup Required</h1>
          <p className="text-slate-500 mb-8 capitalize">Required tables haven't been created yet.</p>
          <div className="bg-slate-900 rounded-lg p-6 text-left mb-6 relative group">
            <pre className="text-[10px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
              {`CREATE TABLE public.profiles (...);\nCREATE TABLE public.companies (...);\n...`}
            </pre>
            <button onClick={copySql} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center capitalize">
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? 'Copied!' : 'Copy Sql'}
            </button>
          </div>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-primary text-slate-900 font-medium rounded-lg hover:bg-primary-dark capitalize">
            Refresh After Running Sql
          </button>
        </div>
      </div>
    );
  }

  // Security Guard: Check for session AND OTP verification flag
  const isVerified = localStorage.getItem('is_verified') === 'true';
  const authenticated = !!session && isVerified;

  return (
    <div className="animate-in fade-in duration-500">
      <Routes>
        <Route path="/setup" element={authenticated ? <Navigate to="/companies" replace /> : <Auth />} />
        <Route path="/companies" element={authenticated ? <Companies /> : <Navigate to="/setup" replace />} />
        
        <Route path="/" element={authenticated ? (activeCompany ? <Layout /> : <Navigate to="/companies" replace />) : (<Navigate to="/setup" replace />)}>
          <Route index element={<Dashboard />} />
          <Route path="masters" element={<Masters />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="bills" element={<Bills />} />
          <Route path="sales" element={<Sales />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="customers" element={<Customers />} />
          <Route path="cashbook" element={<Cashbook />} />
          <Route path="duties-taxes" element={<DutiesTaxes />} />
          <Route path="stock" element={<Stock />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <Router>
    <CompanyProvider>
      <AppContent />
    </CompanyProvider>
  </Router>
);

export default App;
