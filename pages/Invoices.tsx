
import React, { useState, useEffect } from 'react';
import { Search, Edit, Trash2, Loader2, Download, ReceiptText, Plus } from 'lucide-react';
import { formatCurrency, formatDate, getActiveCompanyId } from '../utils/helpers';
import Modal from '../components/Modal';
import SalesInvoiceForm from '../components/SalesInvoiceForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';

const Invoices = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; invoice: any | null }>({
    isOpen: false,
    invoice: null
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
        .eq('type', 'Sale')
        .order('date', { ascending: false });

    const mappedData = (data || []).map(item => ({
        ...item,
        customer_name: item.vendor_name,
        invoice_number: item.bill_number
    }));

    setInvoices(mappedData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const confirmDelete = async () => {
    if (!deleteDialog.invoice) return;
    const { error } = await supabase.from('bills').update({ is_deleted: true }).eq('id', deleteDialog.invoice.id);
    if (!error) { loadData(); window.dispatchEvent(new Event('appSettingsChanged')); }
  };

  const filtered = invoices.filter(i => {
    return i.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) || i.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingInvoice ? "Edit Sales Invoice" : "Generate Sales Invoice"} maxWidth="max-w-full">
        <SalesInvoiceForm initialData={editingInvoice} onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, invoice: null })} onConfirm={confirmDelete} title="Archive Invoice" message={`Are you sure you want to move invoice ${deleteDialog.invoice?.invoice_number} to the trash?`} />

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm">
            <ReceiptText className="w-6 h-6 text-slate-400" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Sales Invoice Register</h1>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => { setEditingInvoice(null); setIsModalOpen(true); }} className="bg-primary text-slate-900 px-8 py-3 rounded-lg font-bold text-sm border border-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 flex items-center">
            <Plus className="w-4.5 h-4.5 mr-2" /> Generate Sales Invoice
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by Invoice Number or Customer Name..." className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-xl text-base outline-none focus:border-slate-400 shadow-sm transition-all" />
        </div>
        
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
          {loading ? (
            <div className="py-40 flex flex-col items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary mb-4" /><p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Register...</p></div>
          ) : (
            <table className="w-full text-left text-base border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="py-5 px-8 border-r border-slate-200">Invoice Date</th>
                  <th className="py-5 px-8 border-r border-slate-200">Invoice No</th>
                  <th className="py-5 px-8 border-r border-slate-200">Customer / Party Name</th>
                  <th className="py-5 px-8 border-r border-slate-200 text-right">Net Receivable</th>
                  <th className="py-5 px-8 text-center">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 group transition-all duration-200">
                    <td className="py-5 px-8 border-r border-slate-100 font-bold text-slate-600">{formatDate(inv.date)}</td>
                    <td className="py-5 px-8 border-r border-slate-100 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                    <td className="py-5 px-8 border-r border-slate-100 font-bold text-slate-900 truncate max-w-[300px]">{inv.customer_name}</td>
                    <td className="py-5 px-8 border-r border-slate-100 text-right font-bold text-slate-900 text-lg">{formatCurrency(inv.grand_total)}</td>
                    <td className="py-5 px-8 text-center">
                      <div className="flex justify-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingInvoice(inv); setIsModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"><Edit className="w-5 h-5" /></button>
                          <button onClick={() => setDeleteDialog({ isOpen: true, invoice: inv })} className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="py-40 text-center"><ReceiptText className="w-16 h-16 text-slate-100 mx-auto mb-4" /><p className="text-slate-300 italic font-medium">No sales invoices found.</p></td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Invoices;
