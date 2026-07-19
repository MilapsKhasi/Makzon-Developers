import React, { useState, useEffect } from 'react';
import { Search, Edit, Trash2, Filter, ChevronDown, Loader2, Info } from 'lucide-react';
import { formatCurrency, formatDate, getActiveCompanyId, normalizeBill } from '../utils/helpers';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';

const Purchases = () => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; bill: any | null }>({
    isOpen: false,
    bill: null
  });

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    try {
      const { data, error } = await supabase
        .from('purchase_bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map(b => normalizeBill(b)).filter(Boolean);
      const paymentVouchers = normalized.filter(b => b?.items_raw?.is_payment_voucher === true);
      const actualBills = normalized.filter(b => b && !b.items_raw?.is_payment_voucher);

      const computedBills = actualBills.map(bill => {
        const linkedVouchers = paymentVouchers.filter(v => v.items_raw?.linked_bills?.includes(bill.id));
        const totalPaidOnBill = linkedVouchers.reduce((sum, v) => {
          const pDetails = v.items_raw?.payment_details;
          const pArray = Array.isArray(pDetails) ? pDetails : (pDetails ? [pDetails] : []);
          const amt = pArray.reduce((sumVal: number, p: any) => sumVal + (Number(p.payment_amount) || 0), 0);
          return sum + amt;
        }, 0);
        const outstanding = Math.max(0, Number(bill.grand_total || 0) - totalPaidOnBill);
        const status = (outstanding === 0 && Number(bill.grand_total || 0) > 0) ? 'Paid' : 'Pending';
        return { ...bill, outstanding, status, type: 'Purchase' };
      });

      setBills(computedBills);
    } catch (err: any) {
      console.error("Error loading purchases:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, []);

  const confirmDelete = async () => {
    if (!deleteDialog.bill) return;
    const { error } = await supabase.from('purchase_bills').update({ is_deleted: true }).eq('id', deleteDialog.bill.id);
    if (error) alert('Error deleting: ' + error.message);
    else loadData();
  };

  const filtered = bills.filter(b => {
    const matchesStatus = statusFilter === 'All' ? true : b.status === statusFilter;
    const matchesSearch = b.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Edit Purchase Bill">
        <BillForm initialData={editingBill} onSubmit={(bill, isSaveAndNew) => { if (!isSaveAndNew) { setIsModalOpen(false); setEditingBill(null); } loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, bill: null })}
        onConfirm={confirmDelete}
        title="Archive Entry"
        message={`Delete purchase entry ${deleteDialog.bill?.bill_number}?`}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white uppercase">Purchase Register</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Manage and track all vendor purchase invoices.</p>
        </div>
        <div className="flex items-center space-x-2 w-full sm:w-auto">
           <div className="relative w-full sm:w-auto">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center justify-between sm:justify-start space-x-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 w-full sm:w-auto"
            >
              <div className="flex items-center space-x-2">
                <Filter className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>Status: {statusFilter}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            </button>
            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-lg z-50 py-1 min-w-[120px] w-full sm:w-auto">
                {['All', 'Paid', 'Pending'].map(opt => (
                  <button key={opt} onClick={() => { setStatusFilter(opt); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 ${statusFilter === opt ? 'bg-primary/10 dark:bg-primary/20 font-bold text-primary' : 'text-slate-600 dark:text-slate-300'}`}>{opt}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Gross Purchase</span>
          <span className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(filtered.reduce((acc, b) => acc + Number(b.grand_total || 0), 0))}</span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded sm:col-span-1 lg:col-span-2 shadow-sm">
          <div className="flex items-start space-x-3">
             <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
             <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
               This view displays all finalized purchase transactions. You can edit individual bills to update line items or tax configurations.
             </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice or vendor..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded text-xs outline-none focus:border-slate-300 dark:focus:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" 
          />
        </div>
        
        <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden bg-white dark:bg-slate-900 shadow-sm overflow-x-auto">
          <table className="clean-table w-full min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                <th className="py-3 px-4 text-left">Date</th>
                <th className="py-3 px-4 text-left">Bill No</th>
                <th className="py-3 px-4 text-left">Vendor Name</th>
                <th className="py-3 px-4 text-right">Taxable</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-20 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-bold">Fetching Records...</td></tr>
              ) : filtered.map(b => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs">{formatDate(b.date)}</td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">{b.bill_number}</td>
                  <td className="py-3 px-4 uppercase font-medium text-slate-700 dark:text-slate-300 text-xs">{b.vendor_name}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400 text-xs">{formatCurrency(b.total_without_gst, false)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">{formatCurrency(b.grand_total, false)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${b.status === 'Paid' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>{b.status}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => { setEditingBill(b); setIsModalOpen(true); }} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteDialog({ isOpen: true, bill: b })} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="py-20 text-center text-slate-300 dark:text-slate-700 italic font-medium">No purchase entries found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Purchases;