
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Edit, Trash2, History, Filter, ChevronDown, Maximize2, Minimize2, Loader2, Landmark, CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import VendorForm from '../components/VendorForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, formatDate, getActiveCompanyId } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const InfoCard = ({ label, value, desc, icon: Icon }: { label: string, value: string | number, desc?: string, icon?: any }) => (
  <div className="bg-white p-6 border border-slate-200 rounded-md boxy-shadow hover:border-slate-300 transition-all flex flex-col justify-between">
    <div>
      <div className="flex items-center space-x-2 mb-1">
        {Icon && <Icon className="w-3 h-3 text-slate-400" />}
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-xl font-semibold text-slate-900 truncate">{value || 'N/A'}</p>
    </div>
    {desc && <p className="text-[9px] text-slate-400 font-medium mt-2 truncate">{desc}</p>}
  </div>
);

const Vendors = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any | null>(null);
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; vendor: any | null }>({
    isOpen: false,
    vendor: null
  });

  const loadData = async (newIdToSelect?: string) => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    try {
      const { data: vendorData, error: vErr } = await supabase
        .from('vendors')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('name');

      const { data: billData, error: bErr } = await supabase
        .from('bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);

      if (vErr) throw vErr;
      if (bErr) throw bErr;

      setVendors(vendorData || []);
      setBills(billData || []);
      
      if (newIdToSelect) {
        setSelectedVendorId(String(newIdToSelect));
      } else if (vendorData && vendorData.length > 0 && !selectedVendorId) {
        setSelectedVendorId(String(vendorData[0].id));
      }
    } catch (error: any) {
      console.error("Error loading vendor data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('appSettingsChanged', handleSync);
    return () => window.removeEventListener('appSettingsChanged', handleSync);
  }, []);

  const handleSaveVendor = async (vendor: any) => {
    const cid = getActiveCompanyId();
    if (!cid) {
      alert("No active company/workspace found.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Session expired. Please sign in again.");
        return;
      }
      
      const fullData = {
        name: String(vendor.name || '').trim(),
        email: String(vendor.email || '').trim(),
        phone: String(vendor.phone || '').trim(),
        gstin: String(vendor.gstin || '').toUpperCase().trim(),
        pan: String(vendor.pan || '').toUpperCase().trim(),
        account_number: String(vendor.account_number || '').trim(),
        account_name: String(vendor.account_name || '').trim(),
        ifsc_code: String(vendor.ifsc_code || '').toUpperCase().trim(),
        address: String(vendor.address || '').trim(),
        balance: Number(vendor.balance) || 0
      };

      const basicData = {
        name: fullData.name,
        email: fullData.email,
        phone: fullData.phone,
        gstin: fullData.gstin,
        address: fullData.address,
        balance: fullData.balance
      };

      if (!fullData.name) {
        alert("Vendor name is required.");
        return;
      }

      const save = async (payload: any) => {
        if (editingVendor) {
          return await supabase.from('vendors').update(payload).eq('id', editingVendor.id).select();
        } else {
          return await supabase.from('vendors').insert([{ ...payload, company_id: cid, user_id: user.id }]).select();
        }
      };

      // Attempt 1: Full Save with Banking Details
      let result = await save(fullData);

      // Attempt 2: Fallback if columns are missing
      if (result.error && (result.error.code === 'PGRST204' || result.error.message?.includes('column'))) {
        console.warn("Banking columns missing in DB. Retrying basic save...");
        result = await save(basicData);
        if (!result.error) {
          alert("Vendor saved successfully, but Banking Details/PAN were skipped because your database schema needs updating.");
        }
      }

      if (result.error) throw result.error;

      const finalId = editingVendor ? editingVendor.id : (result.data ? result.data[0].id : null);
      await loadData(finalId);
      setIsFormOpen(false);
      setEditingVendor(null);
    } catch (error: any) {
      console.error("Save Error Details:", error);
      const errorMessage = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      alert(`Submission Process Failure: ${errorMessage}`);
    }
  };

  const confirmDeleteVendor = async () => {
      if (!deleteDialog.vendor) return;
      try {
        const { error } = await supabase.from('vendors').update({ is_deleted: true }).eq('id', deleteDialog.vendor.id);
        if (error) throw error;
        loadData();
        if (selectedVendorId === deleteDialog.vendor.id) setSelectedVendorId(null);
      } catch (error: any) {
        alert("Error deleting vendor.");
      }
  };

  const filteredVendors = vendors.filter(v => 
    v.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const selectedVendor = useMemo(() => 
    vendors.find(v => String(v.id) === String(selectedVendorId)), 
    [vendors, selectedVendorId]
  );

  const stats = useMemo(() => {
    if (!selectedVendor) return { transactions: [], totalPurchase: 0, balance: 0 };

    const transactions = bills.filter(b => 
      b.vendor_name?.toLowerCase() === selectedVendor.name?.toLowerCase() &&
      (statusFilter === 'All' ? true : b.status === statusFilter)
    );

    const totalPurchase = bills
      .filter(b => b.vendor_name?.toLowerCase() === selectedVendor.name?.toLowerCase())
      .reduce((acc, b) => acc + Number(b.grand_total || 0), 0);

    return {
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalPurchase,
      balance: (selectedVendor.balance || 0) + totalPurchase
    };
  }, [selectedVendor, bills, statusFilter]);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Modal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingVendor(null); }} title={editingVendor ? "Edit Vendor Profile" : "Create New Vendor"}>
          <VendorForm initialData={editingVendor} onSubmit={handleSaveVendor} onCancel={() => { setIsFormOpen(false); setEditingVendor(null); }} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, vendor: null })}
        onConfirm={confirmDeleteVendor}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${deleteDialog.vendor?.name}"? All history will be archived.`}
      />

      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-medium text-slate-900 tracking-tight">Vendors Directory</h1>
        <button onClick={() => { setEditingVendor(null); setIsFormOpen(true); }} className="bg-primary text-slate-800 px-5 py-2 rounded-md font-bold text-[10px] uppercase tracking-widest border border-slate-200 hover:bg-primary-dark transition-all shadow-sm active:scale-95">New Vendor</button>
      </div>

      {loading && vendors.length === 0 ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0 relative">
          {!isFullScreen && (
            <div className="w-80 shrink-0 flex flex-col space-y-4 overflow-hidden">
               <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search vendors..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-slate-400 shadow-sm" />
               </div>
               <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4">
                   {filteredVendors.map((vendor) => {
                        const vendorPurchases = bills
                          .filter(b => b.vendor_name?.toLowerCase() === vendor.name?.toLowerCase())
                          .reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
                        const outstanding = (vendor.balance || 0) + vendorPurchases;

                        return (
                          <div 
                              key={vendor.id} 
                              onClick={() => setSelectedVendorId(String(vendor.id))} 
                              className={`p-4 border rounded-md cursor-pointer transition-all relative group ${String(selectedVendorId) === String(vendor.id) ? 'bg-slate-100 border-slate-400 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                          >
                              <h3 className="font-semibold text-slate-900 truncate uppercase text-[11px] mb-1">{vendor.name}</h3>
                              <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">{vendor.gstin || 'No GST Record'}</p>
                              <div className="mt-3 flex justify-between items-center border-t border-slate-200/50 pt-2 text-[10px] font-bold text-slate-400">
                                  <span>OUTSTANDING</span>
                                  <span className="text-slate-900">{formatCurrency(outstanding)}</span>
                              </div>
                          </div>
                        );
                   })}
                   {filteredVendors.length === 0 && (
                     <div className="text-center py-20 text-slate-300 italic text-sm">No matching vendors.</div>
                   )}
               </div>
            </div>
          )}

          <div className={`flex-1 bg-white border border-slate-200 rounded-md p-8 flex flex-col boxy-shadow overflow-y-auto transition-all duration-300`}>
              {selectedVendor ? (
                  <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex justify-between items-start mb-8 shrink-0 border-b border-slate-100 pb-6">
                        <div>
                          <h2 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight leading-none">{selectedVendor.name}</h2>
                          <div className="flex items-center space-x-3 mt-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <ShieldCheck className="w-3 h-3 mr-1" /> GST: {selectedVendor.gstin || 'NOT REGISTERED'}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-slate-900 transition-colors shadow-sm bg-white">
                             {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                          </button>
                          <button onClick={() => { setEditingVendor(selectedVendor); setIsFormOpen(true); }} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-slate-900 transition-colors shadow-sm bg-white"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteDialog({ isOpen: true, vendor: selectedVendor })} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-red-500 transition-colors shadow-sm bg-white"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>

                      {/* Banking & Business Info Card - Fixed Visibility */}
                      <div className="mb-8 bg-slate-50 border border-slate-200 rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 boxy-shadow border-l-4 border-l-primary shadow-sm">
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <ShieldCheck className="w-3 h-3 mr-1.5" /> PAN Number
                            </p>
                            <p className="text-sm font-bold text-slate-900 font-mono uppercase">{selectedVendor.pan || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <CreditCard className="w-3 h-3 mr-1.5" /> Beneficiary Name
                            </p>
                            <p className="text-sm font-bold text-slate-900 truncate uppercase">{selectedVendor.account_name || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <Landmark className="w-3 h-3 mr-1.5" /> Account No
                            </p>
                            <p className="text-sm font-bold text-slate-900 font-mono">{selectedVendor.account_number || 'N/A'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <Landmark className="w-3 h-3 mr-1.5" /> IFSC Code
                            </p>
                            <p className="text-sm font-bold text-slate-900 font-mono uppercase">{selectedVendor.ifsc_code || 'N/A'}</p>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 mb-8">
                          <InfoCard label="Outstanding Balance" value={formatCurrency(stats.balance)} desc="Total pending payables" />
                          <InfoCard label="Contact Email" value={selectedVendor.email || 'N/A'} desc="Official communication" />
                          <InfoCard label="Support Line" value={selectedVendor.phone || 'N/A'} desc="Business contact number" />
                      </div>

                      <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex items-center justify-between mb-4">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><History className="w-3.5 h-3.5 mr-2" /> Recent Voucher History</p>
                          </div>
                          <div className="flex-1 overflow-auto border border-slate-200 rounded-md shadow-inner bg-white">
                              <table className="w-full text-left text-xs table-auto border-collapse">
                                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                      <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                          <th className="py-3 px-4 border-r border-slate-200">Date</th>
                                          <th className="py-3 px-4 border-r border-slate-200">Bill Number</th>
                                          <th className="py-3 px-4 border-r border-slate-200 text-right">Bill Amount</th>
                                          <th className="py-3 px-4 text-center">Status</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {stats.transactions.map((bill) => (
                                          <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="py-3 px-4 border-r border-slate-100">{formatDate(bill.date)}</td>
                                              <td className="py-3 px-4 border-r border-slate-100 font-mono font-medium">{bill.bill_number}</td>
                                              <td className="py-3 px-4 border-r border-slate-100 text-right font-bold text-slate-900">{formatCurrency(bill.grand_total)}</td>
                                              <td className="py-3 px-4 text-center">
                                                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${bill.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{bill.status}</span>
                                              </td>
                                          </tr>
                                      ))}
                                      {stats.transactions.length === 0 && <tr><td colSpan={4} className="py-24 text-center text-slate-300 italic text-sm">No transaction records found for this vendor.</td></tr>}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-sm py-20">
                    <Landmark className="w-16 h-16 opacity-5 mb-4" />
                    <p>Select a vendor from the list to view financial ledgers and settlement data.</p>
                  </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;
