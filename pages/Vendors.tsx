
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Edit, Trash2, History, Maximize2, Minimize2, Loader2, Landmark, CreditCard, ShieldCheck, Plus } from 'lucide-react';
import Modal from '../components/Modal';
import VendorForm from '../components/VendorForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, formatDate, getActiveCompanyId } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const InfoCard = ({ label, value, desc, icon: Icon }: { label: string, value: string | number, desc?: string, icon?: any }) => (
  <div className="bg-white p-8 border border-slate-200 rounded-2xl boxy-shadow hover:border-slate-300 transition-all flex flex-col justify-between h-full">
    <div>
      <div className="flex items-center space-x-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900 truncate tracking-tight">{value || 'N/A'}</p>
    </div>
    {desc && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4 truncate">{desc}</p>}
  </div>
);

const Vendors = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
    if (!cid) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const payload: any = {
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

      const basicPayload = {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        gstin: payload.gstin,
        address: payload.address,
        balance: payload.balance
      };

      let result;
      if (editingVendor) {
        result = await supabase.from('vendors').update(payload).eq('id', editingVendor.id).select();
        if (result.error && (result.error.code === 'PGRST204' || result.error.message?.includes('column'))) {
          result = await supabase.from('vendors').update(basicPayload).eq('id', editingVendor.id).select();
          if (!result.error) alert("Vendor profile updated. Note: Banking Details and PAN were skipped because your database schema needs updating.");
        }
      } else {
        result = await supabase.from('vendors').insert([{ ...payload, company_id: cid, user_id: user.id }]).select();
        if (result.error && (result.error.code === 'PGRST204' || result.error.message?.includes('column'))) {
          result = await supabase.from('vendors').insert([{ ...basicPayload, company_id: cid, user_id: user.id }]).select();
          if (!result.error) alert("New vendor created. Note: Banking Details and PAN were skipped because your database schema needs updating.");
        }
      }

      if (result.error) throw result.error;

      const finalId = editingVendor ? editingVendor.id : (result.data ? result.data[0].id : null);
      await loadData(finalId);
      setIsFormOpen(false);
      setEditingVendor(null);
    } catch (error: any) {
      console.error("Save Error:", error);
      const msg = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      alert(`Submission Process Failure: ${msg}`);
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
      b.vendor_name?.toLowerCase() === selectedVendor.name?.toLowerCase()
    );

    const totalPurchase = bills
      .filter(b => b.vendor_name?.toLowerCase() === selectedVendor.name?.toLowerCase())
      .reduce((acc, b) => acc + Number(b.grand_total || 0), 0);

    return {
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalPurchase,
      balance: (selectedVendor.balance || 0) + totalPurchase
    };
  }, [selectedVendor, bills]);

  return (
    <div className="space-y-10 h-full flex flex-col animate-in fade-in duration-500">
      <Modal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingVendor(null); }} title={editingVendor ? "Edit Vendor Profile" : "Register New Vendor"}>
          <VendorForm initialData={editingVendor} onSubmit={handleSaveVendor} onCancel={() => { setIsFormOpen(false); setEditingVendor(null); }} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, vendor: null })}
        onConfirm={confirmDeleteVendor}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${deleteDialog.vendor?.name}"?`}
      />

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-2">Vendors Ledger</h1>
          <p className="text-slate-500 font-medium text-sm">Directory of business partners and historical settlement records.</p>
        </div>
        <button onClick={() => { setEditingVendor(null); setIsFormOpen(true); }} className="bg-primary text-slate-900 px-8 py-3 rounded-lg font-bold text-sm border border-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 flex items-center">
            <Plus className="w-4.5 h-4.5 mr-2" /> Register New Vendor
        </button>
      </div>

      {loading && vendors.length === 0 ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : (
        <div className="flex gap-8 flex-1 min-h-0 relative">
          {!isFullScreen && (
            <div className="w-80 shrink-0 flex flex-col space-y-6 overflow-hidden">
               <div className="relative shrink-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search parties..." className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-slate-400 shadow-sm transition-all" />
               </div>
               <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-4 custom-scrollbar">
                   {filteredVendors.map((vendor) => {
                        const vendorPurchases = bills
                          .filter(b => b.vendor_name?.toLowerCase() === vendor.name?.toLowerCase())
                          .reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
                        const outstanding = (vendor.balance || 0) + vendorPurchases;

                        return (
                          <div 
                              key={vendor.id} 
                              onClick={() => setSelectedVendorId(String(vendor.id))} 
                              className={`p-5 border rounded-xl cursor-pointer transition-all relative group shadow-sm ${String(selectedVendorId) === String(vendor.id) ? 'bg-slate-100 border-slate-400' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                          >
                              <h3 className="font-bold text-slate-900 truncate uppercase text-[12px] mb-1">{vendor.name}</h3>
                              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">{vendor.gstin || 'NO GST'}</p>
                              <div className="mt-4 flex justify-between items-center border-t border-slate-200/50 pt-3 text-[10px] font-bold text-slate-400">
                                  <span className="uppercase tracking-tighter">Payable Net</span>
                                  <span className="text-slate-900 text-sm font-mono">{formatCurrency(outstanding)}</span>
                              </div>
                          </div>
                        );
                   })}
               </div>
            </div>
          )}

          <div className={`flex-1 bg-white border border-slate-200 rounded-2xl p-10 flex flex-col boxy-shadow overflow-y-auto transition-all duration-300`}>
              {selectedVendor ? (
                  <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="flex justify-between items-start mb-10 shrink-0 border-b border-slate-100 pb-8">
                        <div>
                          <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight leading-none mb-4">{selectedVendor.name}</h2>
                          <div className="flex items-center space-x-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                              <ShieldCheck className="w-3.5 h-3.5 mr-2 text-green-500" /> GST: {selectedVendor.gstin || 'N/A'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                               <Landmark className="w-3.5 h-3.5 mr-2 text-blue-500" /> Bank Integrated
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-3 text-slate-400 border border-slate-200 rounded-xl hover:text-slate-900 transition-all shadow-sm bg-white hover:bg-slate-50">
                             {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                          </button>
                          <button onClick={() => { setEditingVendor(selectedVendor); setIsFormOpen(true); }} className="p-3 text-slate-400 border border-slate-200 rounded-xl hover:text-slate-900 transition-all shadow-sm bg-white hover:bg-slate-50"><Edit className="w-5 h-5" /></button>
                          <button onClick={() => setDeleteDialog({ isOpen: true, vendor: selectedVendor })} className="p-3 text-slate-400 border border-slate-200 rounded-xl hover:text-red-500 transition-all shadow-sm bg-white hover:bg-slate-50"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </div>

                      <div className="mb-10 bg-slate-50 border border-slate-200 rounded-2xl p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 shadow-inner border-l-[6px] border-l-primary">
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <ShieldCheck className="w-3.5 h-3.5 mr-2" /> PAN Number
                            </p>
                            <p className="text-base font-bold text-slate-900 font-mono uppercase">{selectedVendor.pan || 'N/A'}</p>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <CreditCard className="w-3.5 h-3.5 mr-2" /> Beneficiary Account
                            </p>
                            <p className="text-base font-bold text-slate-900 truncate uppercase">{selectedVendor.account_name || 'N/A'}</p>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <Landmark className="w-3.5 h-3.5 mr-2" /> Settlement No
                            </p>
                            <p className="text-base font-bold text-slate-900 font-mono">{selectedVendor.account_number || 'N/A'}</p>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                              <Landmark className="w-3.5 h-3.5 mr-2" /> IFSC Swift Code
                            </p>
                            <p className="text-base font-bold text-slate-900 font-mono uppercase">{selectedVendor.ifsc_code || 'N/A'}</p>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0 mb-10">
                          <InfoCard label="Account Balance" value={formatCurrency(stats.balance)} desc="Current Outstanding" />
                          <InfoCard label="Contact Email" value={selectedVendor.email || 'None'} desc="Transactional Comm" />
                          <InfoCard label="Direct Support" value={selectedVendor.phone || 'None'} desc="Mobile / Office Line" />
                      </div>

                      <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex items-center justify-between mb-6">
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><History className="w-4 h-4 mr-2.5 text-slate-300" /> Transactional Ledger History</p>
                              <span className="text-[10px] text-slate-400 font-medium">Auto-synced from Bills</span>
                          </div>
                          <div className="flex-1 overflow-auto border border-slate-200 rounded-xl shadow-inner bg-white custom-scrollbar">
                              <table className="w-full text-left text-sm table-auto border-collapse">
                                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                      <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                          <th className="py-4 px-8 border-r border-slate-200">Voucher Date</th>
                                          <th className="py-4 px-8 border-r border-slate-200">Invoice No</th>
                                          <th className="py-4 px-8 border-r border-slate-200 text-right">Invoice Amount</th>
                                          <th className="py-4 px-8 text-center">Settlement</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {stats.transactions.map((bill) => (
                                          <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="py-4 px-8 border-r border-slate-100 font-bold text-slate-600">{formatDate(bill.date)}</td>
                                              <td className="py-4 px-8 border-r border-slate-100 font-mono font-bold text-slate-900">{bill.bill_number}</td>
                                              <td className="py-4 px-8 border-r border-slate-100 text-right font-bold text-slate-900">{formatCurrency(bill.grand_total)}</td>
                                              <td className="py-4 px-8 text-center">
                                                  <span className={`text-[9px] font-bold uppercase px-3 py-1 rounded-full border ${bill.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{bill.status}</span>
                                              </td>
                                          </tr>
                                      ))}
                                      {stats.transactions.length === 0 && <tr><td colSpan={4} className="py-32 text-center text-slate-300 italic text-base">No historical transaction records found for this party.</td></tr>}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-base py-24">
                    <Landmark className="w-20 h-20 opacity-5 mb-6" />
                    <p className="font-medium">Select a partner from the ledger list to view detailed profile and cloud-synced financial records.</p>
                  </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;
