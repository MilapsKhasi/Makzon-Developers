import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, UserSquare2, Receipt, BadgeIndianRupee, Package, Database, BarChart3, Settings as SettingsIcon, ShoppingCart, Percent, BookOpen, ChevronDown, Building2, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';
import Logo from './Logo';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, []);

  const loadData = async () => {
    await loadWorkspaces();
  };

  const switchWorkspace = (ws: any) => {
    localStorage.setItem('activeCompanyId', ws.id);
    localStorage.setItem('activeCompanyName', ws.name);
    setActiveWorkspace(ws);
    setShowWorkspaceMenu(false);
    window.dispatchEvent(new Event('appSettingsChanged'));
    navigate('/', { replace: true });
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: BadgeIndianRupee, label: 'Sales/Invoices', path: '/sales' },
    { icon: ShoppingCart, label: 'Purchase Bills', path: '/bills' },
    { icon: UserSquare2, label: 'Customers', path: '/customers' },
    { icon: Users, label: 'Vendors', path: '/vendors' },
    { icon: Package, label: 'Stock Master', path: '/stock' },
    { icon: BookOpen, label: 'Cashbook', path: '/cashbook' },
    { icon: Percent, label: 'Duties/Taxes', path: '/duties-taxes' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className={`${isSidebarOpen ? 'w-56' : 'w-16'} bg-white border-r border-slate-200 flex flex-col z-50 transition-all duration-300`}>
        <div className="h-12 flex items-center px-4 border-b border-slate-100 shrink-0">
          <Logo size={28} />
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 custom-scrollbar">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-3 py-2 rounded transition-colors ${location.pathname === item.path
                ? 'bg-primary text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${location.pathname === item.path ? 'text-slate-900' : 'text-slate-400'}`} />
              {isSidebarOpen && <span className="ml-3 text-[13px] whitespace-nowrap">{item.label}</span>}
            </Link>
          ))}
        </nav>
      </aside>
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-40">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-100 rounded text-slate-500">
              <Menu className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                className="flex items-center px-3 py-1 bg-white border border-slate-200 rounded text-sm hover:border-slate-300 transition-colors"
              >
                <Building2 className="w-3.5 h-3.5 text-slate-400 mr-2" />
                <span className="font-semibold text-slate-700 uppercase text-[11px] max-w-[150px] truncate">
                  {activeWorkspace?.name || 'Workspace'}
                </span>
                <ChevronDown className="ml-2 w-3 h-3 text-slate-400" />
              </button>
              {showWorkspaceMenu && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded shadow-lg py-1 z-50">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => switchWorkspace(ws)}
                      className={`w-full flex items-center px-4 py-2 text-left text-xs hover:bg-slate-50 ${activeWorkspace?.id === ws.id ? 'bg-primary/10 font-bold' : ''}`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-slate-400 mr-2" />
                      <span className="truncate uppercase">{ws.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;