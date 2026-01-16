import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { getActiveCompanyId } from './utils/helpers';
import { supabase } from './lib/supabase';
import { Database, AlertCircle, Copy, Check } from 'lucide-react';

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isSplashExiting, setIsSplashExiting] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState(getActiveCompanyId());
  const [dbError, setDbError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setIsSplashExiting(true);
      setTimeout(() => {
        setShowSplash(false);
      }, 700);
    }, 3000);

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
           if (error.message.includes('Refresh Token Not Found')) {
             await supabase.auth.signOut();
             localStorage.clear();
             setSession(null);
           }
        } else {
          setSession(session);
          if (session) {
            // Check if tables exist
            const { error: tableError } = await supabase.from('companies').select('id').limit(1);
            if (tableError && (tableError.message.includes('not found') || tableError.message.includes('does not exist'))) {
              setDbError("SCHEMA_MISSING");
            }
          }
        }
      } catch (err) {
        console.error("Session recovery failed:", err);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.clear();
      }
      setSession(session);
    });

    const handleSettingsChange = () => {
      setActiveCompanyId(getActiveCompanyId());
    };

    window.addEventListener('appSettingsChanged', handleSettingsChange);
    return () => {
      clearTimeout(splashTimer);
      subscription.unsubscribe();
      window.removeEventListener('appSettingsChanged', handleSettingsChange);
    };
  }, []);

  const copySql = () => {
    const sql = `
-- Run this in your Supabase SQL Editor
CREATE TABLE public.companies (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text NOT NULL, gstin text, address text, is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now(), user_id uuid DEFAULT auth.uid());
CREATE TABLE public.vendors (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, name text NOT NULL, email text, phone text, gstin text, pan text, state text, account_number text, account_name text, ifsc_code text, address text, balance numeric DEFAULT 0, party_type text DEFAULT 'vendor', is_customer boolean DEFAULT false, is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.bills (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, vendor_name text NOT NULL, bill_number text NOT NULL, date date NOT NULL DEFAULT CURRENT_DATE, total_without_gst numeric DEFAULT 0, total_gst numeric DEFAULT 0, grand_total numeric DEFAULT 0, status text DEFAULT 'Pending', is_deleted boolean DEFAULT false, description text, items jsonb DEFAULT '{}'::jsonb, round_off numeric DEFAULT 0, created_at timestamptz DEFAULT now());
CREATE TABLE public.sales_invoices (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, customer_name text NOT NULL, invoice_number text NOT NULL, date date NOT NULL DEFAULT CURRENT_DATE, total_without_gst numeric DEFAULT 0, total_gst numeric DEFAULT 0, grand_total numeric DEFAULT 0, status text DEFAULT 'Pending', is_deleted boolean DEFAULT false, description text, items jsonb DEFAULT '{}'::jsonb, round_off numeric DEFAULT 0, created_at timestamptz DEFAULT now());
CREATE TABLE public.stock_items (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, name text NOT NULL, hsn text, rate numeric DEFAULT 0, tax_rate numeric DEFAULT 0, unit text DEFAULT 'PCS', in_stock numeric DEFAULT 0, sku text, description text, kg_per_bag numeric DEFAULT 0, is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.duties_taxes (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, name text NOT NULL, type text DEFAULT 'Charge', calc_method text DEFAULT 'Percentage', rate numeric DEFAULT 0, fixed_amount numeric DEFAULT 0, apply_on text DEFAULT 'Subtotal', is_default boolean DEFAULT false, is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.cashbooks (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, date date NOT NULL, income_total numeric DEFAULT 0, expense_total numeric DEFAULT 0, balance numeric DEFAULT 0, raw_data jsonb DEFAULT '{}'::jsonb, is_deleted boolean DEFAULT false, created_at timestamptz DEFAULT now());
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duties_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own companies" ON public.companies FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Manage vendors" ON public.vendors FOR ALL TO authenticated USING (true);
CREATE POLICY "Manage bills" ON public.bills FOR ALL TO authenticated USING (true);
CREATE POLICY "Manage sales" ON public.sales_invoices FOR ALL TO authenticated USING (true);
CREATE POLICY "Manage stock" ON public.stock_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Manage taxes" ON public.duties_taxes FOR ALL TO authenticated USING (true);
CREATE POLICY "Manage cashbooks" ON public.cashbooks FOR ALL TO authenticated USING (true);
    `.trim();
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showSplash) return <SplashScreen isExiting={isSplashExiting} />;

  if (loading) return (
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
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Database Setup Required</h1>
          <p className="text-slate-500 mb-8">
            Your Supabase project is connected, but the required tables haven't been created yet. 
            Please run the initialization script in your Supabase SQL Editor.
          </p>
          
          <div className="bg-slate-900 rounded-lg p-6 text-left mb-6 relative group">
            <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
              {`-- Initialize Findesk Prime Schema\nCREATE TABLE public.companies (...);\nCREATE TABLE public.vendors (...);\nCREATE TABLE public.bills (...);\nCREATE TABLE public.sales_invoices (...);\n-- [and 18 more commands]`}
            </pre>
            <button 
              onClick={copySql}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center"
            >
              {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? 'Copied!' : 'Copy Full SQL'}
            </button>
          </div>

          <div className="flex items-start gap-3 text-left bg-blue-50 p-4 rounded-lg border border-blue-100 mb-8">
            <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 leading-relaxed">
              <strong>Instructions:</strong> Go to your Supabase Dashboard → SQL Editor → New Query → Paste the code → Run. 
              After running, refresh this page to start using the app.
            </div>
          </div>

          <button 
            onClick={() => window.location.reload()} 
            className="px-8 py-3 bg-primary text-slate-900 font-bold rounded-lg hover:bg-primary-dark transition-all"
          >
            I've run the script, Refresh Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="animate-in fade-in duration-1000">
        <Routes>
          <Route path="/setup" element={session ? <Navigate to="/companies" replace /> : <Auth />} />
          <Route path="/companies" element={session ? <Companies /> : <Navigate to="/setup" replace />} />
          <Route path="/" element={session ? (activeCompanyId ? <Layout /> : <Navigate to="/companies" replace />) : (<Navigate to="/setup" replace />)}>
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
    </Router>
  );
};

export default App;