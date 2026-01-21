import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Loader2, LogOut, ArrowRight, RefreshCw, WifiOff } from 'lucide-react';
import Modal from '../components/Modal';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';

const Companies = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', gstin: '', address: '' });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      setCompanies(data || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name.trim()) return;
    setCreating(true);

    try {
      // MASTER SCRIPT: No companies_users table. Trigger handles membership.
const { data, error } = await supabase
  .from('companies')
  .insert([
    { 
      name: companyName, 
      user_id: (await supabase.auth.getUser()).data.user?.id // <--- Add this line
    }
  ]);

      if (error) throw error;

      if (data && data[0]) {
        localStorage.setItem('activeCompanyId', data[0].id);
        localStorage.setItem('activeCompanyName', data[0].name);
        window.dispatchEvent(new Event('appSettingsChanged'));
        setTimeout(() => navigate('/', { replace: true }), 500);
      }
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const selectCompany = (ws: any) => {
    localStorage.setItem('activeCompanyId', ws.id);
    localStorage.setItem('activeCompanyName', ws.name);
    window.dispatchEvent(new Event('appSettingsChanged'));
    navigate('/', { replace: true });
  };

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.gstin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden font-sans text-slate-900">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 bg-white">
        <div className="flex items-center space-x-2">
          <Logo size={32} />
          <div className="flex items-center px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Workspaces</span>
          </div>
        </div>
        <div className="flex-1 max-w-lg mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter your accounts..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded text-xs outline-none focus:border-slate-400"
            />
          </div>
        </div>
        <div className="flex items-center space-x-4">
           <button onClick={() => supabase.auth.signOut()} className="p-2 text-slate-400 hover:text-red-500 rounded transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-10 bg-white">
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Select Workspace</h1>
                <p className="text-slate-500 text-sm mt-1">Access your digital finance desk.</p>
              </div>
              <button onClick={() => setIsModalOpen(true)} className="bg-primary text-slate-900 px-8 py-3 rounded-md font-bold text-sm hover:bg-primary-dark shadow-sm active:scale-95 flex items-center">
                <Plus className="w-4 h-4 mr-2" /> NEW WORKSPACE
              </button>
            </div>

            {loading ? (
              <div className="py-40 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCompanies.map((company) => (
                  <div key={company.id} onClick={() => selectCompany(company)}
                    className="group p-6 bg-white border border-slate-200 rounded-lg hover:border-slate-400 hover:bg-slate-50 cursor-pointer transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-colors">
                        <Building2 className="w-6 h-6 text-slate-400 group-hover:text-slate-900" />
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="font-bold text-lg uppercase truncate">{company.name}</h3>
                    <p className="text-[11px] font-mono text-slate-400 mb-4">{company.gstin || 'UNREGISTERED'}</p>
                    <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      <span className="bg-white border border-slate-200 px-2 py-0.5 rounded mr-2">ACCOUNT OK</span>
                      <span>ENTER DESK</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Business Workspace" maxWidth="max-w-2xl">
        <form onSubmit={handleCreateCompany} className="p-8 space-y-6 bg-white">
          <div className="space-y-6 border border-slate-200 rounded-md p-8 bg-white">
            <div className="space-y-1.5">
              <label className="text-sm font-bold uppercase text-slate-400">Legal Business Name</label>
              <input required type="text" value={newCompany.name} onChange={(e) =>
                setNewCompany({ ...newCompany, name: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded outline-none text-base font-bold uppercase focus:border-slate-400" placeholder="e.g. ACME SOLUTIONS" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold uppercase text-slate-400">GSTIN Identification</label>
              <input type="text" value={newCompany.gstin} onChange={(e) =>
                setNewCompany({ ...newCompany, gstin: e.target.value.toUpperCase() })} className="w-full px-4 py-3 border border-slate-200 rounded outline-none font-mono text-sm uppercase focus:border-slate-400" placeholder="27AAAAA0000A1Z5" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold uppercase text-slate-400">Registered Office Address</label>
              <textarea value={newCompany.address} onChange={(e) =>
                setNewCompany({ ...newCompany, address: e.target.value })} rows={3} className="w-full px-4 py-3 border border-slate-200 rounded outline-none text-sm focus:border-slate-400 resize-none" placeholder="Enter complete office address..." />
            </div>
          </div>
          <div className="flex items-center justify-end space-x-6 pt-4">
            <button type="submit" disabled={creating} className="bg-primary text-slate-900 px-10 py-3 rounded-md font-bold text-sm hover:bg-primary-dark shadow-lg active:scale-95 disabled:opacity-50 flex items-center">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {creating ? 'REGISTERING...' : 'SAVE WORKSPACE'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Companies;
