
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Edit, Trash2, History, Maximize2, Minimize2, Loader2, Landmark, CreditCard, ShieldCheck, Plus, Contact } from 'lucide-react';
import Modal from '../components/Modal';
import CustomerForm from '../components/CustomerForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, formatDate, getActiveCompanyId } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const InfoCard = ({ label, value, desc, icon: Icon }: { label: string, value: string | number, desc?: string, icon?: any }) => (
  <div className="bg-white p-8 border border-slate-200 rounded-2xl boxy-shadow hover:border-slate-300 transition-all flex flex-col justify-between h-full">
    <div>
      <div className="flex items-center space-x-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900 truncate tracking-tight">{value || 'N/A'}</p>
    </div>
    {desc && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4 truncate">{desc}</p>}
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
      // Fetch from 'vendors' table (Unified Parties storage)
      const { data: partyData } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false).order('name');
      // Fetch from 'bills' table (Unified Vouchers storage)
      const { data: voucherData } = await supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false).eq('type', 'Sale');

      // Filter vendors to find those marked as customers (if flag exists) or show all for now if schema is restricted
      const customerOnly = (partyData || []).filter(p => p.is_customer !== false); 

      setCustomers(customerOnly);
      setInvoices((voucherData || []).map(v => ({ ...v, customer_name: v.vendor_name, invoice_number: v.bill_number })));
      
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

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('appSettingsChanged', handleSync);
    return () => window.removeEventListener('appSettingsChanged', handleSync);
  }, []);

  const handleSaveCustomer = async (customer: any) => {
    const cid = getActiveCompanyId();
    if (!cid) return;
    await loadData(editingCustomer?.id);
    setIsFormOpen(false);
    setEditingCustomer(null);
  };

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
    const transactions = invoices.filter(i => i.customer_name?.toLowerCase() === selectedCustomer.name?.toLowerCase());
    const totalSales = transactions.reduce((acc, i) => acc + Number(i.grand_total || 0), 0);
    return {
      transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalSales,
      balance: (selectedCustomer.balance || 0) + totalSales
    };
  }, [selectedCustomer, invoices]);

  return (
    <div className="space-y-10 h-full flex flex-col animate-in fade-in duration-500">
      <Modal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingCustomer(null); }} title={editingCustomer ? "Edit Customer Profile" : "Register New Customer"}>
          <CustomerForm initialData={editingCustomer} onSubmit={() => loadData()} onCancel={() => { setIsFormOpen(false); setEditingCustomer(null); }} />
      </Modal>

      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, customer: null })} onConfirm={confirmDeleteCustomer} title="Delete Customer" message={`Are you sure you want to delete "${deleteDialog.customer?.name}"?`} />

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none mb-2">Customers Ledger</h1>
          <p className="text-slate-500 font-medium text-sm">Centralized directory of clientele and sales receivable accounts.</p>
        </div>
        <button onClick={() => { setEditingCustomer(null); setIsFormOpen(true); }} className="bg-primary text-slate-900 px-8 py-3 rounded-lg font-bold text-sm border border-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 flex items-center">
            <Plus className="w-4.5 h-4.5 mr-2" /> Register New Customer
        </button>
      </div>

      {loading && customers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : (
        <div className="flex gap-8 flex-1 min-h-0 relative">
          {!isFullScreen && (
            <div className="w-80 shrink-0 flex flex-col space-y-6 overflow-hidden">
               <div className="relative shrink-0"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search customers..." className="w-full pl-12 pr-6 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-slate-400 shadow-sm transition-all" /></div>
               <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-4 custom-scrollbar">
                   {filteredCustomers.map((customer) => (
                          <div key={customer.id} onClick={() => setSelectedCustomerId(String(customer.id))} className={`p-5 border rounded-xl cursor-pointer transition-all relative group shadow-sm ${String(selectedCustomerId) === String(customer.id) ? 'bg-slate-100 border-slate-400' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                              <h3 className="font-bold text-slate-900 truncate uppercase text-[12px] mb-1">{customer.name}</h3>
                              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">{customer.gstin || 'UNREGISTERED'}</p>
                          </div>
                   ))}
               </div>
            </div>
          )}

          <div className={`flex-1 bg-white border border-slate-200 rounded-2xl p-10 flex flex-col boxy-shadow overflow-y-auto transition-all duration-300`}>
              {selectedCustomer ? (
                  <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="flex justify-between items-start mb-10 shrink-0 border-b border-slate-100 pb-8">
                        <div>
                          <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight leading-none mb-4">{selectedCustomer.name}</h2>
                          <div className="flex items-center space-x-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center bg-slate-50 px-3 py-1 rounded-full border border-slate-100"><ShieldCheck className="w-3.5 h-3.5 mr-2 text-green-500" /> GST: {selectedCustomer.gstin || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <button onClick={() => setIsFullScreen(!isFullScreen)} className="p-3 text-slate-400 border border-slate-200 rounded-xl hover:text-slate-900 transition-all shadow-sm bg-white hover:bg-slate-50">{isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
                          <button onClick={() => { setEditingCustomer(selectedCustomer); setIsFormOpen(true); }} className="p-3 text-slate-400 border border-slate-200 rounded-xl hover:text-slate-900 transition-all shadow-sm bg-white hover:bg-slate-50"><Edit className="w-5 h-5" /></button>
                          <button onClick={() => setDeleteDialog({ isOpen: true, customer: selectedCustomer })} className="p-3 text-slate-400 border border-slate-200 rounded-xl hover:text-red-500 transition-all shadow-sm bg-white hover:bg-slate-50"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0 mb-10">
                          <InfoCard label="Receivable Total" value={formatCurrency(stats.balance)} desc="Outstanding Ledger" />
                          <InfoCard label="Contact Identity" value={selectedCustomer.email || 'N/A'} desc="Sales Point of Contact" />
                          <InfoCard label="Mobile" value={selectedCustomer.phone || 'N/A'} desc="Verified Line" />
                      </div>

                      <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex items-center justify-between mb-6"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center"><History className="w-4 h-4 mr-2.5 text-slate-300" /> Sales & Billing History</p></div>
                          <div className="flex-1 overflow-auto border border-slate-200 rounded-xl shadow-inner bg-white custom-scrollbar">
                              <table className="w-full text-left text-sm table-auto border-collapse">
                                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                      <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                          <th className="py-4 px-8 border-r border-slate-200">Date</th>
                                          <th className="py-4 px-8 border-r border-slate-200">Invoice No</th>
                                          <th className="py-4 px-8 border-r border-slate-200 text-right">Bill Value</th>
                                          <th className="py-4 px-8 text-center">Settlement</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {stats.transactions.map((inv) => (
                                          <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="py-4 px-8 border-r border-slate-100 font-bold text-slate-600">{formatDate(inv.date)}</td>
                                              <td className="py-4 px-8 border-r border-slate-100 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                                              <td className="py-4 px-8 border-r border-slate-100 text-right font-bold text-slate-900">{formatCurrency(inv.grand_total)}</td>
                                              <td className="py-4 px-8 text-center"><span className={`text-[9px] font-bold uppercase px-3 py-1 rounded-full border ${inv.status === 'Paid' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{inv.status}</span></td>
                                          </tr>
                                      ))}
                                      {stats.transactions.length === 0 && <tr><td colSpan={4} className="py-32 text-center text-slate-300 italic text-base">No transaction history found for this customer.</td></tr>}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-base py-24"><Contact className="w-20 h-20 opacity-5 mb-6" /><p className="font-medium">Select a customer from the ledger list.</p></div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
