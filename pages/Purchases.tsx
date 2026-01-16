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
        .from('bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false)
        .order('date', { ascending: false });

      if (error) throw error;

      const purchaseOnly = (data || [])
        .map(normalizeBill)
        .filter(b => b.type === 'Purchase');

      setBills(purchaseOnly);
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
    const { error } = await supabase.from('bills').update({ is_deleted: true }).eq('id', deleteDialog.bill.id);
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
        <BillForm initialData={editingBill} onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, bill: null })}
        onConfirm={confirmDelete}
        title="Archive Entry"
        message={`Delete purchase entry ${deleteDialog.bill?.bill_number}?`}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 uppercase">Purchase Register</h1>
          <p className="text-slate-500 text-xs mt-1">Manage and track all vendor purchase invoices.</p>
        </div>
        <div className="flex items-center space-x-2">
           <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Status: {statusFilter}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 py-1 min-w-[120px]">
                {['All', 'Paid', 'Pending'].map(opt => (
                  <button key={opt} onClick={() => { setStatusFilter(opt); setIsMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 ${statusFilter === opt ? 'bg-primary/10 font-bold' : ''}`}>{opt}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Gross Purchase</span>
          <span className="text-xl font-bold text-slate-900">{formatCurrency(filtered.reduce((acc, b) => acc + Number(b.grand_total || 0), 0))}</span>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded md:col-span-2">
          <div className="flex items-start space-x-3">
             <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
             <p className="text-xs text-slate-500 leading-relaxed">
               This view displays all finalized purchase transactions. You can edit individual bills to update line items or tax configurations.
             </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice or vendor..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded text-xs outline-none focus:border-slate-300 bg-white" 
          />
        </div>
        
        <div className="border border-slate-200 rounded overflow-hidden">
          <table className="clean-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Bill No</th>
                <th>Vendor Name</th>
                <th className="text-right">Taxable</th>
                <th className="text-right">Grand Total</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-20 text-slate-400 uppercase text-[10px] font-bold">Fetching Records...</td></tr>
              ) : filtered.map(b => (
                <tr key={b.id}>
                  <td className="text-slate-500">{formatDate(b.date)}</td>
                  <td className="font-mono font-bold text-slate-900">{b.bill_number}</td>
                  <td className="uppercase font-medium text-slate-700">{b.vendor_name}</td>
                  <td className="text-right font-mono text-slate-500">{formatCurrency(b.total_without_gst, false)}</td>
                  <td className="text-right font-mono font-bold text-slate-900">{formatCurrency(b.grand_total, false)}</td>
                  <td className="text-center">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm ${b.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{b.status}</span>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => { setEditingBill(b); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-slate-900"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteDialog({ isOpen: true, bill: b })} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="py-20 text-center text-slate-300 italic">No purchase entries found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Purchases;