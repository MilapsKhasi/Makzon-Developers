import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, UserSquare2, BadgeIndianRupee, Package, BarChart3, Settings as SettingsIcon, ShoppingCart, Percent, BookOpen, ChevronDown, Building2, Menu, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import Logo from './Logo';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const { activeCompany, setCompany } = useCompany();
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
    } catch (err) {
      console.error("Error loading workspaces:", err);
    }
  };

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const handleSwitchWorkspace = async (ws: any) => {
    await setCompany(ws);
    setShowWorkspaceMenu(false);
    navigate('/', { replace: true });
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      localStorage.clear();
      navigate('/setup', { replace: true });
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: BadgeIndianRupee, label: 'Sales Invoices', path: '/sales' },
    { icon: ShoppingCart, label: 'Purchase Bills', path: '/bills' },
    { icon: UserSquare2, label: 'Customers', path: '/customers' },
    { icon: Users, label: 'Vendors', path: '/vendors' },
    { icon: Package, label: 'Stock Master', path: '/stock' },
    { icon: BookOpen, label: 'Cashbook', path: '/cashbook' },
    { icon: Percent, label: 'Duties & Taxes', path: '/duties-taxes' },
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
                ? 'bg-primary text-slate-900 font-medium'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${location.pathname === item.path ? 'text-slate-900' : 'text-slate-400'}`} />
              {isSidebarOpen && <span className="ml-3 text-[13px] whitespace-nowrap capitalize">{item.label}</span>}
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
                <span className="font-medium text-slate-700 capitalize text-[11px] max-w-[150px] truncate">
                  {activeCompany?.name || 'Select Workspace'}
                </span>
                <ChevronDown className="ml-2 w-3 h-3 text-slate-400" />
              </button>
              {showWorkspaceMenu && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded shadow-lg overflow-hidden z-50">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
                    {workspaces.map((ws) => (
                      <button
                        key={ws.id}
                        onClick={() => handleSwitchWorkspace(ws)}
                        className={`w-full flex items-center px-4 py-2 text-left text-xs hover:bg-slate-50 transition-colors ${activeCompany?.id === ws.id ? 'bg-primary/10 font-medium' : ''}`}
                      >
                        <Building2 className="w-3.5 h-3.5 text-slate-400 mr-2" />
                        <span className="truncate capitalize">{ws.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-slate-100 py-1 bg-slate-50/50">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center px-4 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-2" />
                      <span className="capitalize">Sign Out</span>
                    </button>
                  </div>
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