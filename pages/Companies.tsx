
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Loader2, Check, Globe, LogOut } from 'lucide-react';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';

const Companies = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', gstin: '', address: '', state: '' });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate('/setup');
    const { data } = await supabase.from('companies').select('*').eq('user_id', user.id).eq('is_deleted', false).order('created_at', { ascending: false });
    setCompanies(data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name.trim()) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('companies').insert([{ ...newCompany, user_id: user?.id }]).select();
      if (error) throw error;
      setNewCompany({ name: '', gstin: '', address: '', state: '' });
      setIsModalOpen(false);
      await loadData();
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="w-full px-8 md:px-16 lg:px-24 py-16">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">Workspaces & Accounts</h1>
            <p className="text-slate-500 text-lg font-medium">Select a business entity to manage purchases and inventory.</p>
          </div>
          <button 
            onClick={() => { supabase.auth.signOut(); navigate('/setup'); }} 
            className="flex items-center space-x-2 px-6 py-3 border border-slate-200 text-slate-600 bg-white rounded-lg hover:bg-slate-50 text-sm font-bold transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Switch User</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-6 mb-12">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
            <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search registered workspaces..." 
                className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-400 font-medium text-lg shadow-sm transition-all" 
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-primary text-slate-900 px-10 py-5 rounded-xl font-bold border border-primary hover:bg-primary-dark shadow-md flex items-center justify-center text-base transition-all active:scale-95"
          >
            <Plus className="w-5 h-5 mr-3" /> Register New Account
          </button>
        </div>

        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Synchronizing Clouds...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {companies.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((company) => (
              <div 
                key={company.id} 
                onClick={() => selectCompany(company)} 
                className="bg-white border border-slate-200 rounded-2xl p-10 boxy-shadow cursor-pointer hover:border-primary group transition-all relative flex flex-col h-full"
              >
                <div className="w-16 h-16 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center mb-8 group-hover:bg-primary transition-colors duration-300 shadow-inner">
                    <Building2 className="w-8 h-8 text-slate-400 group-hover:text-slate-900 transition-colors" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-primary-dark transition-colors truncate mb-2">{company.name}</h3>
                <p className="text-sm text-slate-400 font-mono mb-6">{company.gstin || 'No GST Registered'}</p>
                
                <div className="mt-auto space-y-4 pt-8 border-t border-slate-50">
                  <div className="flex items-center space-x-3 text-sm font-bold text-slate-500">
                    <Globe className="w-4 h-4 text-slate-300" /> 
                    <span>{company.state || 'Global Territory'}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-slate-300 group-hover:text-slate-900 transition-colors uppercase tracking-widest">
                    <span>Enter Dashboard</span>
                    <Check className="w-5 h-5 opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </div>
            ))}
            
            <div 
                onClick={() => setIsModalOpen(true)}
                className="border-4 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-slate-300 hover:border-slate-300 hover:text-slate-400 cursor-pointer transition-all group"
            >
                <Plus className="w-12 h-12 mb-4 transform group-hover:scale-110 transition-transform" />
                <p className="text-lg font-bold uppercase tracking-widest">Add Workspace</p>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Business Workspace">
        <form onSubmit={handleCreateCompany} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-bold text-slate-500 capitalize">Legal Workspace Name</label>
              <input required type="text" value={newCompany.name} onChange={(e) => setNewCompany({...newCompany, name: e.target.value})} className="w-full px-5 py-4 border border-slate-200 rounded-lg outline-none text-lg font-bold text-slate-900 focus:border-slate-400 shadow-sm" placeholder="e.g. Acme Corp India Pvt Ltd" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 capitalize">GSTIN Number (Optional)</label>
              <input type="text" value={newCompany.gstin} onChange={(e) => setNewCompany({...newCompany, gstin: e.target.value.toUpperCase()})} className="w-full px-5 py-4 border border-slate-200 rounded-lg outline-none text-base font-mono font-bold tracking-widest" placeholder="27AAAAA0000A1Z5" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 capitalize">Operating State</label>
              <input required type="text" value={newCompany.state} onChange={(e) => setNewCompany({...newCompany, state: e.target.value})} className="w-full px-5 py-4 border border-slate-200 rounded-lg outline-none text-base font-bold text-slate-700" placeholder="e.g. Maharashtra" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-500 capitalize">Registered Business Address</label>
            <textarea value={newCompany.address} onChange={(e) => setNewCompany({...newCompany, address: e.target.value})} className="w-full px-5 py-4 border border-slate-200 rounded-lg outline-none h-32 resize-none text-base font-medium shadow-sm" placeholder="Complete address for billing and taxes..." />
          </div>
          <button type="submit" disabled={creating} className="w-full bg-primary text-slate-900 py-5 rounded-lg font-bold border border-primary text-lg hover:bg-primary-dark transition-all flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50">
            {creating ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Plus className="w-6 h-6 mr-3" />} Complete Registration
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Companies;
