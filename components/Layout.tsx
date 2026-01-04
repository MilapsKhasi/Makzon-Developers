
import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search, Settings as SettingsIcon, User, ChevronDown, Building2, LogOut, Plus, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import Logo from './Logo';
import Modal from './Modal';
import VendorForm from './VendorForm';
import StockForm from './StockForm';
import BillForm from './BillForm';
import Settings from '../pages/Settings';

const Layout = () => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
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
    return () => window.removeEventListener('appSettingsChanged', loadWorkspaces);
  }, [navigate]);

  // Global Keyboard Shortcuts for Navigation using Alt as modifier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Alt is pressed
      if (e.altKey) {
        const key = e.key.toLowerCase();
        const routes: Record<string, string> = {
          'd': '/',
          'i': '/sales',
          'c': '/customers',
          'b': '/bills',
          'v': '/vendors',
          's': '/stock',
          'k': '/cashbook',
          't': '/duties-taxes',
          'r': '/reports'
        };

        if (routes[key]) {
          e.preventDefault();
          navigate(routes[key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    <div className="flex flex-col h-screen bg-white overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-[100] bg-white">
        <div className="flex items-center space-x-2">
          <Logo size={32} />
          <div className="flex items-center px-3 py-1.5 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50" onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}>
            <span className="text-xs font-normal text-slate-700 uppercase tracking-tight mr-2">{activeWorkspace?.name || 'Select Account'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>
        </div>

        <div className="flex-1 max-w-lg mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search anything" 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 relative">
          <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50">
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button className="p-2 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50 relative">
            <Bell className="w-4 h-4" />
          </button>
          <button onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)} className="p-2 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50">
            <User className="w-4 h-4" />
          </button>

          {isAccountMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsAccountMenuOpen(false)}></div>
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-2">
                <div className="px-4 py-2 border-b border-slate-100 mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">User</p>
                  <p className="text-xs text-slate-900 truncate">{user?.email}</p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {workspaces.map(ws => (
                    <button key={ws.id} onClick={() => switchWorkspace(ws)} className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${String(activeWorkspace?.id) === String(ws.id) ? 'font-bold bg-slate-50' : 'text-slate-600'}`}>
                      <span>{ws.name}</span>
                      {String(activeWorkspace?.id) === String(ws.id) && <Check className="w-3 h-3 text-slate-900" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 mt-1 pt-1">
                   <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center"><LogOut className="w-3 h-3 mr-2" /> Sign Out</button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 bg-white">
            <Outlet />
          </main>
        </div>
      </div>

      <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Global System Configuration" maxWidth="max-w-4xl">
          <Settings onDone={() => setIsSettingsModalOpen(false)} />
      </Modal>

      <Modal isOpen={!!globalModal.type} onClose={() => setGlobalModal({ type: null, title: '' })} title={globalModal.title} maxWidth={globalModal.type === 'bill' ? 'max-w-6xl' : 'max-w-2xl'}>
          {globalModal.type === 'vendor' && <VendorForm onSubmit={() => { setGlobalModal({ type: null, title: '' }); window.dispatchEvent(new Event('appSettingsChanged')); }} onCancel={() => setGlobalModal({ type: null, title: '' })} />}
          {globalModal.type === 'stock' && <StockForm onSubmit={() => { setGlobalModal({ type: null, title: '' }); window.dispatchEvent(new Event('appSettingsChanged')); }} onCancel={() => setGlobalModal({ type: null, title: '' })} />}
          {globalModal.type === 'bill' && <BillForm onSubmit={() => { setGlobalModal({ type: null, title: '' }); window.dispatchEvent(new Event('appSettingsChanged')); }} onCancel={() => setGlobalModal({ type: null, title: '' })} />}
      </Modal>
    </div>
  );
};

export default Layout;
