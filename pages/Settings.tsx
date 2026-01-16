import React, { useState, useEffect } from 'react';
import { Building2, Save, MapPin, Fingerprint, Globe, CheckCircle2, Loader2, User } from 'lucide-react';
import { getActiveCompanyId, safeSupabaseSave } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspaceInfo, setWorkspaceInfo] = useState({ name: '', gstin: '', address: '' });

  const loadProfile = async () => {
    setLoading(true);
    try {
      const cid = getActiveCompanyId();
      if (cid) {
        const { data, error } = await supabase.from('companies').select('*').eq('id', cid).single();
        if (error) throw error;
        if (data) setWorkspaceInfo({ name: data.name || '', gstin: data.gstin || '', address: data.address || '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cid = getActiveCompanyId();
      // MASTER SCRIPT FIX: helper strips user_id to prevent "relation does not exist"
      await safeSupabaseSave('companies', workspaceInfo, cid);
      localStorage.setItem('activeCompanyName', workspaceInfo.name);
      window.dispatchEvent(new Event('appSettingsChanged'));
      alert("Workspace updated!");
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-40 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase">Business Profile</h3>
          <button onClick={handleUpdate} disabled={saving} className="bg-slate-900 text-primary px-8 py-2.5 rounded-md font-bold text-xs uppercase hover:bg-slate-800 disabled:opacity-50 flex items-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Legal Name</label>
              <input value={workspaceInfo.name} onChange={(e) => setWorkspaceInfo({...workspaceInfo, name: e.target.value.toUpperCase()})} className="w-full px-4 py-3 border border-slate-200 rounded text-sm font-bold uppercase outline-none focus:border-slate-900" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">GSTIN</label>
              <input value={workspaceInfo.gstin} onChange={(e) => setWorkspaceInfo({...workspaceInfo, gstin: e.target.value.toUpperCase()})} className="w-full px-4 py-3 border border-slate-200 rounded text-sm font-mono outline-none focus:border-slate-900" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Address</label>
            <textarea value={workspaceInfo.address} onChange={(e) => setWorkspaceInfo({...workspaceInfo, address: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded text-sm outline-none focus:border-slate-900 resize-none" rows={3} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
