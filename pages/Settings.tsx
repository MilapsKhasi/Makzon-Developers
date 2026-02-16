
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Save, MapPin, Fingerprint, Globe, CheckCircle2, Loader2, User, Trash2, AlertTriangle } from 'lucide-react';
import { getActiveCompanyId, safeSupabaseSave } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import ConfirmDialog from '../components/ConfirmDialog';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspaceInfo, setWorkspaceInfo] = useState({ name: '', gstin: '', address: '' });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const navigate = useNavigate();

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

  const handleDeleteWorkspace = async () => {
    const cid = getActiveCompanyId();
    if (!cid) return;
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_deleted: true })
        .eq('id', cid);
      
      if (error) throw error;
      
      localStorage.removeItem('activeCompanyId');
      localStorage.removeItem('activeCompanyName');
      navigate('/companies', { replace: true });
    } catch (err: any) {
      alert(`Delete Failed: ${err.message}`);
    }
  };

  if (loading) return <div className="py-40 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-medium text-slate-900 capitalize">Settings</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-medium capitalize">Workspace Configuration</h3>
          <button onClick={handleUpdate} disabled={saving} className="bg-slate-900 text-primary px-8 py-2.5 rounded-md font-medium text-xs capitalize hover:bg-slate-800 disabled:opacity-50 flex items-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-slate-400 capitalize">Legal Name</label>
              <input value={workspaceInfo.name} onChange={(e) => setWorkspaceInfo({...workspaceInfo, name: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded text-sm font-medium capitalize outline-none focus:border-slate-900" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-slate-400 capitalize">Gstin</label>
              <input value={workspaceInfo.gstin} onChange={(e) => setWorkspaceInfo({...workspaceInfo, gstin: e.target.value.toUpperCase()})} className="w-full px-4 py-3 border border-slate-200 rounded text-sm font-mono outline-none focus:border-slate-900" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-slate-400 capitalize">Address</label>
            <textarea value={workspaceInfo.address} onChange={(e) => setWorkspaceInfo({...workspaceInfo, address: e.target.value})} className="w-full px-4 py-3 border border-slate-200 rounded text-sm outline-none focus:border-slate-900 resize-none" rows={3} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-rose-600 capitalize px-2 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          Danger Zone
        </h3>
        <div className="bg-white border border-rose-100 rounded-xl overflow-hidden p-8 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-slate-900 capitalize mb-1">Delete Workspace Forever</h4>
            <p className="text-xs text-slate-500">Permanently remove this workspace and all associated ledger data, bills, and settings.</p>
          </div>
          <button 
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="px-6 py-2.5 border border-rose-200 text-rose-600 rounded-md text-xs font-medium hover:bg-rose-50 transition-colors flex items-center capitalize"
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete Workspace
          </button>
        </div>
      </div>

      <ConfirmDialog 
        isOpen={isDeleteConfirmOpen} 
        onClose={() => setIsDeleteConfirmOpen(false)} 
        onConfirm={handleDeleteWorkspace} 
        title="Delete Current Workspace" 
        message={`Are you sure you want to permanently delete "${workspaceInfo.name}"? This action cannot be undone and you will be redirected to the workspace selection page.`} 
      />
    </div>
  );
};

export default Settings;
