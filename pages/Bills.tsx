
import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Filter, ChevronDown, Loader2, Download } from 'lucide-react';
import { Bill } from '../types';
import { formatCurrency, formatDate, getActiveCompanyId } from '../utils/helpers';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';

const Bills = () => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; bill: any | null }>({
    isOpen: false,
    bill: null
  });

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;
    const { data } = await supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false).order('date', { ascending: false });
    setBills(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const handlePageShortcuts = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingBill(null);
        setIsModalOpen(true);
      }
      if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        alert("Export initiated via Shortcut (Alt + E)");
      }
    };
    window.addEventListener('keydown', handlePageShortcuts);
    return () => window.removeEventListener('keydown', handlePageShortcuts);
  }, []);

  const confirmDelete = async () => {
    if (!deleteDialog.bill) return;
    const { error } = await supabase.from('bills').update({ is_deleted: true }).eq('id', deleteDialog.bill.id);
    if (!error) { loadData(); window.dispatchEvent(new Event('appSettingsChanged')); }
  };

  const filtered = bills.filter(b => {
    const matchesStatus = statusFilter === 'All' ? true : b.status === statusFilter;
    const matchesSearch = b.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) || b.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBill ? "Edit Voucher" : "New Purchase Voucher"}>
        <BillForm initialData={editingBill} onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, bill: null })} onConfirm={confirmDelete} title="Move to Trash" message={`Move voucher ${deleteDialog.bill?.bill_number} from ${deleteDialog.bill?.vendor_name} to trash?`} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-slate-900 tracking-tight">Purchase Bills</h1>
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-200 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50">
             <Download className="w-3.5 h-3.5" />
             <span>Export (Alt + E)</span>
          </button>
          <button onClick={() => { setEditingBill(null); setIsModalOpen(true); }} className="bg-primary text-slate-800 px-5 py-2 rounded-md font-semibold text-xs uppercase tracking-wider border border-slate-200 hover:bg-primary-dark shadow-sm">
            New Voucher (Alt + N)
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search Vouchers..." className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-slate-400 shadow-sm transition-all" />
        </div>
        <div className="border border-slate-200 rounded-md overflow-hidden boxy-shadow">
          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 border-r border-slate-200">Date</th>
                  <th className="py-3 px-4 border-r border-slate-200">Bill No</th>
                  <th className="py-3 px-4 border-r border-slate-200">Vendor</th>
                  <th className="py-3 px-4 border-r border-slate-200 text-right font-bold">Net Total</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bill) => (
                  <tr key={bill.id} className="border-b border-slate-100 hover:bg-slate-50 group transition-colors">
                    <td className="py-3 px-4 border-r border-slate-200">{formatDate(bill.date)}</td>
                    <td className="py-3 px-4 border-r border-slate-200 font-mono text-[11px]">{bill.bill_number}</td>
                    <td className="py-3 px-4 border-r border-slate-200 font-medium uppercase truncate max-w-[150px]">{bill.vendor_name}</td>
                    <td className="py-3 px-4 border-r border-slate-200 text-right font-bold text-slate-900">{formatCurrency(bill.grand_total)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingBill(bill); setIsModalOpen(true); }} className="p-1 text-slate-400 hover:text-slate-900"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteDialog({ isOpen: true, bill })} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
  );
};

export default Bills;
