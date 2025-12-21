
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Bell, Search, Settings, User, ChevronDown, Building2, LogOut, Plus, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';

const Layout = () => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  const loadWorkspaces = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    setUser(authUser);
    if (!authUser) return;

    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    
    setWorkspaces(data || []);
    
    const activeId = getActiveCompanyId();
    const current = data?.find(w => w.id === activeId);
    setActiveWorkspace(current || null);
  };

  useEffect(() => {
    loadWorkspaces();
    window.addEventListener('appSettingsChanged', loadWorkspaces);
    return () => window.removeEventListener('appSettingsChanged', loadWorkspaces);
  }, []);

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
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-[100] bg-white">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-primary rounded border border-slate-200 flex items-center justify-center shadow-sm">
            <span className="font-bold text-xl italic text-slate-800">P</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Workspace</span>
            <span className="text-sm font-semibold text-slate-900 tracking-tight">{activeWorkspace?.name || 'Select Account'}</span>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search data, vendors, bills..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:border-slate-400 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <button 
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className="flex items-center space-x-2 p-1.5 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              <div className="w-7 h-7 bg-slate-100 rounded flex items-center justify-center border border-slate-200">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isAccountMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsAccountMenuOpen(false)}></div>
                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Info</p>
                    <p className="text-xs font-semibold text-slate-900 truncate">{user?.email}</p>
                  </div>

                  <div className="py-2 max-h-60 overflow-y-auto">
                    <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Switch Workspace</p>
                    {workspaces.map(ws => (
                      <button 
                        key={ws.id}
                        onClick={() => switchWorkspace(ws)}
                        className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center justify-between hover:bg-slate-50 ${activeWorkspace?.id === ws.id ? 'bg-slate-50 text-slate-900' : 'text-slate-600'}`}
                      >
                        <div className="flex items-center">
                          <Building2 className={`w-3.5 h-3.5 mr-3 ${activeWorkspace?.id === ws.id ? 'text-primary-dark' : 'text-slate-400'}`} />
                          <span className={activeWorkspace?.id === ws.id ? 'font-bold' : ''}>{ws.name}</span>
                        </div>
                        {activeWorkspace?.id === ws.id && <Check className="w-3.5 h-3.5 text-primary-dark" />}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 pt-2">
                    <button 
                      onClick={() => { navigate('/companies'); setIsAccountMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center"
                    >
                      <Plus className="w-4 h-4 mr-3 text-slate-400" /> New Account / Workspace
                    </button>
                    <button 
                      onClick={() => { navigate('/settings'); setIsAccountMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center"
                    >
                      <Settings className="w-4 h-4 mr-3 text-slate-400" /> Settings
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 flex items-center"
                    >
                      <LogOut className="w-4 h-4 mr-3" /> Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button className="p-2 border border-slate-200 rounded-md hover:bg-slate-50 text-slate-400 relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8 bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
