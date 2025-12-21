
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Trash2, Loader2, Check } from 'lucide-react';
import Modal from '../components/Modal';
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate('/setup');

    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    
    setCompanies(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name.trim()) return;
    
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('companies')
        .insert([{ 
          name: newCompany.name, 
          gstin: newCompany.gstin, 
          address: newCompany.address,
          user_id: user.id 
        }])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setNewCompany({ name: '', gstin: '', address: '' });
        setIsModalOpen(false);
        await loadData();
        // If it's the first company, select it automatically
        if (companies.length === 0) {
          selectCompany(data[0]);
        }
      }
    } catch (err: any) {
      alert('Error creating workspace: ' + err.message);
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

  const deleteCompany = async (company: any) => {
    if (!confirm(`Move workspace "${company.name}" to Trash?`)) return;
    const { error } = await supabase.from('companies').update({ is_deleted: true }).eq('id', company.id);
    if (!error) loadData();
  };

  const filtered = companies.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Accounts & Workspaces</h1>
            <p className="text-slate-500 mt-1">Select a business to start managing your purchases.</p>
          </div>
          <button 
            onClick={() => { supabase.auth.signOut(); navigate('/setup'); }}
            className="px-4 py-2 border border-slate-200 text-slate-500 rounded-md hover:bg-white text-xs font-bold uppercase tracking-wider transition-all"
          >
            Sign Out
          </button>
        </div>

        <div className="flex gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workspaces..." 
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-md outline-none focus:border-slate-400 font-medium shadow-sm transition-all"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-slate-800 px-8 py-4 rounded-md font-bold border border-slate-200 flex items-center shadow-sm uppercase text-xs tracking-widest hover:bg-primary-dark transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" /> New Account
          </button>
        </div>

        {loading ? (
          <div className="py-32 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((company) => (
              <div 
                key={company.id}
                onClick={() => selectCompany(company)}
                className="bg-white border border-slate-200 rounded-lg p-8 boxy-shadow cursor-pointer hover:border-primary group flex flex-col transition-all relative"
              >
                <div className="w-14 h-14 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center mb-6 group-hover:bg-primary transition-colors">
                  <Building2 className="w-7 h-7 text-slate-400 group-hover:text-slate-800" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 truncate uppercase tracking-tight">{company.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-1">{company.gstin || 'NO GST RECORDED'}</p>
                
                <div className="mt-10 pt-6 border-t border-slate-50 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-900 flex items-center">
                    Enter Dashboard <Check className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); deleteCompany(company); }} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-24 bg-white border border-dashed border-slate-200 rounded-lg text-center text-slate-400 italic">
                No workspaces found. Click "New Account" to begin your journey.
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register New Account / Workspace">
        <form onSubmit={handleCreateCompany} className="space-y-6">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Workspace Name</label>
            <input required type="text" value={newCompany.name} onChange={(e) => setNewCompany({...newCompany, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-md outline-none focus:border-slate-400 text-sm font-medium" placeholder="e.g. Acme Corporation" />
          </div>
          <div className="grid grid-cols-1 gap-4">
             <div>
               <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">GSTIN (Optional)</label>
               <input type="text" value={newCompany.gstin} onChange={(e) => setNewCompany({...newCompany, gstin: e.target.value.toUpperCase()})} className="w-full px-4 py-3 border border-slate-200 rounded-md outline-none focus:border-slate-400 text-sm font-mono" placeholder="22AAAAA0000A1Z5" />
             </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Business Address</label>
            <textarea value={newCompany.address} onChange={(e) => setNewCompany({...newCompany, address: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded-md outline-none focus:border-slate-400 h-28 resize-none text-sm" placeholder="Street, City, ZIP..." />
          </div>
          <button 
            type="submit" 
            disabled={creating}
            className="w-full bg-primary py-4 rounded-md font-bold border border-slate-200 uppercase text-xs tracking-widest hover:bg-primary-dark transition-all flex items-center justify-center disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            Create Workspace
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Companies;
