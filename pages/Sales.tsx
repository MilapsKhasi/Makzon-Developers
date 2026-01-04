
import React, { useState, useEffect } from 'react';
import { Search, Loader2, Edit, Trash2, Plus, ReceiptText } from 'lucide-react';
import { formatDate, getActiveCompanyId, normalizeBill } from '../utils/helpers';
import Modal from '../components/Modal';
import SalesInvoiceForm from '../components/SalesInvoiceForm';
import ConfirmDialog from '../components/ConfirmDialog';
import DateFilter from '../components/DateFilter';
import { supabase } from '../lib/supabase';

const Sales = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; invoice: any | null }>({
    isOpen: false,
    invoice: null
  });

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;
    
    try {
      // Fetch records for the company and filter client-side to handle missing 'type' column in DB
      let query = supabase.from('bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);

      if (dateRange.startDate && dateRange.endDate) {
        query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }
      const { data, error } = await query.order('date', { ascending: false });
      
      if (error) throw error;
      
      const normalizedData = (data || [])
        .map(normalizeBill)
        .filter(i => i.type === 'Sale'); // Filter for Sale only

      setInvoices(normalizedData);
    } catch (err: any) {
      console.error("Error loading sales:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('appSettingsChanged', loadData);
    return () => window.removeEventListener('appSettingsChanged', loadData);
  }, [dateRange]);

  const confirmDelete = async () => {
    if (!deleteDialog.invoice) return;
    const { error } = await supabase.from('bills').update({ is_deleted: true }).eq('id', deleteDialog.invoice.id);
    if (!error) loadData();
    setDeleteDialog({ isOpen: false, invoice: null });
  };

  const filtered = invoices.filter(i => {
    const search = searchQuery.toLowerCase();
    return i.bill_number?.toLowerCase().includes(search) || i.vendor_name?.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingInvoice ? "Update Sale Invoice" : "Generate Sale Invoice"} maxWidth="max-w-6xl">
        <SalesInvoiceForm initialData={editingInvoice} onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, invoice: null })} onConfirm={confirmDelete} title="Delete Invoice" message={`Permanently archive sale invoice ${deleteDialog.invoice?.bill_number}?`} />

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-normal text-slate-900">Sales Ledger</h1>
        <div className="flex items-center space-x-2">
          <DateFilter onFilterChange={setDateRange} />
          <button 
            onClick={() => { setEditingInvoice(null); setIsModalOpen(true); }}
            className="bg-link text-white px-8 py-2 rounded-md font-normal text-sm hover:bg-link/90 transition-none uppercase"
          >
            <Plus className="w-4 h-4 mr-2" /> New Sale
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-5 inline-block min-w-[240px]">
        <span className="text-[11px] text-slate-500 font-normal uppercase tracking-tight mb-1 block">Total Revenue</span>
        <span className="text-[24px] font-normal text-link font-mono">
            {filtered.reduce((acc, i) => acc + Number(i.grand_total || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice number or customer name..." 
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300 shadow-sm"
          />
        </div>
        
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          <table className="clean-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                <th className="w-16">SR</th>
                <th>DATE</th>
                <th>INVOICE #</th>
                <th>CUSTOMER</th>
                <th className="text-right">TAXABLE</th>
                <th className="text-right">GST</th>
                <th className="text-right">NET TOTAL</th>
                <th className="text-center">STATUS</th>
                <th className="text-center">MANAGE</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-20 text-slate-400 font-semibold tracking-widest text-[10px] uppercase">Loading register...</td></tr>
              ) : filtered.map((inv, i) => (
                <tr key={inv.id} className="hover:bg-slate-50/50 group transition-colors">
                  <td>{i + 1}</td>
                  <td>{formatDate(inv.date)}</td>
                  <td className="font-mono font-bold text-slate-900">{inv.bill_number}</td>
                  <td className="uppercase font-medium text-slate-700">{inv.vendor_name}</td>
                  <td className="text-right font-mono text-slate-500">{(Number(inv.total_without_gst) || 0).toFixed(2)}</td>
                  <td className="text-right font-mono text-slate-500">{(Number(inv.total_gst) || 0).toFixed(2)}</td>
                  <td className="text-right font-mono font-bold text-slate-900">{(Number(inv.grand_total) || 0).toFixed(2)}</td>
                  <td className="text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm uppercase ${inv.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center space-x-2">
                        <button onClick={() => { setEditingInvoice(inv); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-all"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteDialog({ isOpen: true, invoice: inv })} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-20 text-slate-300 italic font-medium">No sales invoices found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Sales;
