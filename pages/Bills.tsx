
import React, { useState, useEffect } from 'react';
import { Search, Loader2, Edit, Trash2 } from 'lucide-react';
import { formatDate, getActiveCompanyId } from '../utils/helpers';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import ConfirmDialog from '../components/ConfirmDialog';
import DateFilter from '../components/DateFilter';
import { supabase } from '../lib/supabase';

const Bills = () => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; bill: any | null }>({
    isOpen: false,
    bill: null
  });

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }
    
    try {
      // Fetch bills for this company that aren't deleted
      // We filter by 'type' but also consider null/empty as 'Purchase' for robustness
      let query = supabase.from('bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);
      
      if (dateRange.startDate && dateRange.endDate) {
        query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }
      
      const { data, error } = await query.order('date', { ascending: false });
      
      if (error) throw error;
      
      // Client-side filter to strictly show Purchase bills or untyped ones (defaulting to purchase)
      const purchaseBills = (data || []).filter(b => b.type === 'Purchase' || !b.type);
      setBills(purchaseBills);
    } catch (err) {
      console.error("Error loading bills:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('appSettingsChanged', handleRefresh);
    return () => window.removeEventListener('appSettingsChanged', handleRefresh);
  }, [dateRange]);

  const confirmDelete = async () => {
    if (!deleteDialog.bill) return;
    const { error } = await supabase.from('bills').update({ is_deleted: true }).eq('id', deleteDialog.bill.id);
    if (!error) {
      loadData();
      window.dispatchEvent(new Event('appSettingsChanged'));
    }
    setDeleteDialog({ isOpen: false, bill: null });
  };

  const filtered = bills.filter(b => {
    const search = searchQuery.toLowerCase();
    return b.bill_number?.toLowerCase().includes(search) || 
           b.vendor_name?.toLowerCase().includes(search);
  });

  const totalPurchase = filtered.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBill ? "Edit Purchase Bill" : "Register Purchase Bill"} maxWidth="max-w-4xl">
        <BillForm initialData={editingBill} onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, bill: null })} onConfirm={confirmDelete} title="Archive Bill" message={`Are you sure you want to delete bill ${deleteDialog.bill?.bill_number}?`} />

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-normal text-slate-900">Bills</h1>
        <div className="flex items-center space-x-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-md text-xs hover:bg-slate-50 transition-none">Export to</button>
          <DateFilter onFilterChange={setDateRange} />
          <button 
            onClick={() => { setEditingBill(null); setIsModalOpen(true); }}
            className="bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm hover:bg-primary-dark transition-none"
          >
            NEW ENTRY
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-5 inline-block min-w-[200px]">
        <span className="text-[11px] text-slate-500 font-normal uppercase tracking-tight mb-1 block">TOTAL PURCHASE</span>
        <span className="text-[24px] font-normal text-slate-900 leading-none">{totalPurchase.toFixed(2)}</span>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything" 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none"
          />
        </div>
        
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          <table className="clean-table">
            <thead>
              <tr>
                <th className="w-16">SR NO</th>
                <th>DATE</th>
                <th>BILL NO</th>
                <th>VENDOR</th>
                <th>WITHOUT GST</th>
                <th>GST</th>
                <th>WITH GST</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">Loading records...</td></tr>
              ) : filtered.map((b, i) => (
                <tr key={b.id} className="hover:bg-slate-50/30">
                  <td>{i + 1}</td>
                  <td>{formatDate(b.date)}</td>
                  <td className="font-mono">{b.bill_number}</td>
                  <td className="uppercase">{b.vendor_name}</td>
                  <td>{Number(b.total_without_gst || 0).toFixed(2)}</td>
                  <td>{Number(b.total_gst || 0).toFixed(2)}</td>
                  <td className="font-medium text-slate-900">{Number(b.grand_total || 0).toFixed(2)}</td>
                  <td>
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm uppercase ${b.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex space-x-2">
                        <button onClick={() => { setEditingBill(b); setIsModalOpen(true); }} className="text-slate-400 hover:text-slate-900"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteDialog({ isOpen: true, bill: b })} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-20 text-slate-400 italic">No purchase bills found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Bills;
