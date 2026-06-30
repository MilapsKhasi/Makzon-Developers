
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Edit, Trash2, History, Maximize2, Minimize2, Loader2, Landmark, Plus, Contact, Phone, Mail, MapPin, Calculator, ArrowLeft } from 'lucide-react';
import Modal from '../components/Modal';
import CustomerForm from '../components/CustomerForm';
import LedgerModal from '../components/LedgerModal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { formatCurrency, formatDate, getActiveCompanyId, normalizeBill } from '../utils/helpers';
import { supabase } from '../lib/supabase';

const StatCard = ({ label, value, colorClass = "text-slate-900 dark:text-white" }: { label: string, value: string, colorClass?: string }) => (
  <div className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all">
    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest mb-1">{label}</p>
    <p className={`text-xl font-medium ${colorClass} tracking-tight font-mono`}>{value}</p>
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
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  
  const [lastShiftNTime, setLastShiftNTime] = useState(0);
  const [lastShiftETime, setLastShiftETime] = useState(0);
  const [lastShiftFTime, setLastShiftFTime] = useState(0);
  const [lastShiftDTime, setLastShiftDTime] = useState(0);
  const [actionFocusIdx, setActionFocusIdx] = useState<number | null>(null);
  const [tableRowIdx, setTableRowIdx] = useState<number | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fullScreenBtnRef = useRef<HTMLButtonElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; customer: any | null }>({
    isOpen: false,
    customer: null
  });

  const loadData = async (newIdToSelect?: string) => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    try {
      const { data: partyData } = await supabase.from('customers').select('*').eq('company_id', cid).eq('is_deleted', false).order('name');
      const { data: voucherData } = await supabase.from('sales_invoices').select('*').eq('company_id', cid).eq('is_deleted', false);

      const normalizedInvoices = (voucherData || []).map(s => {
        const norm = normalizeBill(s);
        return norm ? { ...norm, type: 'Sale' } : null;
      }).filter(Boolean) as any[];
      const customerNamesFromBills = new Set(normalizedInvoices.map(v => v.vendor_name?.toLowerCase().trim()));

      const customerOnly = (partyData || []).filter(p => {
          const name = p.name?.toLowerCase().trim();
          return p.party_type === 'customer' || p.is_customer === true || customerNamesFromBills.has(name);
      });

      setCustomers(customerOnly);
      setInvoices(normalizedInvoices);
      
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

  const confirmDeleteCustomer = async () => {
      if (!deleteDialog.customer) return;
      await supabase.from('customers').update({ is_deleted: true }).eq('id', deleteDialog.customer.id);
      loadData();
      if (selectedCustomerId === deleteDialog.customer.id) setSelectedCustomerId(null);
      setDeleteDialog({ isOpen: false, customer: null });
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

  useEffect(() => {
    if (actionFocusIdx === 0) fullScreenBtnRef.current?.focus();
    if (actionFocusIdx === 1) editBtnRef.current?.focus();
    if (actionFocusIdx === 2) deleteBtnRef.current?.focus();
  }, [actionFocusIdx]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteDialog.isOpen) {
          e.preventDefault();
          setDeleteDialog({ isOpen: false, customer: null });
        } else if (isFormOpen) {
          e.preventDefault();
          setIsFormOpen(false);
          setEditingCustomer(null);
        } else if (isFullScreen) {
          e.preventDefault();
          setIsFullScreen(false);
        }
        return;
      }

      const activeEl = document.activeElement;
      const isFocusedInInput = (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'SELECT') && activeEl !== searchInputRef.current;
      if (isFocusedInInput || isFormOpen) return;

      if (tableRowIdx !== null) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setTableRowIdx(prev => Math.min((prev || 0) + 1, stats.transactions.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setTableRowIdx(prev => Math.max((prev || 0) - 1, 0));
        }
      }

      if (e.shiftKey) {
        if (e.key === 'N' || e.key === 'n') setLastShiftNTime(Date.now());
        if (e.key === 'E' || e.key === 'e') {
            setLastShiftETime(Date.now());
            if (tableRowIdx !== null && stats.transactions[tableRowIdx]) {
                e.preventDefault();
                alert("Redirecting to Bill edition is handled in Bills Ledger. Use Shift+E+C for customer.");
            }
        }
        if (e.key === 'F' || e.key === 'f') setLastShiftFTime(Date.now());
        if (e.key === 'D' || e.key === 'd') {
            setLastShiftDTime(Date.now());
        }

        if ((e.key === 'C' || e.key === 'c') && (Date.now() - lastShiftNTime < 1000)) {
            e.preventDefault(); setEditingCustomer(null); setIsFormOpen(true); setLastShiftNTime(0); return;
        }
        if ((e.key === 'C' || e.key === 'c') && (Date.now() - lastShiftETime < 1000)) {
            e.preventDefault(); setEditingCustomer(selectedCustomer); setIsFormOpen(true); setLastShiftETime(0); return;
        }
        if ((e.key === 'C' || e.key === 'c') && (Date.now() - lastShiftFTime < 1000)) {
            e.preventDefault(); setIsFullScreen(!isFullScreen); setLastShiftFTime(0); return;
        }
        if ((e.key === 'C' || e.key === 'c') && (Date.now() - lastShiftDTime < 1000)) {
            e.preventDefault();
            if (!deleteDialog.isOpen) setDeleteDialog({ isOpen: true, customer: selectedCustomer });
            else confirmDeleteCustomer();
            setLastShiftDTime(0); return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault(); searchInputRef.current?.focus(); setTableRowIdx(null); setActionFocusIdx(null);
        } else if (e.key === 'ArrowDown') {
            if (activeEl === searchInputRef.current) {
                e.preventDefault(); if (filteredCustomers.length > 0) setSelectedCustomerId(filteredCustomers[0].id);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault(); setActionFocusIdx(prev => (prev === null ? 0 : (prev + 1) % 3)); setTableRowIdx(null);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (stats.transactions.length > 0) {
                setTableRowIdx(0); setActionFocusIdx(null);
            }
        }
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [filteredCustomers, selectedCustomerId, actionFocusIdx, tableRowIdx, lastShiftNTime, lastShiftETime, lastShiftFTime, lastShiftDTime, isFullScreen, isFormOpen, deleteDialog, stats, selectedCustomer]);

  return (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in duration-300">
      <Modal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingCustomer(null); }} title={editingCustomer ? "Edit Customer Ledger" : "Register New Customer"} maxWidth="max-w-4xl">
          <CustomerForm initialData={editingCustomer} onSubmit={(saved) => { setIsFormOpen(false); setEditingCustomer(null); loadData(saved.id); }} onCancel={() => { setIsFormOpen(false); setEditingCustomer(null); }} />
      </Modal>

      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, customer: null })} onConfirm={confirmDeleteCustomer} title="Delete Customer" message={`Delete customer account for "${deleteDialog.customer?.name}"? (Press Shift + D + C again to confirm)`} />

      <LedgerModal isOpen={isLedgerOpen} onClose={() => setIsLedgerOpen(false)} party={selectedCustomer} type="customer" />

      <div className="flex flex-col sm:flex-row justify-between items-center shrink-0 gap-4">
        <h1 className="text-[20px] font-medium text-slate-900 dark:text-white capitalize w-full sm:w-auto">Customers Ledger</h1>
        {customers.length > 0 && (
          <button 
            onClick={() => { setEditingCustomer(null); setIsFormOpen(true); }} 
            className="bg-link text-white px-8 py-2 rounded-md font-medium text-sm hover:bg-link/90 transition-none flex items-center capitalize w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 mr-2" /> New Customer
          </button>
        )}
      </div>

      {!loading && customers.length === 0 ? (
        <EmptyState 
          title="No Customers Ledger" 
          message="Keep your revenue pipeline flowing by adding your first customer to the digital desk!" 
          actionLabel="Register New Customer" 
          onAction={() => { setEditingCustomer(null); setIsFormOpen(true); }} 
        />
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
            {!isFullScreen && (
            <div className={`w-full lg:w-80 shrink-0 flex flex-col space-y-4 ${selectedCustomerId ? 'hidden lg:flex' : 'flex'}`}>
                <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 w-4 h-4" />
                <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search parties..." className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md text-xs outline-none focus:border-slate-300 dark:focus:border-slate-600 shadow-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredCustomers.map((customer) => (
                    <div key={customer.id} onClick={() => setSelectedCustomerId(String(customer.id))} className={`p-4 border rounded-md cursor-pointer transition-none ${String(selectedCustomerId) === String(customer.id) ? 'bg-link text-white border-slate-900 dark:border-slate-700 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <h3 className={`font-medium capitalize truncate mb-1 text-xs ${String(selectedCustomerId) === String(customer.id) ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{customer.name}</h3>
                    <p className={`text-[10px] font-medium capitalize ${String(selectedCustomerId) === String(customer.id) ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>Gst: {customer.gstin || 'Unregistered'}</p>
                    </div>
                ))}
                </div>
            </div>
            )}

            <div className={`flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex flex-col overflow-hidden ${isFullScreen ? 'fixed inset-4 z-[500] m-0 shadow-2xl' : ''} ${!selectedCustomerId ? 'hidden lg:flex' : 'flex'}`}>
            {selectedCustomer ? (
                <div className="flex flex-col h-full animate-in fade-in duration-300">
                <div className="px-4 sm:px-8 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center space-x-3 overflow-hidden">
                    <button onClick={() => setSelectedCustomerId(null)} className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0"><Contact className="w-5 h-5 text-slate-400 dark:text-slate-500" /></div>
                    <div className="truncate">
                        <h2 className="text-base sm:text-lg font-medium text-slate-900 dark:text-white capitalize leading-none truncate">{selectedCustomer.name}</h2>
                        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-tighter mt-1">Id: {selectedCustomer.id.split('-')[0]}</p>
                    </div>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                    <button onClick={() => setIsLedgerOpen(true)} className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
                        <Calculator className="w-4 h-4" />
                        <span className="hidden sm:inline">Ledgers</span>
                    </button>
                    <button ref={fullScreenBtnRef} onClick={() => setIsFullScreen(!isFullScreen)} className={`hidden sm:block p-2 text-slate-400 border border-slate-200 dark:border-slate-700 rounded hover:text-slate-900 dark:hover:text-white transition-none ${actionFocusIdx === 0 ? 'ring-2 ring-primary ring-offset-2 border-slate-900 dark:border-white' : ''}`}>{isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
                    <button ref={editBtnRef} onClick={() => { setEditingCustomer(selectedCustomer); setIsFormOpen(true); }} className={`p-2 text-slate-400 border border-slate-200 dark:border-slate-700 rounded hover:text-slate-900 dark:hover:text-white transition-none ${actionFocusIdx === 1 ? 'ring-2 ring-primary ring-offset-2 border-slate-900 dark:border-white' : ''}`}><Edit className="w-4 h-4" /></button>
                    <button ref={deleteBtnRef} onClick={() => setDeleteDialog({ isOpen: true, customer: selectedCustomer })} className={`p-2 text-slate-400 border border-slate-200 dark:border-slate-700 rounded hover:text-red-500 transition-none ${actionFocusIdx === 2 ? 'ring-2 ring-rose-500 ring-offset-2 border-rose-500' : ''}`}><Trash2 className="w-4 h-4" /></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-10">
                    <StatCard label="Total Receivable" value={formatCurrency(stats.balance)} colorClass="text-link" />
                    <StatCard label="Gross Sales" value={formatCurrency(stats.totalSales)} colorClass="text-slate-600" />
                    <StatCard label="Gst Aggregate" value={selectedCustomer.gstin || 'N/A'} colorClass="text-slate-400 text-sm" />
                    <StatCard label="Status" value="Active" colorClass="text-emerald-500" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-10">
                    <div className="space-y-4 bg-slate-50/50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-100 dark:border-slate-800">
                        <h4 className="text-[11px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center"><Phone className="w-3.5 h-3.5 mr-2" /> Communication</h4>
                        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
                            <p className="flex items-center"><Phone className="w-3.5 h-3.5 mr-2 opacity-30" /> {selectedCustomer.phone || 'N/A'}</p>
                            <p className="flex items-center"><Mail className="w-3.5 h-3.5 mr-2 opacity-30" /> {selectedCustomer.email || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="space-y-4 bg-slate-50/50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-100 dark:border-slate-800 md:col-span-2">
                        <h4 className="text-[11px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center"><MapPin className="w-3.5 h-3.5 mr-2" /> Office Address</h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{selectedCustomer.address || 'No registered address.'}</p>
                    </div>
                    </div>

                    <div className="space-y-4">
                    <div className="flex items-center justify-between"><h4 className="text-[11px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest flex items-center"><History className="w-4 h-4 mr-2 text-slate-300 dark:text-slate-600" /> Sales & Billing History</h4></div>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-x-auto bg-white dark:bg-slate-900 shadow-sm">
                        <table className="clean-table min-w-[600px]">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-medium text-slate-400 dark:text-slate-500 capitalize tracking-widest">
                                    <th className="font-medium capitalize">Date</th>
                                    <th className="font-medium capitalize">Invoice #</th>
                                    <th className="text-right font-medium capitalize">Taxable</th>
                                    <th className="text-right font-medium capitalize">Gst</th>
                                    <th className="text-right font-medium capitalize">Grand Total</th>
                                    <th className="text-center font-medium capitalize">Settlement</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.transactions.map((inv, idx) => (
                                    <tr key={inv.id} className={`transition-colors ${tableRowIdx === idx ? 'bg-slate-50/50 dark:bg-slate-800/50 border-l-4 border-link' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                        <td className="text-slate-500 dark:text-slate-400 font-medium">{formatDate(inv.date)}</td>
                                        <td className="font-mono font-medium text-slate-900 dark:text-white">{inv.bill_number}</td>
                                        <td className="text-right font-mono text-slate-500 dark:text-slate-400">{(inv.total_without_gst || 0).toFixed(2)}</td>
                                        <td className="text-right font-mono text-slate-500 dark:text-slate-400">{(inv.total_gst || 0).toFixed(2)}</td>
                                        <td className="text-right font-mono font-medium text-slate-900 dark:text-white">{(inv.grand_total || 0).toFixed(2)}</td>
                                        <td className="text-center"><span className={`text-[9px] font-medium px-3 py-0.5 rounded-full capitalize ${inv.status === 'Paid' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800'}`}>{inv.status}</span></td>
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
      )}
    </div>
  );
};

export default Customers;
