
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Edit, Trash2, History, Filter, ChevronDown, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import Modal from '../components/Modal';
import VendorForm from '../components/VendorForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, formatDate, getActiveCompanyId } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const InfoCard = ({ label, value, desc }: { label: string, value: string | number, desc?: string }) => (
  <div className="bg-white p-6 border border-slate-200 rounded-md boxy-shadow hover:border-slate-300 transition-all flex flex-col justify-between">
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-900 truncate">{value}</p>
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

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    try {
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('name');

      const { data: billData } = await supabase
        .from('bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);

      setVendors(vendorData || []);
      setBills(billData || []);
      
      if (vendorData && vendorData.length > 0 && !selectedVendorId) {
        setSelectedVendorId(vendorData[0].id);
      }
    } catch (error) {
      console.error("Error loading vendor data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, []);

  const handleSaveVendor = async (vendor: any) => {
    const cid = getActiveCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (editingVendor) {
      await supabase.from('vendors').update({ ...vendor }).eq('id', editingVendor.id);
    } else {
      await supabase.from('vendors').insert([{ ...vendor, company_id: cid, user_id: user?.id }]);
    }
    
    loadData();
    setIsFormOpen(false);
  };

  const confirmDeleteVendor = async () => {
      if (!deleteDialog.vendor) return;
      await supabase.from('vendors').update({ is_deleted: true }).eq('id', deleteDialog.vendor.id);
      loadData();
      if (selectedVendorId === deleteDialog.vendor.id) setSelectedVendorId(null);
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
      transactions,
      totalPurchase,
      balance: (selectedVendor.balance || 0) + totalPurchase
    };
  }, [selectedVendor, bills, statusFilter]);

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingVendor ? "Edit Vendor" : "New Vendor"}>
          <VendorForm initialData={editingVendor} onSubmit={handleSaveVendor} onCancel={() => setIsFormOpen(false)} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, vendor: null })}
        onConfirm={confirmDeleteVendor}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${deleteDialog.vendor?.name}"? This vendor and its settings will be moved to Trash.`}
      />

      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-medium text-slate-900 tracking-tight">Vendors</h1>
        <button onClick={() => { setEditingVendor(null); setIsFormOpen(true); }} className="bg-primary text-slate-800 px-5 py-2 rounded-md font-semibold text-xs uppercase tracking-wider border border-slate-200 hover:bg-primary-dark transition-all shadow-sm">New Vendor</button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0 relative">
          {!isFullScreen && (
            <div className="w-80 shrink-0 flex flex-col space-y-4 overflow-hidden">
               <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search Vendors..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-slate-400 shadow-sm" />
               </div>
               <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                   {filteredVendors.map((vendor) => {
                        const vendorPurchases = bills
                          .filter(b => b.vendor_name?.toLowerCase() === vendor.name?.toLowerCase())
                          .reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
                        const outstanding = (vendor.balance || 0) + vendorPurchases;

                        return (
                          <div 
                              key={vendor.id} 
                              onClick={() => setSelectedVendorId(String(vendor.id))} 
                              className={`p-4 border rounded-md cursor-pointer transition-colors ${String(selectedVendorId) === String(vendor.id) ? 'bg-slate-100 border-slate-400 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                          >
                              <h3 className="font-semibold text-slate-900 truncate uppercase text-[11px]">{vendor.name}</h3>
                              <p className="text-[10px] text-slate-500 font-mono mt-1">{vendor.gstin || 'NO GST'}</p>
                              <div className="mt-4 flex justify-between items-center border-t border-slate-100 pt-2 text-[10px] font-bold text-slate-400">
                                  <span>OUTSTANDING</span>
                                  <span className="text-slate-900">{formatCurrency(outstanding)}</span>
                              </div>
                          </div>
                        );
                   })}
               </div>
            </div>
          )}

          <div className={`flex-1 bg-white border border-slate-200 rounded-md p-8 flex flex-col boxy-shadow overflow-hidden transition-all duration-300`}>
              {selectedVendor ? (
                  <div className="flex flex-col h-full overflow-hidden">
                      <div className="flex justify-between items-start mb-6 shrink-0">
                        <div>
                          <h2 className="text-2xl font-semibold text-slate-900 uppercase tracking-tight">{selectedVendor.name}</h2>
                          <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">{selectedVendor.gstin || 'NO GST RECORDED'}</p>
                        </div>
                        <div className="flex space-x-2">
                          <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-slate-900 transition-colors shadow-sm">
                             {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                          </button>
                          <button onClick={() => { setEditingVendor(selectedVendor); setIsFormOpen(true); }} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-slate-900 transition-colors shadow-sm"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteDialog({ isOpen: true, vendor: selectedVendor })} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-red-500 transition-colors shadow-sm"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 shrink-0 mb-8">
                          <InfoCard label="Outstanding Balance" value={formatCurrency(stats.balance)} desc="Current Total Payables" />
                          <InfoCard label="Email Contact" value={selectedVendor.email || 'None'} desc="Business Mail" />
                          <InfoCard label="Contact Phone" value={selectedVendor.phone || 'None'} desc="Primary Mobile/Work" />
                      </div>

                      <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex items-center justify-between mb-4">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><History className="w-3.5 h-3.5 mr-2" /> Transaction Ledger</p>
                              <div className="relative">
                                  <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold uppercase text-slate-600 hover:bg-slate-100 transition-colors">
                                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{statusFilter}</span>
                                    <ChevronDown className="w-3 h-3" />
                                  </button>
                                  {isMenuOpen && (
                                    <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                                    <div className="absolute top-full left-0 right-0 mt-[1px] bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1 min-w-[140px]">
                                      {['All', 'Paid', 'Pending'].map(opt => (
                                        <button key={opt} onClick={() => { setStatusFilter(opt); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors">{opt}</button>
                                      ))}
                                    </div>
                                    </>
                                  )}
                              </div>
                          </div>
                          <div className="flex-1 overflow-auto border border-slate-100 rounded-sm">
                              <table className="w-full text-left text-xs">
                                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                      <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                          <th className="py-2.5 px-4">Date</th>
                                          <th className="py-2.5 px-4">Bill No</th>
                                          <th className="py-2.5 px-4 text-right">Net Total</th>
                                          <th className="py-2.5 px-4 text-center">Status</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {stats.transactions.map((bill) => (
                                          <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="py-3 px-4">{formatDate(bill.date)}</td>
                                              <td className="py-3 px-4 font-mono text-[11px]">{bill.bill_number}</td>
                                              <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(bill.grand_total)}</td>
                                              <td className="py-3 px-4 text-center">
                                                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${bill.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{bill.status}</span>
                                              </td>
                                          </tr>
                                      ))}
                                      {stats.transactions.length === 0 && <tr><td colSpan={4} className="py-20 text-center text-slate-300 italic">No records found.</td></tr>}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 italic text-sm">Select a vendor from the left.</div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;
