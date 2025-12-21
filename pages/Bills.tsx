
import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Filter, ChevronDown, Loader2 } from 'lucide-react';
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

    const { data } = await supabase
      .from('bills')
      .select('*')
      .eq('company_id', cid)
      .eq('is_deleted', false)
      .order('date', { ascending: false });

    setBills(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, []);

  const confirmDelete = async () => {
    if (!deleteDialog.bill) return;
    
    const { error } = await supabase
      .from('bills')
      .update({ is_deleted: true })
      .eq('id', deleteDialog.bill.id);
    
    if (error) {
      alert('Error deleting bill: ' + error.message);
    } else {
      loadData();
      window.dispatchEvent(new Event('appSettingsChanged'));
    }
  };

  const filtered = bills.filter(b => {
    const matchesStatus = statusFilter === 'All' ? true : b.status === statusFilter;
    const matchesSearch = b.bill_number?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBill ? "Edit Voucher" : "New Purchase Voucher"}>
        <BillForm initialData={editingBill} onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, bill: null })}
        onConfirm={confirmDelete}
        title="Move to Trash"
        message={`Move voucher ${deleteDialog.bill?.bill_number} from ${deleteDialog.bill?.vendor_name} to trash?`}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-slate-900 tracking-tight">Purchase Bills</h1>
        <div className="flex items-center space-x-2">
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-200 rounded-md shadow-sm text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>{statusFilter}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute top-full left-0 right-0 mt-[1px] bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1 overflow-hidden min-w-full ring-1 ring-slate-200">
                  {['All', 'Paid', 'Pending'].map(opt => (
                    <button key={opt} onClick={() => { setStatusFilter(opt); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors">{opt}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button 
            onClick={() => { setEditingBill(null); setIsModalOpen(true); }}
            className="bg-primary text-slate-800 px-5 py-2 rounded-md font-semibold text-xs uppercase tracking-wider border border-slate-200 hover:bg-primary-dark transition-all shadow-sm"
          >
            New Voucher
          </button>
        </div>
      </div>

      <div className="bg-white p-6 border border-slate-200 rounded-md w-fit min-w-[200px] boxy-shadow">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-tight mb-2">Total {statusFilter === 'All' ? '' : statusFilter} Purchase</p>
        <h2 className="text-3xl font-semibold text-slate-900">{formatCurrency(filtered.reduce((acc, b) => acc + Number(b.grand_total || 0), 0))}</h2>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Vouchers..." 
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-slate-400 shadow-sm transition-all"
          />
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
                  <th className="py-3 px-4 border-r border-slate-200 text-right">Taxable</th>
                  <th className="py-3 px-4 border-r border-slate-200 text-right font-bold">Net Total</th>
                  <th className="py-3 px-4 border-r border-slate-200 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bill) => (
                  <tr key={bill.id} className="border-b border-slate-100 hover:bg-slate-50 group transition-colors">
                    <td className="py-3 px-4 border-r border-slate-200">{formatDate(bill.date)}</td>
                    <td className="py-3 px-4 border-r border-slate-200 font-mono text-[11px]">{bill.bill_number}</td>
                    <td className="py-3 px-4 border-r border-slate-200 font-medium uppercase truncate max-w-[150px]">{bill.vendor_name}</td>
                    <td className="py-3 px-4 border-r border-slate-200 text-right">{formatCurrency(bill.total_without_gst)}</td>
                    <td className="py-3 px-4 border-r border-slate-200 text-right font-bold text-slate-900">{formatCurrency(bill.grand_total)}</td>
                    <td className="py-3 px-4 border-r border-slate-200 text-center">
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${bill.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{bill.status}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingBill(bill); setIsModalOpen(true); }} className="p-1 text-slate-400 hover:text-slate-900 transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteDialog({ isOpen: true, bill })} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-slate-400 italic">No records available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Bills;
