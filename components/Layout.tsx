
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search, Settings, User, ChevronDown, Building2, LogOut, Plus, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import Logo from './Logo';
import Modal from './Modal';
import VendorForm from './VendorForm';
import StockForm from './StockForm';
import BillForm from './BillForm';

const Layout = () => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [globalModal, setGlobalModal] = useState<{ type: string | null; title: string }>({ type: null, title: '' });
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const loadWorkspaces = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
      if (!authUser) return;
      const { data, error } = await supabase.from('companies').select('*').eq('user_id', authUser.id).eq('is_deleted', false).order('created_at', { ascending: false });
      if (error) throw error;
      setWorkspaces(data || []);
      const activeId = getActiveCompanyId();
      const current = data?.find(w => String(w.id) === String(activeId));
      setActiveWorkspace(current || null);
    } catch (err: any) {
      console.error("Layout load error:", err);
    }
  };

  useEffect(() => {
    loadWorkspaces();
    window.addEventListener('appSettingsChanged', loadWorkspaces);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') { e.preventDefault(); setGlobalModal({ type: 'vendor', title: 'New Vendor' }); }
      if (e.key === 'F5') { e.preventDefault(); setGlobalModal({ type: 'stock', title: 'New Product' }); }
      if (e.key === 'F9') { e.preventDefault(); setGlobalModal({ type: 'bill', title: 'New Purchase Bill' }); }
      if (e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); searchInputRef.current?.focus(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('appSettingsChanged', loadWorkspaces);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);

  const switchWorkspace = (ws: any) => {
    localStorage.setItem('activeCompanyId', ws.id);
    localStorage.setItem('activeCompanyName', ws.name);
    window.dispatchEvent(new Event('appSettingsChanged'));
    setIsAccountMenuOpen(false);
    navigate('/');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate('/setup');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-[100] bg-white">
        <div className="flex items-center space-x-6">
          <Logo size={36} />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1">Active Workspace</span>
            <span className="text-sm font-bold text-slate-900 tracking-tight leading-none">{activeWorkspace?.name || 'Select Account'}</span>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-12">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 group-focus-within:text-slate-500 transition-colors" />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search data..." 
              className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:border-slate-400 focus:bg-white transition-all shadow-inner"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button className="p-2 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-400 relative">
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          
          <div className="h-8 w-px bg-slate-200 mx-1"></div>

          <div className="relative">
            <button 
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className="flex items-center space-x-3 p-1.5 border border-slate-200 rounded-md hover:bg-slate-50 transition-all shadow-sm"
            >
              <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center border border-slate-200 text-slate-600">
                <User className="w-4.5 h-4.5" />
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isAccountMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsAccountMenuOpen(false)}></div>
                <div className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-20 py-3 animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-black/5">
                  <div className="px-5 py-4 border-b border-slate-100 mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Authenticated User</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{user?.email}</p>
                  </div>
                  <div className="py-2 max-h-72 overflow-y-auto custom-scrollbar">
                    <p className="px-5 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Switch Workspace</p>
                    {workspaces.map(ws => (
                      <button key={ws.id} onClick={() => switchWorkspace(ws)} className={`w-full text-left px-5 py-3 text-sm font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${String(activeWorkspace?.id) === String(ws.id) ? 'bg-slate-50 text-slate-900 font-bold' : 'text-slate-600'}`}>
                        <div className="flex items-center">
                          <Building2 className={`w-4 h-4 mr-3 ${String(activeWorkspace?.id) === String(ws.id) ? 'text-primary-dark' : 'text-slate-300'}`} />
                          <span>{ws.name}</span>
                        </div>
                        {String(activeWorkspace?.id) === String(ws.id) && <Check className="w-4 h-4 text-primary-dark" />}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 pt-2 mt-2 px-2">
                    <button onClick={() => { navigate('/companies'); setIsAccountMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center transition-colors"><Plus className="w-4.5 h-4.5 mr-3 text-slate-400" /> New Workspace</button>
                    <button onClick={() => { navigate('/settings'); setIsAccountMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg flex items-center transition-colors"><Settings className="w-4.5 h-4.5 mr-3 text-slate-400" /> Settings</button>
                    <div className="h-px bg-slate-100 my-2 mx-2"></div>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg flex items-center transition-colors"><LogOut className="w-4.5 h-4.5 mr-3" /> Sign Out</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-10">
          <Outlet />
        </main>
      </div>

      <Modal isOpen={!!globalModal.type} onClose={() => setGlobalModal({ type: null, title: '' })} title={globalModal.title}>
          {globalModal.type === 'vendor' && <VendorForm onSubmit={() => { setGlobalModal({ type: null, title: '' }); window.dispatchEvent(new Event('appSettingsChanged')); }} onCancel={() => setGlobalModal({ type: null, title: '' })} />}
          {globalModal.type === 'stock' && <StockForm onSubmit={() => { setGlobalModal({ type: null, title: '' }); window.dispatchEvent(new Event('appSettingsChanged')); }} onCancel={() => setGlobalModal({ type: null, title: '' })} />}
          {globalModal.type === 'bill' && <BillForm onSubmit={() => { setGlobalModal({ type: null, title: '' }); window.dispatchEvent(new Event('appSettingsChanged')); }} onCancel={() => setGlobalModal({ type: null, title: '' })} />}
      </Modal>
    </div>
  );
};

export default Layout;
