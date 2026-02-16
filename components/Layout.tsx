import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { LayoutDashboard, Users, UserSquare2, BadgeIndianRupee, Package, BarChart3, Settings as SettingsIcon, ShoppingCart, Percent, BookOpen, ChevronDown, Building2, Menu, LogOut, Edit, Trash2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import Logo from './Logo';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const { activeCompany, setCompany } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();

  // Edit/Delete Workspace States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingWs, setEditingWs] = useState<any>(null);
  const [wsFormData, setWsFormData] = useState({ name: '', gstin: '', address: '' });
  const [isDeletingWs, setIsDeletingWs] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; ws: any | null }>({ isOpen: false, ws: null });

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

  const openEditWs = (e: React.MouseEvent, ws: any) => {
    e.stopPropagation();
    setEditingWs(ws);
    setWsFormData({ name: ws.name, gstin: ws.gstin || '', address: ws.address || '' });
    setIsEditModalOpen(true);
    setShowWorkspaceMenu(false);
  };

  const openDeleteWs = (e: React.MouseEvent, ws: any) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, ws });
    setShowWorkspaceMenu(false);
  };

  const handleUpdateWs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsFormData.name.trim() || !editingWs) return;
    try {
      const { error } = await supabase
        .from('companies')
        .update({ 
          name: wsFormData.name.trim().toUpperCase(),
          gstin: wsFormData.gstin.trim().toUpperCase(),
          address: wsFormData.address.trim()
        })
        .eq('id', editingWs.id);
      
      if (error) throw error;
      
      if (activeCompany?.id === editingWs.id) {
          await setCompany({ ...editingWs, ...wsFormData, name: wsFormData.name.toUpperCase() });
      }
      
      setIsEditModalOpen(false);
      loadWorkspaces();
    } catch (err: any) {
      alert(`Update Failed: ${err.message}`);
    }
  };

  const handleConfirmDeleteWs = async () => {
    if (!deleteConfirm.ws) return;
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_deleted: true })
        .eq('id', deleteConfirm.ws.id);
      
      if (error) throw error;
      
      if (activeCompany?.id === deleteConfirm.ws.id) {
        localStorage.removeItem('activeCompanyId');
        localStorage.removeItem('activeCompanyName');
        navigate('/companies', { replace: true });
      } else {
        loadWorkspaces();
      }
    } catch (err: any) {
      alert(`Delete Failed: ${err.message}`);
    } finally {
      setDeleteConfirm({ isOpen: false, ws: null });
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
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded shadow-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
                    {workspaces.map((ws) => (
                      <div 
                        key={ws.id}
                        className={`w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer group ${activeCompany?.id === ws.id ? 'bg-primary/10' : ''}`}
                        onClick={() => handleSwitchWorkspace(ws)}
                      >
                        <div className="flex items-center min-w-0 flex-1">
                            <Building2 className={`w-3.5 h-3.5 mr-2 shrink-0 ${activeCompany?.id === ws.id ? 'text-slate-900' : 'text-slate-400'}`} />
                            <span className={`truncate capitalize text-xs ${activeCompany?.id === ws.id ? 'font-medium text-slate-900' : 'text-slate-600'}`}>{ws.name}</span>
                        </div>
                        <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => openEditWs(e, ws)} className="p-1 text-slate-400 hover:text-slate-900 hover:bg-white rounded"><Edit className="w-3 h-3" /></button>
                            <button onClick={(e) => openDeleteWs(e, ws)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-white rounded"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
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

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Workspace Configuration" maxWidth="max-w-xl">
        <form onSubmit={handleUpdateWs} className="p-6 space-y-6">
            <div className="space-y-4 border border-slate-200 rounded-md p-6">
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 capitalize">Workspace Name</label>
                    <input required value={wsFormData.name} onChange={e => setWsFormData({...wsFormData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:border-slate-400 outline-none capitalize font-medium" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 capitalize">GSTIN Number</label>
                    <input value={wsFormData.gstin} onChange={e => setWsFormData({...wsFormData, gstin: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:border-slate-400 outline-none font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 capitalize">Business Address</label>
                    <textarea value={wsFormData.address} onChange={e => setWsFormData({...wsFormData, address: e.target.value})} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:border-slate-400 outline-none resize-none" />
                </div>
            </div>
            <div className="flex justify-end pt-2">
                <button type="submit" className="bg-primary text-slate-900 px-8 py-2.5 rounded font-medium text-xs hover:bg-primary-dark capitalize shadow-sm flex items-center">
                    <Save className="w-3.5 h-3.5 mr-2" /> Update Workspace
                </button>
            </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog 
        isOpen={deleteConfirm.isOpen} 
        onClose={() => setDeleteConfirm({ isOpen: false, ws: null })} 
        onConfirm={handleConfirmDeleteWs} 
        title="Delete Workspace" 
        message={`This will permanently remove "${deleteConfirm.ws?.name}" and all its data. Are you sure?`} 
      />
    </div>
  );
};

export default Layout;