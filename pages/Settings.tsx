
import React, { useState, useEffect } from 'react';
import { User, Building2, Trash2, RotateCcw, ShieldAlert, Check, Loader2, Mail, Globe, Settings as SettingsIcon } from 'lucide-react';
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
      const { error: userError } = await supabase.auth.updateUser({
          data: { name: profile.name }
      });
      
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
    <div className="mb-8">
      <h3 className="text-xl font-bold text-slate-900 leading-tight mb-1">{title}</h3>
      <p className="text-sm text-slate-500 font-medium">{desc}</p>
    </div>
  );

  return (
    <div className="w-full space-y-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-2">Global System Configuration</h1>
          <p className="text-slate-500 font-medium text-sm">Personal preferences, workspace details, and data recovery console.</p>
        </div>
        <div className="flex space-x-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner">
           {['Profile', 'Trash'].map(t => (
             <button key={t} onClick={() => setActiveTab(t)} className={`px-8 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-slate-900 shadow-md border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
           ))}
        </div>
      </div>

      {activeTab === 'Profile' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-2xl p-10 boxy-shadow">
            <SectionHeader title="User Identity Profile" desc="Personal authentication and visibility settings." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Master Login Alias</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input type="email" value={profile.email} disabled className="w-full h-14 pl-12 pr-6 border border-slate-200 rounded-xl bg-slate-50 text-slate-400 cursor-not-allowed font-bold" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Public Display Identity</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                  <input 
                    type="text" 
                    value={profile.name} 
                    onChange={(e) => setProfile({...profile, name: e.target.value})} 
                    className="w-full h-14 pl-12 pr-6 border border-slate-200 rounded-xl outline-none focus:border-slate-400 font-bold text-slate-900 shadow-sm transition-all" 
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-100 mb-12" />
            
            <SectionHeader title="Active Workspace Profile" desc="Verified business information for tax invoices and billing." />
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Legal Business Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input 
                      type="text" 
                      value={workspaceInfo.name} 
                      onChange={(e) => setWorkspaceInfo({...workspaceInfo, name: e.target.value})} 
                      className="w-full h-14 pl-12 pr-6 border border-slate-200 rounded-xl outline-none focus:border-slate-400 font-bold text-slate-900 shadow-sm transition-all" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">GSTIN Identification</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <input 
                      type="text" 
                      value={workspaceInfo.gstin} 
                      onChange={(e) => setWorkspaceInfo({...workspaceInfo, gstin: e.target.value.toUpperCase()})} 
                      className="w-full h-14 pl-12 pr-6 border border-slate-200 rounded-xl outline-none focus:border-slate-400 font-mono font-bold text-slate-900 shadow-sm transition-all tracking-widest" 
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered Office Address</label>
                <textarea 
                  rows={4} 
                  value={workspaceInfo.address} 
                  onChange={(e) => setWorkspaceInfo({...workspaceInfo, address: e.target.value})} 
                  className="w-full p-6 border border-slate-200 rounded-xl outline-none focus:border-slate-400 text-base font-bold text-slate-700 resize-none shadow-sm transition-all shadow-inner" 
                />
              </div>
            </div>

            <div className="mt-12 flex justify-end">
              <button 
                onClick={handleUpdateProfile}
                disabled={loading}
                className="px-12 py-4 bg-primary text-slate-900 font-bold uppercase text-xs tracking-widest rounded-xl border border-primary flex items-center hover:bg-primary-dark transition-all disabled:opacity-50 shadow-xl active:scale-95"
              >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Check className="w-5 h-5 mr-3" />}
                  Commit System Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Trash' && (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-red-50 p-8 border border-red-100 rounded-2xl flex items-start gap-6 shadow-inner">
                <div className="p-3 bg-white text-red-500 rounded-xl shrink-0 border border-red-100 shadow-sm">
                   <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-red-900 font-bold text-base mb-1 uppercase tracking-tight">Voucher & Data Recovery Center</h4>
                  <p className="text-sm text-red-700 font-medium leading-relaxed max-w-3xl">
                      Records below are in a suspended state. Restoring them will re-integrate them into active ledgers and analytics immediately. Caution: Permanent deletion is physically erased from cloud storage and cannot be undone.
                  </p>
                </div>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden boxy-shadow">
                {trashLoading ? (
                  <div className="py-40 flex flex-col items-center justify-center">
                      <Loader2 className="w-10 h-10 animate-spin text-slate-300 mb-4" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scanning Archived Blobs...</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-base border-collapse">
                      <thead className="bg-slate-50/80 border-b border-slate-200">
                          <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                              <th className="py-5 px-8">Archived Entry / Label</th>
                              <th className="py-5 px-8">Entity Classification</th>
                              <th className="py-5 px-8 text-center">Protocol Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {trashItems.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50 transition-all duration-200 group">
                                  <td className="py-5 px-8 border-r border-slate-200/50">
                                      <p className="font-bold text-slate-800 text-base mb-0.5">{item.label}</p>
                                      <p className="text-[10px] text-slate-400 font-mono tracking-widest">UID: {item.id.slice(0, 12).toUpperCase()}...</p>
                                  </td>
                                  <td className="py-5 px-8 border-r border-slate-200/50">
                                      <span className="text-[10px] px-3 py-1 rounded-lg border-2 border-slate-100 bg-white uppercase font-black text-slate-400 tracking-widest shadow-sm">
                                          {item.type}
                                      </span>
                                  </td>
                                  <td className="py-5 px-8">
                                      <div className="flex justify-center space-x-4 opacity-100 transition-opacity">
                                          <button 
                                            onClick={() => handleRestore(item)} 
                                            className="flex items-center space-x-2 px-6 py-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-100 transition-all font-bold text-xs uppercase tracking-widest active:scale-95"
                                          >
                                            <RotateCcw className="w-4 h-4" />
                                            <span>Restore</span>
                                          </button>
                                          <button 
                                            onClick={() => handlePermDelete(item)} 
                                            className="flex items-center space-x-2 px-6 py-2.5 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-600 hover:text-white transition-all font-bold text-xs uppercase tracking-widest active:scale-95"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                            <span>Wipe</span>
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {trashItems.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-40 text-center text-slate-300 italic font-medium text-base">
                                Archival storage is currently empty. No soft-deleted records detected.
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
