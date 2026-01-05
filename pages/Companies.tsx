
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Search, Loader2, Check, Globe, LogOut, Save, User, ArrowRight, X } from 'lucide-react';
import Modal from '../components/Modal';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';

const Companies = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', gstin: '', address: '', state: '' });
  const [creating, setCreating] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate('/setup');
    setUserEmail(user.email || null);
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
      const { error } = await supabase.from('companies').insert([{ 
        ...newCompany, 
        name: newCompany.name.trim().toUpperCase(),
        gstin: newCompany.gstin.trim().toUpperCase(),
        state: newCompany.state.trim().toUpperCase(),
        user_id: user?.id 
      }]).select();
      
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate('/setup');
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.gstin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden font-sans">
      <header className="h-16 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-[100] bg-white">
        <div className="flex items-center space-x-2">
          <Logo size={32} />
          <div className="flex items-center px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50 cursor-not-allowed">
            <span className="text-xs font-normal text-slate-400 uppercase tracking-tight mr-2">Workspaces</span>
          </div>
        </div>

        <div className="flex-1 max-w-lg mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workspaces..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 border border-slate-100 rounded uppercase">
            {userEmail}
          </div>
          <button onClick={handleLogout} className="p-2 border border-slate-200 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-500 transition-none">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 bg-white">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-normal text-slate-900">Workspaces & Accounts</h1>
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark transition-none flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" /> NEW ACCOUNT
            </button>
          </div>

          {loading ? (
            <div className="py-40 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-slate-400 font-normal text-xs uppercase tracking-widest">Synchronizing Accounts...</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
              <table className="clean-table">
                <thead>
                  <tr>
                    <th className="w-16">SR NO</th>
                    <th>BUSINESS NAME</th>
                    <th>GSTIN</th>
                    <th>OPERATING STATE</th>
                    <th className="text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((company, i) => (
                    <tr key={company.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => selectCompany(company)}>
                      <td>{i + 1}</td>
                      <td>
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-center mr-3">
                            <Building2 className="w-4 h-4 text-slate-400" />
                          </div>
                          <span className="font-medium text-slate-900 uppercase">{company.name}</span>
                        </div>
                      </td>
                      <td className="font-mono text-slate-500">{company.gstin || 'UNREGISTERED'}</td>
                      <td>
                        <span className="text-[11px] font-normal text-slate-500 uppercase">{company.state || 'N/A'}</span>
                      </td>
                      <td className="text-right">
                        <button className="text-slate-400 hover:text-slate-900 flex items-center justify-end w-full space-x-1 group transition-none">
                          <span className="text-[10px] font-bold uppercase opacity-0 group-hover:opacity-100">ENTER</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-32 text-center text-slate-400 italic text-sm">
                        {searchQuery ? `No workspaces found matching "${searchQuery}"` : "No accounts registered yet. Click 'NEW ACCOUNT' to get started."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register Business Workspace" maxWidth="max-w-4xl">
        <form onSubmit={handleCreateCompany} className="p-8 space-y-6">
          <div className="border border-slate-200 rounded-md p-8 space-y-6 bg-white">
            <div className="space-y-1.5">
              <label className="text-[14px] font-normal text-slate-900">Legal Workspace Name</label>
              <input 
                required 
                type="text" 
                value={newCompany.name} 
                onChange={(e) => setNewCompany({...newCompany, name: e.target.value})} 
                className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 uppercase bg-white font-medium" 
                placeholder="e.g. ACME SOLUTIONS PVT LTD" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[14px] font-normal text-slate-900">GSTIN (Optional)</label>
                <input 
                  type="text" 
                  value={newCompany.gstin} 
                  onChange={(e) => setNewCompany({...newCompany, gstin: e.target.value.toUpperCase()})} 
                  className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] font-mono focus:border-slate-400 bg-white" 
                  placeholder="27AAAAA0000A1Z5" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[14px] font-normal text-slate-900">Operating State</label>
                <input 
                  required 
                  type="text" 
                  value={newCompany.state} 
                  onChange={(e) => setNewCompany({...newCompany, state: e.target.value})} 
                  className="w-full px-4 py-2 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 uppercase bg-white font-medium" 
                  placeholder="e.g. MAHARASHTRA" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-normal text-slate-900">Registered Business Address</label>
              <textarea 
                value={newCompany.address} 
                onChange={(e) => setNewCompany({...newCompany, address: e.target.value})} 
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded outline-none text-[14px] focus:border-slate-400 resize-none bg-white/30 focus:bg-white transition-all" 
                placeholder="Enter complete office address for records..." 
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-6">
            <button 
              type="button" 
              onClick={() => setIsModalOpen(false)} 
              className="text-[13px] text-slate-500 hover:text-slate-800 transition-none font-normal"
            >
              Discard
            </button>
            <button 
              type="submit" 
              disabled={creating} 
              className="bg-primary text-slate-900 px-10 py-3 rounded font-bold text-[14px] hover:bg-primary-dark transition-none flex items-center shadow-lg shadow-primary/5 active:scale-95"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {creating ? 'REGISTERING...' : 'SAVE WORKSPACE'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Companies;
