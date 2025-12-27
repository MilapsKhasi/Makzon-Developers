
import React, { useState, useEffect } from 'react';
import { User, Building2, Trash2, RotateCcw, ShieldAlert, Check, Loader2, Mail, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('Profile');
  const [user, setUser] = useState<any>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [workspaceInfo, setWorkspaceInfo] = useState({ name: '', gstin: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [trashItems, setTrashItems] = useState<any[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);

  useEffect(() => {
    loadProfile();
    loadTrash();
  }, []);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setProfile({ 
      name: user?.user_metadata?.name || 'Workspace User', 
      email: user?.email || '' 
    });

    const cid = getActiveCompanyId();
    if (cid) {
      const { data } = await supabase.from('companies').select('*').eq('id', cid).single();
      if (data) {
        setActiveWorkspace(data);
        setWorkspaceInfo({ name: data.name, gstin: data.gstin || '', address: data.address || '' });
      }
    }
  };

  const loadTrash = async () => {
    setTrashLoading(true);
    const cid = getActiveCompanyId();
    const { data: b } = await supabase.from('bills').select('id, bill_number, created_at').eq('is_deleted', true).eq('company_id', cid);
    const { data: s } = await supabase.from('stock_items').select('id, name, created_at').eq('is_deleted', true).eq('company_id', cid);
    const { data: v } = await supabase.from('vendors').select('id, name, created_at').eq('is_deleted', true).eq('company_id', cid);
    const { data: dt } = await supabase.from('duties_taxes').select('id, name, created_at').eq('is_deleted', true).eq('company_id', cid);
    const { data: c } = await supabase.from('companies').select('id, name, created_at').eq('is_deleted', true);
    
    const combined = [
        ...(b || []).map(x => ({ ...x, type: 'Bill', label: x.bill_number })),
        ...(s || []).map(x => ({ ...x, type: 'Stock', label: x.name })),
        ...(v || []).map(x => ({ ...x, type: 'Vendor', label: x.name })),
        ...(dt || []).map(x => ({ ...x, type: 'Tax Master', label: x.name })),
        ...(c || []).map(x => ({ ...x, type: 'Workspace', label: x.name }))
    ];
    setTrashItems(combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setTrashLoading(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Update Auth Metadata (User Name)
      const { error: userError } = await supabase.auth.updateUser({
          data: { name: profile.name }
      });
      
      // Update Current Workspace Details
      const cid = getActiveCompanyId();
      const { error: wsError } = await supabase.from('companies').update({
          name: workspaceInfo.name,
          gstin: workspaceInfo.gstin,
          address: workspaceInfo.address
      }).eq('id', cid);

      if (userError || wsError) throw userError || wsError;
      
      alert("Account information updated successfully!");
      loadProfile();
      window.dispatchEvent(new Event('appSettingsChanged'));
    } catch (err: any) {
      alert("Update failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item: any) => {
    const tableMap: any = { 
      'Bill': 'bills', 
      'Stock': 'stock_items', 
      'Vendor': 'vendors', 
      'Workspace': 'companies',
      'Tax Master': 'duties_taxes'
    };
    const table = tableMap[item.type];
    const { error } = await supabase.from(table).update({ is_deleted: false }).eq('id', item.id);
    if (!error) {
      loadTrash();
      window.dispatchEvent(new Event('appSettingsChanged'));
    } else {
      alert(error.message);
    }
  };

  const handlePermDelete = async (item: any) => {
    if (!confirm(`Permanently delete this ${item.type}? This cannot be undone.`)) return;
    const tableMap: any = { 
      'Bill': 'bills', 
      'Stock': 'stock_items', 
      'Vendor': 'vendors', 
      'Workspace': 'companies',
      'Tax Master': 'duties_taxes'
    };
    const table = tableMap[item.type];
    const { error } = await supabase.from(table).delete().eq('id', item.id);
    if (!error) loadTrash();
    else alert(error.message);
  };

  const SectionHeader = ({ title, desc }: any) => (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-500">{desc}</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200">
           {['Profile', 'Trash'].map(t => (
             <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
           ))}
        </div>
      </div>

      {activeTab === 'Profile' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-lg p-8 boxy-shadow">
            <SectionHeader title="User Information" desc="Manage your personal details and account credentials." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Login Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input type="email" value={profile.email} disabled className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded bg-slate-50 text-slate-400 cursor-not-allowed font-medium" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    value={profile.name} 
                    onChange={(e) => setProfile({...profile, name: e.target.value})} 
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded outline-none focus:border-slate-400 font-medium" 
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-100 mb-8" />
            
            <SectionHeader title="Active Workspace" desc="Update details for the current business entity." />
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" 
                      value={workspaceInfo.name} 
                      onChange={(e) => setWorkspaceInfo({...workspaceInfo, name: e.target.value})} 
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded outline-none focus:border-slate-400 font-medium" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GSTIN Number</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      type="text" 
                      value={workspaceInfo.gstin} 
                      onChange={(e) => setWorkspaceInfo({...workspaceInfo, gstin: e.target.value.toUpperCase()})} 
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded outline-none focus:border-slate-400 font-mono font-medium" 
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered Address</label>
                <textarea 
                  rows={3} 
                  value={workspaceInfo.address} 
                  onChange={(e) => setWorkspaceInfo({...workspaceInfo, address: e.target.value})} 
                  className="w-full p-4 border border-slate-200 rounded outline-none focus:border-slate-400 text-sm font-medium resize-none" 
                />
              </div>
            </div>

            <div className="mt-10 flex justify-end">
              <button 
                onClick={handleUpdateProfile}
                disabled={loading}
                className="px-8 py-3 bg-primary text-slate-900 font-bold uppercase text-[10px] tracking-widest rounded-md border border-slate-200 flex items-center hover:bg-primary-dark transition-all disabled:opacity-50 shadow-md active:scale-95"
              >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Save All Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Trash' && (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-red-50 p-6 border border-red-100 rounded-lg flex items-start">
                <ShieldAlert className="w-6 h-6 text-red-500 mr-4 shrink-0" />
                <div>
                  <h4 className="text-red-900 font-bold text-sm mb-1 uppercase tracking-tight">Data Recovery Center</h4>
                  <p className="text-xs text-red-700 font-medium leading-relaxed">Items listed below are "soft-deleted". Restoring them will place them back into your active workspace immediately. Permanent deletion is irreversible.</p>
                </div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden boxy-shadow">
                {trashLoading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                ) : (
                  <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                          <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <th className="py-4 px-6">Archived Record</th>
                              <th className="py-4 px-6">Entity Type</th>
                              <th className="py-4 px-6 text-center">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {trashItems.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-4 px-6">
                                      <p className="font-semibold text-slate-800 text-sm">{item.label}</p>
                                      <p className="text-[10px] text-slate-400 font-mono">ID: {item.id.slice(0, 8)}...</p>
                                  </td>
                                  <td className="py-4 px-6">
                                      <span className="text-[9px] px-2 py-1 rounded-md border border-slate-200 bg-white uppercase font-black text-slate-500 tracking-tighter shadow-sm">
                                          {item.type}
                                      </span>
                                  </td>
                                  <td className="py-4 px-6">
                                      <div className="flex justify-center space-x-3">
                                          <button 
                                            onClick={() => handleRestore(item)} 
                                            className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold uppercase">Restore</span>
                                          </button>
                                          <button 
                                            onClick={() => handlePermDelete(item)} 
                                            className="flex items-center space-x-2 px-3 py-1.5 bg-red-50 text-red-500 rounded border border-red-100 hover:bg-red-100 transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold uppercase">Delete</span>
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {trashItems.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-32 text-center text-slate-300 italic text-sm">
                                Your trash is currently empty.
                              </td>
                            </tr>
                          )}
                      </tbody>
                  </table>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
