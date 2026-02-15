
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Company {
  id: string;
  name: string;
  gstin?: string;
  address?: string;
}

interface CompanyContextType {
  activeCompany: Company | null;
  loading: boolean;
  setCompany: (company: Company) => Promise<void>;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setActiveCompany(null);
        return;
      }

      // 1. Check profiles table for active_company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_company_id')
        .eq('id', session.user.id)
        .maybeSingle();

      const storedId = localStorage.getItem('activeCompanyId');
      const targetId = profile?.active_company_id || storedId;

      if (targetId) {
        const { data: company } = await supabase
          .from('companies')
          .select('*')
          .eq('id', targetId)
          .eq('is_deleted', false)
          .maybeSingle();

        if (company) {
          setActiveCompany(company);
          localStorage.setItem('activeCompanyId', company.id);
          localStorage.setItem('activeCompanyName', company.name);
        } else {
          setActiveCompany(null);
          localStorage.removeItem('activeCompanyId');
        }
      } else {
        setActiveCompany(null);
      }
    } catch (err) {
      console.error("Context refresh error:", err);
    } finally {
      setLoading(false);
    }
  };

  const setCompany = async (company: Company) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Sync to Supabase Profile for RLS
    await supabase
      .from('profiles')
      .upsert({ id: session.user.id, active_company_id: company.id });

    localStorage.setItem('activeCompanyId', company.id);
    localStorage.setItem('activeCompanyName', company.name);
    setActiveCompany(company);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <CompanyContext.Provider value={{ activeCompany, loading, setCompany, refresh }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
