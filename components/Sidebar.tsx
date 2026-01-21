import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, ReceiptText, BarChart3, Package, 
  Calculator, Users, Wallet, ShoppingBag, Contact,
  Building2, ChevronDown, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const Sidebar = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState<any>(null);

  // 1. Fetch Companies belonging only to the Logged-in User
  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id) // Filter by the user_id column we just added
        .order('name', { ascending: true });

      if (error) throw error;
      
      setCompanies(data || []);
      
      // Set the first company as active if none is selected
      const savedCid = localStorage.getItem('active_company_id');
      if (data && data.length > 0) {
        const current = data.find(c => c.id === savedCid) || data[0];
        setActiveCompany(current);
        localStorage.setItem('active_company_id', current.id);
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, shortcut: 'D' },
    { name: 'Sales Invoices', path: '/sales', icon: ShoppingBag, shortcut: 'I' },
    { name: 'Customers', path: '/customers', icon: Contact, shortcut: 'C' },
    { name: 'Purchase Bills', path: '/bills', icon: ReceiptText, shortcut: 'B' },
    { name: 'Vendors', path: '/vendors', icon: Users, shortcut: 'V' },
    { name: 'Stock Management', path: '/stock', icon: Package, shortcut: 'S' },
    { name: 'Cashbook', path: '/cashbook', icon: Wallet, shortcut: 'K' },
    { name: 'Duties & Taxes', path: '/duties-taxes', icon: Calculator, shortcut: 'T' },
    { name: 'Reports', path: '/reports', icon: BarChart3, shortcut: 'R' },
  ];

  const renderLabel = (text: string, shortcut: string) => {
    const char = shortcut.toLowerCase();
    const index = text.toLowerCase().indexOf(char);
    if (index === -1) return text;
    return (
      <>
        {text.slice(0, index)}
        <span className="underline decoration-1 underline-offset-2">{text[index]}</span>
        {text.slice(index + 1)}
      </>
    );
  };

  return (
    <aside className="w-64 border-r border-slate-200 h-full py-0 flex flex-col shrink-0 bg-white z-10 overflow-hidden transition-none">
      
      {/* 2. Company Switcher Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-3 px-2 py-2 rounded-lg border border-slate-200 bg-white shadow-sm cursor-pointer hover:border-primary transition-all">
          <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center text-primary shrink-0">
            <Building2 size={16} />
          </div>
          <div className="min-w-0 flex-1">
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
            ) : (
              <>
                <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Active Company</p>
                <p className="text-xs font-bold text-slate-800 truncate uppercase tracking-tighter">
                  {activeCompany?.name || 'No Company Select'}
                </p>
              </>
            )}
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name + item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-between px-6 py-3 text-[14px] font-normal transition-none ${
                isActive
                  ? 'bg-primary text-slate-900 border-r-4 border-slate-900 font-semibold shadow-[inset_0_0_10px_rgba(0,0,0,0.02)]'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            {({ isActive }) => (
              <div className="flex items-center space-x-4 min-w-0">
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                <span className="truncate">{renderLabel(item.name, item.shortcut)}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 3. Footer / User Info */}
      <div className="p-4 border-t border-slate-100 mt-auto">
        <div className="flex items-center space-x-3 px-2">
           <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-[10px] font-bold">
             JD
           </div>
           <div className="text-[11px]">
             <p className="font-bold text-slate-800">Prime v26.1.9</p>
             <p className="text-slate-400 uppercase font-black tracking-tighter">Gold Member</p>
           </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
