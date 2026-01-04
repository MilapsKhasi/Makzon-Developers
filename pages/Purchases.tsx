
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
      // Use client-side filtering to avoid query errors on non-existent columns
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
    
    const { error } = await supabase
      .from('bills')
      .update({ is_deleted: true })
      .eq('id', deleteDialog.bill.id);
    
    if (error) {
      alert('Error deleting entry: ' + error.message);
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
    <div className="space-y-10 animate-in fade-in duration-500">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Edit Purchase Voucher" maxWidth="max-w-full">
        <BillForm initialData={editingBill} onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, bill: null })}
        onConfirm={confirmDelete}
        title="Delete Purchase"
        message={`Move purchase entry ${deleteDialog.bill?.bill_number} to trash?`}
      />

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-2">Purchase Transactions</h1>
          <p className="text-slate-500 font-medium text-sm">Detailed ledger of all verified purchase entries and acquisitions.</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-200 rounded-lg shadow-sm text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Filter className="w-4 h-4 text-slate-400" />
              <span>{statusFilter}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)}></div>
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-2 overflow-hidden min-w-[150px] ring-1 ring-black/5">
                  {['All', 'Paid', 'Pending'].map(opt => (
                    <button key={opt} onClick={() => { setStatusFilter(opt); setIsMenuOpen(false); }} className={`w-full text-left px-5 py-3 text-sm font-bold transition-colors ${statusFilter === opt ? 'bg-primary text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>{opt}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-stretch gap-6">
        <div className="bg-white p-8 border border-slate-200 rounded-2xl w-fit min-w-[250px] boxy-shadow flex flex-col justify-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Net Volume ({statusFilter})</p>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{formatCurrency(filtered.reduce((acc, b) => acc + Number(b.grand_total || 0), 0))}</h2>
        </div>
        
        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex items-start gap-4 shadow-inner">
          <div className="p-2.5 bg-blue-50 text-blue-500 rounded-lg shrink-0">
             <Info className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight mb-1">Synchronization Notice</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                This register is an automated view of your <span className="text-slate-900 font-bold">Purchase Bills</span>. Entries here are derived from the detailed invoices processed in the Bills module.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries by bill number or party..." 
            className="w-full pl-14 pr-6 py-4 border border-slate-200 rounded-xl outline-none text-base focus:border-slate-400 bg-white shadow-sm transition-all font-medium" 
          />
        </div>
        
        <div className="border border-slate-200 rounded-2xl overflow-hidden boxy-shadow bg-white">
          {loading ? (
            <div className="py-40 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Filtering Entries...</p>
            </div>
          ) : (
            <table className="w-full text-left text-base border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="py-5 px-8 border-r border-slate-200">Voucher Date</th>
                  <th className="py-5 px-8 border-r border-slate-200 font-mono">Invoice No</th>
                  <th className="py-5 px-8 border-r border-slate-200">Vendor / Party</th>
                  <th className="py-5 px-8 border-r border-slate-200 text-right">Taxable</th>
                  <th className="py-5 px-8 border-r border-slate-200 text-right font-bold">Total Payable</th>
                  <th className="py-5 px-8 border-r border-slate-200 text-center">Status</th>
                  <th className="py-5 px-8 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 group transition-all duration-200">
                    <td className="py-5 px-8 border-r border-slate-200 font-bold text-slate-600">{formatDate(b.date)}</td>
                    <td className="py-5 px-8 border-r border-slate-200 font-mono text-[13px] font-bold text-slate-900">{b.bill_number}</td>
                    <td className="py-5 px-8 border-r border-slate-200 font-bold text-slate-900 uppercase truncate max-w-[200px]">{b.vendor_name}</td>
                    <td className="py-5 px-8 border-r border-slate-200 text-right text-slate-600 font-medium">{formatCurrency(b.total_without_gst)}</td>
                    <td className="py-5 px-8 border-r border-slate-200 text-right font-bold text-slate-900">{formatCurrency(b.grand_total)}</td>
                    <td className="py-5 px-8 border-r border-slate-200 text-center">
                        <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full border ${b.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>{b.status}</span>
                    </td>
                    <td className="py-5 px-8 text-center">
                      <div className="flex justify-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingBill(b); setIsModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-200"><Edit className="w-5 h-5" /></button>
                        <button onClick={() => setDeleteDialog({ isOpen: true, bill: b })} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-200"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-40 text-center text-slate-300 italic font-medium">No purchase records found matching your current filters.</td>
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

export default Purchases;
