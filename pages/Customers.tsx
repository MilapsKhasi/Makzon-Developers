
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Edit, Trash2, History, Maximize2, Minimize2, Loader2, Landmark, Plus, Contact, Phone, Mail, MapPin } from 'lucide-react';
import Modal from '../components/Modal';
import CustomerForm from '../components/CustomerForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, formatDate, getActiveCompanyId } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const StatCard = ({ label, value, colorClass = "text-slate-900" }: { label: string, value: string, colorClass?: string }) => (
  <div className="bg-white p-6 border border-slate-200 rounded-xl hover:border-slate-300 transition-all">
    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-xl font-bold ${colorClass} tracking-tight font-mono`}>{value}</p>
  </div>
);

const Customers = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; customer: any | null }>({
    isOpen: false,
    customer: null
  });

  const loadData = async (newIdToSelect?: string) => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    try {
      const { data: partyData } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false).order('name');
      const { data: voucherData } = await supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false).eq('type', 'Sale');

      const customerOnly = (partyData || []).filter(p => p.is_customer === true); 

      setCustomers(customerOnly);
      setInvoices(voucherData || []);
      
      if (newIdToSelect) {
        setSelectedCustomerId(String(newIdToSelect));
      } else if (customerOnly.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(String(customerOnly[0].id));
      }
    } catch (error: any) {
      console.error("Error loading customer data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fixed event listener to handle custom 'appSettingsChanged' event and fix type mismatch by using a wrapper function
  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('appSettingsChanged', handleSync);
    return () => window.removeEventListener('appSettingsChanged', handleSync);
  }, []);

  const confirmDeleteCustomer = async () => {
      if (!deleteDialog.customer) return;
      await supabase.from('vendors').update({ is_deleted: true }).eq('id', deleteDialog.customer.id);
      loadData();
      if (selectedCustomerId === deleteDialog.customer.id) setSelectedCustomerId(null);
  };

  const filteredCustomers = customers.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedCustomer = useMemo(() => customers.find(c => String(c.id) === String(selectedCustomerId)), [customers, selectedCustomerId]);

  const stats = useMemo(() => {
    if (!selectedCustomer) return { transactions: [], totalSales: 0, balance: 0 };
    const transactions = invoices.filter(i => i.vendor_name?.toLowerCase() === selectedCustomer.name?.toLowerCase());
    const totalSales = transactions.reduce((acc, i) => acc + Number(i.grand_total || 0), 0);
    const settled = transactions.filter(t => t.status === 'Paid').reduce((acc, t) => acc + Number(t.grand_total || 0), 0);
    return {
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalSales,
      balance: (selectedCustomer.balance || 0) + totalSales - settled
    };
  }, [selectedCustomer, invoices]);

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-300">
      <Modal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingCustomer(null); }} title={editingCustomer ? "Edit Customer Ledger" : "Register New Customer"}>
          <CustomerForm initialData={editingCustomer} onSubmit={() => loadData()} onCancel={() => { setIsFormOpen(false); setEditingCustomer(null); }} />
      </Modal>

      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, customer: null })} onConfirm={confirmDeleteCustomer} title="Delete Customer" message={`Delete customer account for "${deleteDialog.customer?.name}"?`} />

      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-[20px] font-normal text-slate-900">Customers Ledger</h1>
        <button onClick={() => { setEditingCustomer(null); setIsFormOpen(true); }} className="bg-link text-white px-8 py-2 rounded-md font-normal text-sm hover:bg-link/90 transition-none uppercase">
            <Plus className="w-4 h-4 mr-2 inline" /> New Customer
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        {!isFullScreen && (
          <div className="w-80 shrink-0 flex flex-col space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search parties..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300 shadow-sm" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} onClick={() => setSelectedCustomerId(String(customer.id))} className={`p-4 border rounded-md cursor-pointer transition-none ${String(selectedCustomerId) === String(customer.id) ? 'bg-link text-white border-slate-900 shadow-sm' : 'bg-white border-slate-100 hover:bg-slate-50'}`}>
                  <h3 className={`font-bold uppercase truncate mb-1 text-xs ${String(selectedCustomerId) === String(customer.id) ? 'text-white' : 'text-slate-900'}`}>{customer.name}</h3>
                  <p className={`text-[10px] font-bold ${String(selectedCustomerId) === String(customer.id) ? 'text-white/70' : 'text-slate-400'}`}>GST: {customer.gstin || 'UNREGISTERED'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`flex-1 bg-white border border-slate-200 rounded-md flex flex-col overflow-hidden ${isFullScreen ? 'fixed inset-4 z-[500] m-0 shadow-2xl' : ''}`}>
          {selectedCustomer ? (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
              <div className="px-8 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-slate-50 rounded flex items-center justify-center border border-slate-200"><Contact className="w-5 h-5 text-slate-400" /></div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 uppercase leading-none">{selectedCustomer.name}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">ID: {selectedCustomer.id.split('-')[0]}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-slate-900 transition-none">{isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
                  <button onClick={() => { setEditingCustomer(selectedCustomer); setIsFormOpen(true); }} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-slate-900 transition-none"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteDialog({ isOpen: true, customer: selectedCustomer })} className="p-2 text-slate-400 border border-slate-200 rounded hover:text-red-500 transition-none"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                  <StatCard label="Total Receivable" value={formatCurrency(stats.balance)} colorClass="text-link" />
                  <StatCard label="Gross Sales" value={formatCurrency(stats.totalSales)} colorClass="text-slate-600" />
                  <StatCard label="GST Aggregate" value={selectedCustomer.gstin || 'N/A'} colorClass="text-slate-400 text-sm" />
                  <StatCard label="Status" value="Active" colorClass="text-emerald-500" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                  <div className="space-y-4 bg-slate-50/50 p-6 rounded-xl border border-slate-100">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><Phone className="w-3.5 h-3.5 mr-2" /> Communication</h4>
                    <div className="text-xs text-slate-600 space-y-2">
                        <p className="flex items-center"><Phone className="w-3.5 h-3.5 mr-2 opacity-30" /> {selectedCustomer.phone || 'N/A'}</p>
                        <p className="flex items-center"><Mail className="w-3.5 h-3.5 mr-2 opacity-30" /> {selectedCustomer.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="space-y-4 bg-slate-50/50 p-6 rounded-xl border border-slate-100 md:col-span-2">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><MapPin className="w-3.5 h-3.5 mr-2" /> Office Address</h4>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{selectedCustomer.address || 'No registered address.'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between"><h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><History className="w-4 h-4 mr-2 text-slate-300" /> Sales & Billing History</h4></div>
                  <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                    <table className="clean-table">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <th>Date</th>
                                <th>Invoice #</th>
                                <th className="text-right">Taxable</th>
                                <th className="text-right">GST</th>
                                <th className="text-right">Grand Total</th>
                                <th className="text-center">Settlement</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.transactions.map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="text-slate-500 font-medium">{formatDate(inv.date)}</td>
                                    <td className="font-mono font-bold text-slate-900">{inv.bill_number}</td>
                                    <td className="text-right font-mono text-slate-400">{(inv.total_without_gst || 0).toFixed(2)}</td>
                                    <td className="text-right font-mono text-slate-400">{(inv.total_gst || 0).toFixed(2)}</td>
                                    <td className="text-right font-mono font-bold text-slate-900">{(inv.grand_total || 0).toFixed(2)}</td>
                                    <td className="text-center"><span className={`text-[9px] font-bold px-3 py-0.5 rounded-full uppercase ${inv.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>{inv.status}</span></td>
                                </tr>
                            ))}
                            {stats.transactions.length === 0 && (
                                <tr><td colSpan={6} className="py-20 text-center text-slate-300 italic">No sales transactions found for this customer.</td></tr>
                            )}
                        </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 italic py-24">
                <Contact className="w-16 h-16 opacity-5 mb-4" />
                <p className="text-sm font-medium">Select a customer from the ledger to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Customers;