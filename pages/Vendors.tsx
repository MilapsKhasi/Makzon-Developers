
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Edit, Trash2, History, Maximize2, Minimize2, Loader2, Landmark, CreditCard, ShieldCheck, Plus, ExternalLink, Phone, Mail, MapPin, Calculator, ArrowLeft } from 'lucide-react';
import Modal from '../components/Modal';
import VendorForm from '../components/VendorForm';
import LedgerModal from '../components/LedgerModal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { formatCurrency, formatDate, getActiveCompanyId, normalizeBill } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const StatCard = ({ label, value, colorClass = "text-slate-900" }: { label: string, value: string, colorClass?: string }) => (
  <div className="bg-white dark:bg-slate-800 p-6 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 transition-all">
    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest mb-1">{label}</p>
    <p className={`text-xl font-medium ${colorClass} dark:text-white tracking-tight font-mono`}>{value}</p>
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
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; vendor: any | null }>({
    isOpen: false,
    vendor: null
  });

  const loadData = async (newIdToSelect?: string) => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    try {
      const { data: partyData, error: vErr } = await supabase
        .from('vendors')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('name');
      const { data: billData, error: bErr } = await supabase
        .from('purchase_bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);
      if (vErr) throw vErr;
      if (bErr) throw bErr;

      const vendorOnly = (partyData || []).filter(p => p.party_type === 'vendor' || (!p.party_type && p.is_customer !== true));
      const normalizedBills = (billData || []).map(b => {
        const norm = normalizeBill(b);
        return norm ? { ...norm, type: 'Purchase' } : null;
      }).filter(Boolean);

      setVendors(vendorOnly);
      setBills(normalizedBills);
      
      if (newIdToSelect) {
        setSelectedVendorId(String(newIdToSelect));
      } else if (vendorOnly.length > 0 && !selectedVendorId) {
        setSelectedVendorId(String(vendorOnly[0].id));
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

  const handleSaveVendor = async (vendorData: any) => {
    setIsFormOpen(false);
    setEditingVendor(null);
    await loadData(vendorData.id);
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
    if (!selectedVendor) return { transactions: [], totalPurchased: 0, totalPaid: 0, balance: 0 };
    const transactions = bills.filter(b => 
      b.vendor_name?.toLowerCase() === selectedVendor.name?.toLowerCase() && b.type === 'Purchase'
    );
    const totalPurchased = transactions.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
    const totalPaid = transactions
      .filter(b => b.status === 'Paid')
      .reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
    return {
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalPurchased,
      totalPaid,
      balance: (Number(selectedVendor.balance) || 0) + totalPurchased - totalPaid
    };
  }, [selectedVendor, bills]);

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-300">
      <Modal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingVendor(null); }} title={editingVendor ? "Edit Vendor Profile" : "Register New Vendor"} maxWidth="max-w-4xl">
          <VendorForm initialData={editingVendor} onSubmit={handleSaveVendor} onCancel={() => { setIsFormOpen(false); setEditingVendor(null); }} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, vendor: null })}
        onConfirm={confirmDeleteVendor}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${deleteDialog.vendor?.name}"?`}
      />

      <LedgerModal isOpen={isLedgerOpen} onClose={() => setIsLedgerOpen(false)} party={selectedVendor} type="vendor" />

      <div className="flex flex-col sm:flex-row justify-between items-center shrink-0 gap-4">
        <h1 className="text-[20px] font-medium text-slate-900 dark:text-white capitalize w-full sm:w-auto">Vendors Directory</h1>
        {vendors.length > 0 && (
          <button 
            onClick={() => { setEditingVendor(null); setIsFormOpen(true); }} 
            className="bg-primary text-white px-6 py-2 rounded-md font-medium text-sm hover:bg-primary-dark transition-none flex items-center capitalize w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 mr-2" /> New Vendor
          </button>
        )}
      </div>

      {!loading && vendors.length === 0 ? (
        <EmptyState 
          title="No Vendors Registered" 
          message="You haven't added any suppliers yet. Manage your business relations by creating your first vendor profile!" 
          actionLabel="Register New Vendor" 
          onAction={() => { setEditingVendor(null); setIsFormOpen(true); }} 
        />
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
            {!isFullScreen && (
            <div className={`w-full lg:w-80 flex flex-col space-y-4 shrink-0 ${selectedVendorId ? 'hidden lg:flex' : 'flex'}`}>
                <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Search parties..." 
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs outline-none focus:border-slate-300 dark:focus:border-slate-600 text-slate-900 dark:text-slate-100" 
                />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredVendors.map((vendor) => {
                    const isSelected = String(selectedVendorId) === String(vendor.id);
                    return (
                    <div 
                        key={vendor.id} 
                        onClick={() => setSelectedVendorId(String(vendor.id))} 
                        className={`p-4 border rounded-md cursor-pointer transition-none group ${isSelected ? 'bg-primary border-slate-900 dark:border-slate-700' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                    >
                        <h3 className={`text-xs font-medium capitalize truncate mb-1 ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{vendor.name}</h3>
                        <div className="flex justify-between items-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        <span className={isSelected ? 'text-white/80' : ''}>{vendor.gstin || 'No Gstin'}</span>
                        <span className={isSelected ? 'text-white font-medium' : 'text-slate-900 dark:text-slate-100'}>₹{(Number(vendor.balance) || 0).toFixed(0)}</span>
                        </div>
                    </div>
                    );
                })}
                </div>
            </div>
            )}

            <div className={`flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex flex-col overflow-hidden ${isFullScreen ? 'fixed inset-4 z-[150] m-0 shadow-2xl' : ''} ${!selectedVendorId ? 'hidden lg:flex' : 'flex'}`}>
            {selectedVendor ? (
                <div className="flex flex-col h-full">
                <div className="px-4 sm:px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center space-x-3 overflow-hidden">
                    <button onClick={() => setSelectedVendorId(null)} className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                        <Landmark className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <div className="truncate">
                        <h2 className="text-base sm:text-lg font-medium text-slate-900 dark:text-white capitalize leading-none truncate">{selectedVendor.name}</h2>
                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-tighter mt-1">Id: {selectedVendor.id.split('-')[0]}</p>
                    </div>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                    <button onClick={() => setIsLedgerOpen(true)} className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                        <Calculator className="w-4 h-4" />
                        <span className="hidden sm:inline">Ledgers</span>
                    </button>
                    <button onClick={() => setIsFullScreen(!isFullScreen)} className="hidden sm:block p-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded" title="Toggle Fullscreen">
                        {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setEditingVendor(selectedVendor); setIsFormOpen(true); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded" title="Edit Profile">
                        <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteDialog({ isOpen: true, vendor: selectedVendor })} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Archive Vendor">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-10">
                    <StatCard label="Ledger Balance" value={formatCurrency(stats.balance)} colorClass="text-slate-900" />
                    <StatCard label="Total Purchases" value={formatCurrency(stats.totalPurchased)} colorClass="text-slate-500" />
                    <StatCard label="Settled Amount" value={formatCurrency(stats.totalPaid)} colorClass="text-green-600" />
                    <StatCard label="Status" value={selectedVendor.status || 'Active'} colorClass="text-primary-dark dark:text-primary font-medium" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-10">
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <h4 className="text-[11px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center"><ShieldCheck className="w-3.5 h-3.5 mr-2" /> Kyc & Identity</h4>
                        <div className="space-y-3">
                        <div><p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium capitalize">Gstin</p><p className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200 tracking-tight">{selectedVendor.gstin || 'Not Registered'}</p></div>
                        <div><p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium capitalize">Pan</p><p className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200 tracking-tight">{selectedVendor.pan || 'N/A'}</p></div>
                        </div>
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <h4 className="text-[11px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center"><CreditCard className="w-3.5 h-3.5 mr-2" /> Banking Profile</h4>
                        <div className="space-y-3">
                        <div><p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium capitalize">A/C Number</p><p className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200">{selectedVendor.account_number || 'N/A'}</p></div>
                        <div><p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium capitalize">Ifsc Code</p><p className="text-sm font-mono font-medium text-slate-800 dark:text-slate-200">{selectedVendor.ifsc_code || 'N/A'}</p></div>
                        </div>
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                        <h4 className="text-[11px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center"><ExternalLink className="w-3.5 h-3.5 mr-2" /> Contact Details</h4>
                        <div className="space-y-2">
                        <div className="flex items-center text-xs text-slate-600 dark:text-slate-400"><Phone className="w-3.5 h-3.5 mr-2 text-slate-300 dark:text-slate-600" /> {selectedVendor.phone || 'No Phone'}</div>
                        <div className="flex items-center text-xs text-slate-600 dark:text-slate-400"><Mail className="w-3.5 h-3.5 mr-2 text-slate-300 dark:text-slate-600" /> {selectedVendor.email || 'No Email'}</div>
                        <div className="flex items-start text-xs text-slate-600 dark:text-slate-400"><MapPin className="w-3.5 h-3.5 mr-2 text-slate-300 dark:text-slate-600 mt-0.5 shrink-0" /> <span className="truncate">{selectedVendor.address || 'No Address'}</span></div>
                        </div>
                    </div>
                    </div>
                    <div className="space-y-4">
                    <div className="flex items-center justify-between"><h4 className="text-[11px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center"><History className="w-4 h-4 mr-2 text-slate-300 dark:text-slate-600" /> Transaction Register</h4></div>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-x-auto bg-white dark:bg-slate-900 shadow-sm">
                        <table className="clean-table min-w-[600px]">
                        <thead><tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800"><th className="font-medium capitalize text-slate-400 dark:text-slate-500">Date</th><th className="font-medium capitalize text-slate-400 dark:text-slate-500">Bill No</th><th className="text-right font-medium capitalize text-slate-400 dark:text-slate-500">Without Gst</th><th className="text-right font-medium capitalize text-slate-400 dark:text-slate-500">Tax</th><th className="text-right font-medium capitalize text-slate-400 dark:text-slate-500">Total</th><th className="text-center font-medium capitalize text-slate-400 dark:text-slate-500">Status</th></tr></thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {stats.transactions.map((bill) => (
                            <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-none group"><td className="text-slate-500 dark:text-slate-400 font-medium">{formatDate(bill.date)}</td><td className="font-mono font-medium text-slate-900 dark:text-slate-100">{bill.bill_number}</td><td className="text-right font-mono text-slate-500 dark:text-slate-400">{(Number(bill.total_without_gst) || 0).toFixed(2)}</td><td className="text-right font-mono text-slate-500 dark:text-slate-400">{(Number(bill.total_gst) || 0).toFixed(2)}</td><td className="text-right font-mono font-medium text-slate-900 dark:text-slate-100">{(Number(bill.grand_total) || 0).toFixed(2)}</td><td className="text-center"><span className={`text-[10px] font-medium px-2 py-0.5 rounded-sm capitalize ${bill.status === 'Paid' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>{bill.status}</span></td></tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                    </div>
                </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 italic py-20"><Landmark className="w-16 h-16 opacity-5 mb-4" /><p className="text-sm font-medium">Select a vendor from the list to view profile and history.</p></div>
            )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;
