
import React, { useState, useEffect } from 'react';
import { User, Building2, Trash2, RotateCcw, ShieldAlert, Check, Loader2, Mail, Globe, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getActiveCompanyId } from '../utils/helpers';

interface SettingsProps {
  onDone?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onDone }) => {
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
      if (onDone) onDone();
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
    <div className="mb-4">
      <h3 className="text-sm font-bold text-slate-900 leading-tight mb-0.5">{title}</h3>
      <p className="text-[11px] text-slate-500 font-medium">{desc}</p>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-center mb-6">
        <div className="flex space-x-1 bg-slate-100 p-1 rounded-md border border-slate-200">
           {['Profile', 'Trash'].map(t => (
             <button key={t} onClick={() => setActiveTab(t)} className={`px-6 py-1.5 rounded text-[11px] font-bold uppercase tracking-tight transition-none ${activeTab === t ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
           ))}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-md p-6 animate-in fade-in duration-300">
        {activeTab === 'Profile' && (
          <div className="space-y-6">
            <div>
              <SectionHeader title="User Identity Profile" desc="Authentication and visibility settings." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Login Alias</label>
                  <input type="email" value={profile.email} disabled className="w-full px-3 py-2 border border-slate-200 rounded bg-slate-50 text-slate-400 cursor-not-allowed text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Public Name</label>
                  <input 
                    type="text" 
                    value={profile.name} 
                    onChange={(e) => setProfile({...profile, name: e.target.value})} 
                    className="w-full px-3 py-2 border border-slate-200 rounded outline-none focus:border-slate-300 text-xs text-slate-900 shadow-sm" 
                  />
                </div>
              </div>

              <hr className="border-slate-50 mb-6" />
              
              <SectionHeader title="Workspace Profile" desc="Registered business information for billing." />
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Business Name</label>
                    <input 
                      type="text" 
                      value={workspaceInfo.name} 
                      onChange={(e) => setWorkspaceInfo({...workspaceInfo, name: e.target.value})} 
                      className="w-full px-3 py-2 border border-slate-200 rounded outline-none focus:border-slate-300 text-xs text-slate-900 shadow-sm" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">GSTIN Identification</label>
                    <input 
                      type="text" 
                      value={workspaceInfo.gstin} 
                      onChange={(e) => setWorkspaceInfo({...workspaceInfo, gstin: e.target.value.toUpperCase()})} 
                      className="w-full px-3 py-2 border border-slate-200 rounded outline-none focus:border-slate-300 font-mono text-xs text-slate-900 shadow-sm tracking-wide" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Office Address</label>
                  <textarea 
                    rows={2} 
                    value={workspaceInfo.address} 
                    onChange={(e) => setWorkspaceInfo({...workspaceInfo, address: e.target.value})} 
                    className="w-full px-3 py-2 border border-slate-200 rounded outline-none focus:border-slate-300 text-xs text-slate-700 resize-none shadow-sm" 
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="bg-primary text-slate-900 px-8 py-2 rounded-md font-bold text-xs uppercase tracking-tight hover:bg-primary-dark transition-none flex items-center justify-center disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Trash' && (
          <div className="space-y-4">
              <div className="bg-red-50 p-4 border border-red-100 rounded flex items-start gap-4 mb-4">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 font-medium leading-relaxed">
                      Restore will immediately re-integrate items into analytics. Permanent deletion cannot be undone.
                  </p>
              </div>
              
              <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                  {trashLoading ? (
                    <div className="py-20 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-300 mx-auto" />
                    </div>
                  ) : (
                    <table className="clean-table">
                        <thead>
                            <tr>
                                <th>Archived Entry</th>
                                <th>Entity</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trashItems.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <p className="font-medium text-slate-800 text-xs">{item.label}</p>
                                    </td>
                                    <td>
                                        <span className="text-[9px] px-2 py-0.5 rounded border border-slate-100 bg-white uppercase font-bold text-slate-400">
                                            {item.type}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex justify-center space-x-2">
                                            <button onClick={() => handleRestore(item)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><RotateCcw className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handlePermDelete(item)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {trashItems.length === 0 && (
                              <tr>
                                <td colSpan={3} className="py-20 text-center text-slate-300 italic text-xs">
                                  No deleted records.
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
    </div>
  );
};

export default Settings;
