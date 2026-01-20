import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, Users, UserSquare2, BadgeIndianRupee, 
  Package, Database, BarChart3, Settings as SettingsIcon, 
  ShoppingCart, Percent, ChevronDown, Building2, 
  Menu, UserCircle, LogOut, UserCog, SwitchCamera, Mail, User as UserIcon, Loader2, Plus, ChevronLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import Logo from './Logo';
import Modal from './Modal';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'switch'>('main'); // Toggle between main menu and workspace list
  const [user, setUser] = useState<any>(null);
  
  // Edit Account State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [username, setUsername] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setUsername(session?.user?.user_metadata?.username || '');
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
        setMenuView('main');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      subscription.unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setUsername(user?.user_metadata?.username || '');
    await loadWorkspaces();
  };

  const loadWorkspaces = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      setWorkspaces(data || []);
      const activeId = getActiveCompanyId();
      if (activeId && data) {
        const active = data.find(w => w.id === activeId);
        setActiveWorkspace(active || data[0]);
      }
    } catch (err) {
      console.error("Error loading workspaces:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { username: username }
      });
      if (error) throw error;
      alert("Account updated successfully!");
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const switchWorkspace = (ws: any) => {
    localStorage.setItem('activeCompanyId', ws.id);
    localStorage.setItem('activeCompanyName', ws.name);
    setActiveWorkspace(ws);
    setShowAccountMenu(false);
    setMenuView('main');
    window.dispatchEvent(new Event('appSettingsChanged'));
    navigate('/', { replace: true });
    // Force a small delay then refresh to ensure all components grab the new ID
    setTimeout(() => window.location.reload(), 100);
  };

const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: BadgeIndianRupee, label: 'Sales/Invoices', path: '/sales' },
    { icon: ShoppingCart, label: 'Purchase Bills', path: '/bills' },
    { icon: Wallet, label: 'Prime Ledger', path: '/ledger' }, // New Name & Path
    { icon: UserSquare2, label: 'Customers', path: '/customers' },
    { icon: Users, label: 'Vendors', path: '/vendors' },
    { icon: Package, label: 'Inventory', path: '/stock' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
    { icon: Percent, label: 'Duties & Taxes', path: '/taxes' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out z-20`}>
        <div className="h-16 flex items-center px-6 border-b border-slate-100 shrink-0">
          <Logo size={32} />
          {isSidebarOpen && <span className="ml-3 font-bold text-lg tracking-tight text-slate-900 uppercase">Findesk <span className="text-primary">Prime</span></span>}
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2.5 rounded-lg transition-all group ${
                  isActive ? 'bg-primary text-slate-900 shadow-sm font-semibold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {isSidebarOpen && <span className="ml-3 text-[13px]">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 relative z-30">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
              <Menu className="w-5 h-5" />
            </button>
            <div className="h-4 w-[1px] bg-slate-200 mx-2" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Active Workspace</span>
              <span className="text-sm font-bold text-slate-700">{activeWorkspace?.name || 'Loading...'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="relative" ref={accountMenuRef}>
              <button 
                onClick={() => { setShowAccountMenu(!showAccountMenu); setMenuView('main'); }}
                className="flex items-center space-x-3 p-1.5 pl-3 hover:bg-slate-50 rounded-full border border-slate-200 transition-all active:scale-95 bg-white"
              >
                <div className="flex flex-col items-end mr-1">
                  <span className="text-xs font-bold text-slate-900 leading-tight">{user?.user_metadata?.username || 'User'}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Administrator</span>
                </div>
                <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white ring-2 ring-white">
                  <UserCircle className="w-5 h-5" />
                </div>
              </button>

              {showAccountMenu && (
                <div className="absolute right-0 mt-3 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl py-3 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                  {menuView === 'main' ? (
                    <>
                      <div className="px-5 py-3 border-b border-slate-100 mb-2 bg-slate-50/50 rounded-t-xl">
                        <p className="text-sm font-bold text-slate-900 truncate">{user?.user_metadata?.username || 'Account'}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{user?.email}</p>
                      </div>
                      
                      <div className="px-2 space-y-1">
                        <button 
                          onClick={() => { setIsEditModalOpen(true); setShowAccountMenu(false); }}
                          className="w-full flex items-center px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors group"
                        >
                          <UserCog className="w-4.5 h-4.5 mr-3 text-slate-400 group-hover:text-slate-900" />
                          Edit Account
                        </button>
                        <button 
                          onClick={() => setMenuView('switch')}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors group"
                        >
                          <div className="flex items-center">
                            <SwitchCamera className="w-4.5 h-4.5 mr-3 text-slate-400 group-hover:text-slate-900" />
                            Switch Workspace
                          </div>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">{workspaces.length}</span>
                        </button>
                        <div className="h-[1px] bg-slate-100 my-1 mx-2" />
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors group"
                        >
                          <LogOut className="w-4.5 h-4.5 mr-3 text-red-400 group-hover:text-red-500" />
                          Logout
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2 border-b border-slate-100 mb-2 flex items-center">
                        <button onClick={() => setMenuView('main')} className="p-1 hover:bg-slate-100 rounded-md mr-2">
                          <ChevronLeft className="w-4 h-4 text-slate-500" />
                        </button>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Workspace</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto px-2 space-y-1 custom-scrollbar">
                        {workspaces.map((ws) => (
                          <button
                            key={ws.id}
                            onClick={() => switchWorkspace(ws)}
                            className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors ${activeWorkspace?.id === ws.id ? 'bg-primary text-slate-900' : 'hover:bg-slate-50 text-slate-700'}`}
                          >
                            <Building2 className={`w-4 h-4 mr-3 ${activeWorkspace?.id === ws.id ? 'text-slate-900' : 'text-slate-400'}`} />
                            <div className="text-left overflow-hidden">
                              <p className="text-xs font-bold truncate">{ws.name}</p>
                              <p className={`text-[9px] font-mono opacity-60 truncate ${activeWorkspace?.id === ws.id ? 'text-slate-900' : 'text-slate-400'}`}>{ws.gstin || 'No GSTIN'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-100 px-2">
                        <button onClick={() => { navigate('/companies'); setShowAccountMenu(false); }} className="w-full flex items-center px-3 py-2 text-[11px] font-bold text-link hover:bg-blue-50 rounded-lg uppercase">
                          <Plus className="w-3.5 h-3.5 mr-2" /> Manage Workspaces
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-8 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Account Settings" maxWidth="max-w-md">
        <form onSubmit={handleUpdateAccount} className="p-8 space-y-6 bg-white">
          <div className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input disabled type="email" value={user?.email || ''} className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-400 cursor-not-allowed outline-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Display Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input required type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:border-primary transition-all" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end space-x-4">
            <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">Cancel</button>
            <button type="submit" disabled={editLoading} className="bg-primary text-slate-900 px-8 py-2.5 rounded-lg font-bold text-xs uppercase hover:bg-primary-dark transition-all flex items-center shadow-md">
              {editLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Layout;
