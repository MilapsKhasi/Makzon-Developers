
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2, Trash2, AlertTriangle, Building2, MapPin, Fingerprint, Moon, Sun, Monitor, Percent, CheckCircle2, RotateCcw, Trash, Filter, ShieldCheck, BadgeCheck } from 'lucide-react';
import { getActiveCompanyId, safeSupabaseSave, getAppSettings, formatDate } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import ConfirmDialog from '../components/ConfirmDialog';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspaceInfo, setWorkspaceInfo] = useState({ name: '', gstin: '', address: '' });
  const [theme, setTheme] = useState(localStorage.getItem('app_theme') || 'light');
  const [gstConfig, setGstConfig] = useState({ enabled: false, type: 'CGST - SGST' });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [licenseId, setLicenseId] = useState('FP-26112');
  
  // Recycle Bin State
  const [recycleTab, setRecycleTab] = useState('All');
  const [deletedItems, setDeletedItems] = useState<any[]>([]);
  const [recycleLoading, setRecycleLoading] = useState(false);
  
  const navigate = useNavigate();

  const recycleTabs = [
    'All', 'Workspace', 'Sales Invoices', 'Purchase Bills', 
    'Customers', 'Vendors', 'Stock Master', 'Cashbook', 'Duties & Taxes'
  ];

  const loadProfile = async () => {
    setLoading(true);
    try {
      const cid = getActiveCompanyId();
      if (cid) {
        const { data, error } = await supabase.from('companies').select('*').eq('id', cid).single();
        if (error) throw error;
        if (data) setWorkspaceInfo({ name: data.name || '', gstin: data.gstin || '', address: data.address || '' });

        const settings = getAppSettings();
        setGstConfig({
            enabled: settings.gstEnabled || false,
            type: settings.gstType || 'CGST - SGST'
        });
        
        // Calculate License ID
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('id, created_at')
          .eq('is_deleted', false)
          .order('created_at', { ascending: true });
        
        if (allCompanies) {
          const index = allCompanies.findIndex(c => c.id === cid);
          if (index !== -1) {
            setLicenseId(`FP-${26112 + index}`);
          }
        }

        await fetchRecycleData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecycleData = async () => {
    const cid = getActiveCompanyId();
    if (!cid) return;
    setRecycleLoading(true);
    
    try {
      const queries = [
        supabase.from('companies').select('id, name, created_at').eq('is_deleted', true).eq('id', cid), 
        supabase.from('companies').select('id, name, created_at').eq('is_deleted', true).not('id', 'eq', cid), 
        supabase.from('sales_invoices').select('id, invoice_number, customer_name, date').eq('is_deleted', true).eq('company_id', cid),
        supabase.from('bills').select('id, bill_number, vendor_name, date').eq('is_deleted', true).eq('company_id', cid),
        supabase.from('vendors').select('id, name, party_type, is_customer').eq('is_deleted', true).eq('company_id', cid),
        supabase.from('stock_items').select('id, name').eq('is_deleted', true).eq('company_id', cid),
        supabase.from('cashbooks').select('id, date').eq('is_deleted', true).eq('company_id', cid),
        supabase.from('duties_taxes').select('id, name').eq('is_deleted', true).eq('company_id', cid)
      ];

      const results = await Promise.all(queries);
      
      const allItems: any[] = [];
      
      results[0].data?.forEach(i => allItems.push({ ...i, origin: 'Workspace', label: i.name, table: 'companies' }));
      results[1].data?.forEach(i => allItems.push({ ...i, origin: 'Workspace', label: i.name, table: 'companies' }));
      results[2].data?.forEach(i => allItems.push({ ...i, origin: 'Sales Invoices', label: `${i.invoice_number} (${i.customer_name})`, table: 'sales_invoices' }));
      results[3].data?.forEach(i => allItems.push({ ...i, origin: 'Purchase Bills', label: `${i.bill_number} (${i.vendor_name})`, table: 'bills' }));
      results[4].data?.forEach(i => {
        const type = (i.is_customer || i.party_type === 'customer') ? 'Customers' : 'Vendors';
        allItems.push({ ...i, origin: type, label: i.name, table: 'vendors' });
      });
      results[5].data?.forEach(i => allItems.push({ ...i, origin: 'Stock Master', label: i.name, table: 'stock_items' }));
      results[6].data?.forEach(i => allItems.push({ ...i, origin: 'Cashbook', label: `Statement ${i.date}`, table: 'cashbooks' }));
      results[7].data?.forEach(i => allItems.push({ ...i, origin: 'Duties & Taxes', label: i.name, table: 'duties_taxes' }));

      setDeletedItems(allItems);
    } catch (err) {
      console.error("Recycle fetch error:", err);
    } finally {
      setRecycleLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleRecover = async (item: any) => {
    try {
      const { error } = await supabase.from(item.table).update({ is_deleted: false }).eq('id', item.id);
      if (error) throw error;
      await fetchRecycleData();
      window.dispatchEvent(new Event('appSettingsChanged'));
    } catch (err: any) {
      alert("Recovery failed: " + err.message);
    }
  };

  const handlePermanentDelete = async (item: any) => {
    if (!confirm(`Permanently delete "${item.label}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from(item.table).delete().eq('id', item.id);
      if (error) throw error;
      await fetchRecycleData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const applyTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    window.dispatchEvent(new Event('appSettingsChanged'));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cid = getActiveCompanyId();
      await safeSupabaseSave('companies', workspaceInfo, cid);
      localStorage.setItem('activeCompanyName', workspaceInfo.name);

      const currentSettings = getAppSettings();
      const updatedSettings = { 
        ...currentSettings, 
        gstEnabled: gstConfig.enabled, 
        gstType: gstConfig.type 
      };
      localStorage.setItem(`appSettings_${cid}`, JSON.stringify(updatedSettings));

      if (gstConfig.enabled) {
        const ledgersToEnsure = gstConfig.type === 'CGST - SGST' ? ['CGST', 'SGST'] : ['IGST'];
        for (const name of ledgersToEnsure) {
            const { data: existing } = await supabase.from('duties_taxes').select('id').eq('company_id', cid).eq('name', name).eq('is_deleted', false).maybeSingle();
            if (!existing) {
                await safeSupabaseSave('duties_taxes', {
                    name, type: 'Charge', calc_method: 'Fixed', fixed_amount: 0, rate: 0, apply_on: 'Subtotal', is_default: true, is_deleted: false
                });
            }
        }
      }

      window.dispatchEvent(new Event('appSettingsChanged'));
      alert("Settings updated successfully!");
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
      const { error } = await supabase.from('companies').update({ is_deleted: true }).eq('id', cid);
      if (error) throw error;
      localStorage.removeItem('activeCompanyId');
      localStorage.removeItem('activeCompanyName');
      navigate('/companies', { replace: true });
    } catch (err: any) {
      alert(`Delete Failed: ${err.message}`);
    }
  };

  const filteredDeleted = deletedItems.filter(item => recycleTab === 'All' || item.origin === recycleTab);

  if (loading) return <div className="py-40 text-center"><Loader2 className="w-8 h-8 animate-spin inline text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-5xl">
      <div className="flex flex-col text-left">
        <h1 className="text-[20px] font-medium text-slate-900 dark:text-slate-100 capitalize">Workspace Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Configure your business profile, theme preferences, and workspace lifecycle.</p>
      </div>

      <form onSubmit={handleUpdate} className="space-y-6">
        {/* License Information Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">License Information</h3>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                  <ShieldCheck className="w-6 h-6 text-primary-dark" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Plan - <span className="text-link">Licensed</span></h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-mono">License ID: {licenseId}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-4 py-2 rounded-lg flex items-center">
                  <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2" />
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-tighter">Status: Active & Valid</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Appearance</h3>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Visual Theme</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Choose between light, dark, or system-default appearance.</p>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit ml-auto">
                <button type="button" onClick={() => applyTheme('light')} className={`flex items-center px-4 py-2 rounded-md text-xs font-bold transition-all ${theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Sun className="w-3.5 h-3.5 mr-2" /> Light</button>
                <button type="button" onClick={() => applyTheme('dark')} className={`flex items-center px-4 py-2 rounded-md text-xs font-bold transition-all ${theme === 'dark' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}><Moon className="w-3.5 h-3.5 mr-2" /> Dark</button>
              </div>
            </div>
          </div>
        </div>

        {/* GST Configuration Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">GST Configuration</h3>
          </div>
          <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Enable GST</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Turn on GST calculations and automatic tax ledger generation.</p>
              </div>
              <button type="button" onClick={() => setGstConfig({ ...gstConfig, enabled: !gstConfig.enabled })} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${gstConfig.enabled ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${gstConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            {gstConfig.enabled && (
                <div className="animate-in slide-in-from-top-2 duration-300 grid grid-cols-1 md:grid-cols-2 gap-8 items-center border-t border-slate-100 dark:border-slate-800 pt-8">
                    <div><h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">Select GST Type</h4><p className="text-xs text-slate-500 dark:text-slate-400">Ledgers will be created automatically based on your choice.</p></div>
                    <div className="relative">
                        <select value={gstConfig.type} onChange={(e) => setGstConfig({ ...gstConfig, type: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-sm font-medium outline-none focus:border-slate-400 dark:focus:border-slate-500 appearance-none">
                            <option value="CGST - SGST">CGST - SGST (Intra-State)</option>
                            <option value="IGST">IGST (Inter-State)</option>
                        </select>
                        <Percent className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            )}
          </div>
        </div>

        {/* Business Info Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden shadow-sm text-left">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/50">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Business Information</h3>
            <button type="submit" disabled={saving} className="bg-primary text-slate-950 px-8 py-2 rounded-md font-bold text-[13px] capitalize hover:bg-primary-dark disabled:opacity-50 flex items-center shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save Changes
            </button>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1.5"><label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">Legal Business Name</label><div className="relative"><Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" /><input required value={workspaceInfo.name} onChange={(e) => setWorkspaceInfo({...workspaceInfo, name: e.target.value})} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded text-sm font-medium capitalize outline-none focus:border-slate-400 dark:focus:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" placeholder="Company Name" /></div></div>
              <div className="space-y-1.5"><label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">GSTIN Number</label><div className="relative"><Fingerprint className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" /><input value={workspaceInfo.gstin} onChange={(e) => setWorkspaceInfo({...workspaceInfo, gstin: e.target.value.toUpperCase()})} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded text-sm font-mono outline-none focus:border-slate-400 dark:focus:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 uppercase" placeholder="27AAAAA0000A1Z5" /></div></div>
            </div>
            <div className="space-y-1.5"><label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">Registered Office Address</label><div className="relative"><MapPin className="w-4 h-4 absolute left-3 top-4 text-slate-300 dark:text-slate-600" /><textarea value={workspaceInfo.address} onChange={(e) => setWorkspaceInfo({...workspaceInfo, address: e.target.value})} className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-700 rounded text-sm outline-none focus:border-slate-400 dark:focus:border-slate-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none" rows={4} placeholder="Complete office address..." /></div></div>
          </div>
        </div>
      </form>

      {/* Recycle Bin Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2">
            <Trash2 className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Recycle Bin</h3>
          </div>
          <button onClick={fetchRecycleData} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <RotateCcw className={`w-3.5 h-3.5 ${recycleLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="p-0">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-800 scrollbar-none bg-slate-50/10 dark:bg-slate-900/10">
            {recycleTabs.map(tab => (
              <button 
                key={tab} 
                onClick={() => setRecycleTab(tab)} 
                className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${recycleTab === tab ? 'border-primary text-slate-900 dark:text-white' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
            {recycleLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filteredDeleted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-300 dark:text-slate-700 italic">
                <Trash2 className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-xs">Recycle bin is empty for this category.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                  <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                    <th className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">Source Screen</th>
                    <th className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">Name / Reference</th>
                    <th className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDeleted.map((item, idx) => (
                    <tr key={`${item.table}-${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded">{item.origin}</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300 capitalize">{item.label}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center space-x-2">
                          <button 
                            onClick={() => handleRecover(item)} 
                            className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                            title="Recover Item"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handlePermanentDelete(item)} 
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-left">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest">Danger Zone</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/30 rounded-md p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize mb-1">Delete Workspace Forever</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Permanently remove this workspace and all associated data. This action is irreversible.</p>
          </div>
          <button onClick={() => setIsDeleteConfirmOpen(true)} className="px-6 py-2 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-50 rounded-md text-[13px] font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center capitalize">
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Workspace
          </button>
        </div>
      </div>

      <ConfirmDialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDeleteWorkspace} title="Delete Current Workspace" message={`Are you sure you want to permanently delete "${workspaceInfo.name}"? All invoices, ledgers, and inventory data will be wiped out.`} />
    </div>
  );
};

export default Settings;
