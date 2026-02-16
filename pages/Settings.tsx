
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2, Trash2, AlertTriangle, Building2, MapPin, Fingerprint } from 'lucide-react';
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
      alert("Workspace updated successfully!");
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
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col">
        <h1 className="text-[20px] font-medium text-slate-900 capitalize">Workspace Settings</h1>
        <p className="text-slate-500 text-xs mt-1">Configure your business profile and workspace preferences.</p>
      </div>

      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Business Information</h3>
            <button 
              type="submit" 
              disabled={saving} 
              className="bg-primary text-slate-900 px-8 py-2 rounded-md font-bold text-[13px] capitalize hover:bg-primary-dark disabled:opacity-50 flex items-center shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </button>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Legal Business Name</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    required
                    value={workspaceInfo.name} 
                    onChange={(e) => setWorkspaceInfo({...workspaceInfo, name: e.target.value})} 
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded text-sm font-medium capitalize outline-none focus:border-slate-400 bg-white" 
                    placeholder="Company Name"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">GSTIN Number</label>
                <div className="relative">
                  <Fingerprint className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    value={workspaceInfo.gstin} 
                    onChange={(e) => setWorkspaceInfo({...workspaceInfo, gstin: e.target.value.toUpperCase()})} 
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded text-sm font-mono outline-none focus:border-slate-400 bg-white uppercase" 
                    placeholder="27AAAAA0000A1Z5"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Registered Office Address</label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-4 text-slate-300" />
                <textarea 
                  value={workspaceInfo.address} 
                  onChange={(e) => setWorkspaceInfo({...workspaceInfo, address: e.target.value})} 
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded text-sm outline-none focus:border-slate-400 bg-white resize-none" 
                  rows={4}
                  placeholder="Complete office address..."
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest">Danger Zone</h3>
        </div>
        <div className="bg-white border border-rose-100 rounded-md p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div>
            <h4 className="text-sm font-bold text-slate-900 capitalize mb-1">Delete Workspace Forever</h4>
            <p className="text-xs text-slate-500">Permanently remove this workspace and all associated data. This action is irreversible.</p>
          </div>
          <button 
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="px-6 py-2 border border-rose-200 text-rose-600 rounded-md text-[13px] font-bold hover:bg-rose-50 transition-colors flex items-center capitalize"
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
        message={`Are you sure you want to permanently delete "${workspaceInfo.name}"? All invoices, ledgers, and inventory data will be wiped out.`} 
      />
    </div>
  );
};

export default Settings;
