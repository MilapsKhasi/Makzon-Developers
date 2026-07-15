import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, Trash2, Plus, Wallet, CreditCard, ArrowDownCircle, ArrowUpCircle, Calendar, FileText } from 'lucide-react';
import { formatDate, getActiveCompanyId, normalizeBill, safeSupabaseSave, syncTransactionToCashbook, formatCurrency, unsyncTransactionFromCashbook } from '../utils/helpers';
import Modal from '../components/Modal';
import DateFilter, { DateFilterHandle } from '../components/DateFilter';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';

interface Voucher {
  id: string;
  date: string;
  voucher_no: string;
  type: 'Receipt' | 'Payment';
  party_name: string;
  account: string;
  amount: number;
  description: string;
  raw: any;
}

const Payments = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; voucher: Voucher | null }>({ isOpen: false, voucher: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ startDate: string | null, endDate: string | null }>({ startDate: null, endDate: null });

  // Form states
  const [voucherType, setVoucherType] = useState<'Receipt' | 'Payment'>('Receipt');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [account, setAccount] = useState<string>('Cash');
  const [partyName, setPartyName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Dropdown options
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  const [partyBills, setPartyBills] = useState<any[]>([]);
  const [selectedBillIds, setSelectedBillIds] = useState<string[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const dateFilterRef = useRef<DateFilterHandle>(null);

  useEffect(() => {
    const fetchPartyBills = async () => {
      if (!partyName) {
        setPartyBills([]);
        setSelectedBillIds([]);
        return;
      }

      setLoadingBills(true);
      try {
        const cid = getActiveCompanyId();
        if (!cid) return;
        const table = voucherType === 'Receipt' ? 'sales_invoices' : 'purchase_bills';
        
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('company_id', cid)
          .eq('is_deleted', false);
        
        if (error) throw error;

        // Filter out standalone payment/receipt vouchers and match the selected party name
        const bills = (data || []).filter(item => {
          const isVoucher = item.items && (item.items as any).is_payment_voucher === true;
          const nameMatch = voucherType === 'Receipt' 
            ? item.customer_name === partyName 
            : item.vendor_name === partyName;
          return !isVoucher && nameMatch;
        });

        setPartyBills(bills);
        setSelectedBillIds([]);
      } catch (err) {
        console.error("Error fetching party bills:", err);
      } finally {
        setLoadingBills(false);
      }
    };

    fetchPartyBills();
  }, [partyName, voucherType]);

  const handleBillToggle = (billId: string) => {
    setSelectedBillIds(prev => {
      const next = prev.includes(billId) 
        ? prev.filter(id => id !== billId) 
        : [...prev, billId];
      
      const total = partyBills
        .filter(b => next.includes(b.id))
        .reduce((sum, b) => sum + (Number(b.grand_total) || 0), 0);
      
      setAmount(total > 0 ? total.toFixed(2) : '');
      return next;
    });
  };

  const alreadyPaidBillIds = useMemo(() => {
    return vouchers
      .filter(v => v.type === voucherType)
      .flatMap(v => v.raw?.items?.linked_bills || []);
  }, [vouchers, voucherType]);

  const totalOutstanding = useMemo(() => {
    return partyBills
      .filter(b => !alreadyPaidBillIds.includes(b.id))
      .reduce((sum, b) => sum + (Number(b.grand_total) || 0), 0);
  }, [partyBills, alreadyPaidBillIds]);

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Receipts (from sales_invoices where is_payment_voucher = true)
      let receiptsQuery = supabase
        .from('sales_invoices')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);

      if (dateRange.startDate && dateRange.endDate) {
        receiptsQuery = receiptsQuery.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }

      const { data: receiptsData } = await receiptsQuery;

      const receipts = (receiptsData || [])
        .filter(item => item.items && (item.items as any).is_payment_voucher === true)
        .map(item => {
          const norm = normalizeBill(item);
          const pDetails = norm?.items_raw?.payment_details;
          const pArray = Array.isArray(pDetails) ? pDetails : (pDetails ? [pDetails] : []);
          const firstPayment = pArray[0] || {};
          return {
            id: item.id,
            date: item.date,
            voucher_no: item.invoice_number,
            type: 'Receipt' as const,
            party_name: item.customer_name,
            account: firstPayment.payment_method || 'Cash',
            amount: Number(firstPayment.payment_amount) || 0,
            description: item.description || '',
            raw: item
          };
        });

      // 2. Fetch Payments (from purchase_bills where is_payment_voucher = true)
      let paymentsQuery = supabase
        .from('purchase_bills')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);

      if (dateRange.startDate && dateRange.endDate) {
        paymentsQuery = paymentsQuery.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }

      const { data: paymentsData } = await paymentsQuery;

      const payments = (paymentsData || [])
        .filter(item => item.items && (item.items as any).is_payment_voucher === true)
        .map(item => {
          const norm = normalizeBill(item);
          const pDetails = norm?.items_raw?.payment_details;
          const pArray = Array.isArray(pDetails) ? pDetails : (pDetails ? [pDetails] : []);
          const firstPayment = pArray[0] || {};
          return {
            id: item.id,
            date: item.date,
            voucher_no: item.bill_number,
            type: 'Payment' as const,
            party_name: item.vendor_name,
            account: firstPayment.payment_method || 'Cash',
            amount: Number(firstPayment.payment_amount) || 0,
            description: item.description || '',
            raw: item
          };
        });

      // Combine and sort by date descending
      const combined = [...receipts, ...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setVouchers(combined);

      // 3. Load Customers & Vendors
      const { data: custs } = await supabase.from('customers').select('*').eq('company_id', cid).eq('is_deleted', false).order('name');
      const { data: vends } = await supabase.from('vendors').select('*').eq('company_id', cid).eq('is_deleted', false).order('name');

      setCustomers(custs || []);
      setVendors(vends || []);
    } catch (err: any) {
      console.error("Error loading payment vouchers:", err.message || err);
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

  const resetForm = () => {
    setVoucherType('Receipt');
    setDate(new Date().toISOString().split('T')[0]);
    setAccount('Cash');
    setPartyName('');
    setAmount('');
    setDescription('');
    setPartyBills([]);
    setSelectedBillIds([]);
  };

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName) return alert("Please select a Party Name.");
    if (!account.trim()) return alert("Please specify an Account.");
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return alert("Amount must be greater than 0.");

    setSaving(true);
    const cid = getActiveCompanyId();
    try {
      const isReceipt = voucherType === 'Receipt';
      const table = isReceipt ? 'sales_invoices' : 'purchase_bills';

      // Auto-generate voucher number (Tally style, e.g. REC-2607-0001)
      const count = vouchers.filter(v => v.type === voucherType).length + 1;
      const formattedSeq = count.toString().padStart(4, '0');
      const dateParts = date.split('-');
      const yymm = `${dateParts[0].substring(2)}${dateParts[1]}`;
      const generatedNo = isReceipt ? `REC-${yymm}-${formattedSeq}` : `PAY-${yymm}-${formattedSeq}`;

      const paymentDetails = [{
        payment_amount: parsedAmount,
        payment_date: date,
        payment_method: account.trim()
      }];

      const selectedBills = partyBills.filter(b => selectedBillIds.includes(b.id));
      const refText = selectedBills.length > 0 
        ? ` (Ref: ${selectedBills.map(b => b.invoice_number || b.bill_number).join(', ')})`
        : '';
      const finalDesc = (description.trim() || `${voucherType} Voucher`) + refText;

      const payload: any = {
        company_id: cid,
        date: date,
        total_without_gst: 0,
        total_gst: 0,
        grand_total: 0,
        status: 'Paid',
        is_deleted: false,
        description: finalDesc,
        items: {
          line_items: [],
          is_payment_voucher: true,
          payment_details: paymentDetails,
          linked_bills: selectedBillIds
        }
      };

      if (isReceipt) {
        payload.customer_name = partyName;
        payload.invoice_number = generatedNo;
      } else {
        payload.vendor_name = partyName;
        payload.bill_number = generatedNo;
      }

      const res = await safeSupabaseSave(table, payload);

      if (res && res.data && res.data[0]) {
        await syncTransactionToCashbook(res.data[0]);
      }

      window.dispatchEvent(new Event('appSettingsChanged'));
      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert("Error saving voucher: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVoucher = (voucher: Voucher) => {
    setDeleteDialog({ isOpen: true, voucher });
  };

  const confirmDelete = async () => {
    const voucher = deleteDialog.voucher;
    if (!voucher) return;

    setLoading(true);
    try {
      const table = voucher.type === 'Receipt' ? 'sales_invoices' : 'purchase_bills';
      const { error } = await supabase.from(table).update({ is_deleted: true }).eq('id', voucher.id);
      if (error) throw error;

      if (voucher.raw) {
        await unsyncTransactionFromCashbook(voucher.raw);
      }

      // Dispatch event to force update of cashbooks/ledgers
      window.dispatchEvent(new Event('appSettingsChanged'));
      loadData();
    } catch (err: any) {
      console.error("Error deleting voucher:", err);
    } finally {
      setLoading(false);
      setDeleteDialog({ isOpen: false, voucher: null });
    }
  };

  const filteredVouchers = vouchers.filter(v => {
    const search = searchQuery.toLowerCase();
    return (
      v.party_name?.toLowerCase().includes(search) ||
      v.voucher_no?.toLowerCase().includes(search) ||
      v.account?.toLowerCase().includes(search) ||
      v.description?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[20px] font-medium text-slate-900 dark:text-white capitalize">Payments & Receipts</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">Record and manage standalone double-entry ledger transactions</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="w-full sm:w-auto bg-primary text-white px-5 py-2.5 rounded-md font-medium text-sm hover:bg-primary-dark flex items-center justify-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> New Voucher
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-xs shrink-0">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search party, voucher no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <DateFilter ref={dateFilterRef} onFilterChange={setDateRange} />
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredVouchers.length === 0 ? (
          <EmptyState
            title="No Vouchers Found"
            message={searchQuery ? "No payments or receipts match your filter criteria." : "Create standalone payments or receipts just like Tally Prime to settle outstanding balances."}
          />
        ) : (
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Voucher No</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Account (Bank/Cash)</th>
                  <th className="py-3.5 px-4">Party Name</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4">Narration</th>
                  <th className="py-3.5 px-4 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[12px] text-slate-700 dark:text-slate-300">
                {filteredVouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono">{formatDate(voucher.date)}</td>
                    <td className="py-3 px-4 font-semibold">{voucher.voucher_no}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${voucher.type === 'Receipt' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'}`}>
                        {voucher.type === 'Receipt' ? (
                          <ArrowDownCircle className="w-3 h-3 mr-1 shrink-0" />
                        ) : (
                          <ArrowUpCircle className="w-3 h-3 mr-1 shrink-0" />
                        )}
                        {voucher.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize">{voucher.account}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{voucher.party_name}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(voucher.amount)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={voucher.description}>
                      {voucher.description}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteVoucher(voucher)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                        title="Delete Voucher"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Payment & Receipt Voucher Entry"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveVoucher} className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-2">Voucher Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setVoucherType('Receipt'); setPartyName(''); }}
                className={`py-2.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-center ${voucherType === 'Receipt' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                <ArrowDownCircle className="w-4 h-4 mr-2" /> Receipt (Receive Money)
              </button>
              <button
                type="button"
                onClick={() => { setVoucherType('Payment'); setPartyName(''); }}
                className={`py-2.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-center ${voucherType === 'Payment' ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-500 text-rose-700 dark:text-rose-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                <ArrowUpCircle className="w-4 h-4 mr-2" /> Payment (Pay Money)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg outline-none text-xs focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Account (Bank / Cash)</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Kotak Bank, SBI, Cash"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg outline-none text-xs focus:ring-2 focus:ring-primary/20 transition-all"
                  list="accounts-suggestions"
                />
                <datalist id="accounts-suggestions">
                  <option value="Cash" />
                  <option value="Kotak Bank" />
                  <option value="State Bank of India" />
                  <option value="HDFC Bank" />
                  <option value="ICICI Bank" />
                  <option value="Bank of Baroda" />
                </datalist>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                {voucherType === 'Receipt' ? 'Customer Name (Party)' : 'Vendor Name (Party)'}
              </label>
              <select
                required
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg outline-none text-xs focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="">Select Party</option>
                {voucherType === 'Receipt' ? (
                  customers.map(c => <option key={c.id} value={c.name}>{c.name} {c.balance ? `(Bal: ${formatCurrency(c.balance)})` : ''}</option>)
                ) : (
                  vendors.map(v => <option key={v.id} value={v.name}>{v.name} {v.balance ? `(Bal: ${formatCurrency(v.balance)})` : ''}</option>)
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg outline-none text-xs focus:ring-2 focus:ring-primary/20 transition-all font-mono font-bold"
              />
            </div>
          </div>

          {partyName && (
            <div className="border border-slate-100 dark:border-slate-800 rounded-lg p-3.5 bg-slate-50/50 dark:bg-slate-900/50 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {voucherType === 'Receipt' ? 'Pending Sales Invoices' : 'Pending Purchase Bills'}
                </span>
                <div className="flex items-center space-x-2 text-[10px] font-bold">
                  <span className="text-slate-500 dark:text-slate-400">
                    Outstanding: <span className="font-mono text-red-500 dark:text-red-400 font-bold">{formatCurrency(totalOutstanding)}</span>
                  </span>
                  {selectedBillIds.length > 0 && (
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {selectedBillIds.length} Selected
                    </span>
                  )}
                </div>
              </div>
              
              {loadingBills ? (
                <div className="py-4 flex items-center justify-center text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mr-2 text-primary" /> Loading bills...
                </div>
              ) : partyBills.length === 0 ? (
                <div className="py-2 text-center text-xs text-slate-400 italic">
                  No previous bills found for this party.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800">
                  {partyBills.map((b) => {
                    const isAlreadyPaid = alreadyPaidBillIds.includes(b.id);
                    const isChecked = isAlreadyPaid || selectedBillIds.includes(b.id);
                    const billNo = b.invoice_number || b.bill_number;
                    return (
                      <label 
                        key={b.id} 
                        className={`flex items-center justify-between py-2 px-2.5 rounded-md text-[11px] transition-colors ${
                          isAlreadyPaid 
                            ? 'opacity-65 bg-slate-100/50 dark:bg-slate-800/20 cursor-not-allowed' 
                            : isChecked 
                              ? 'bg-primary/5 dark:bg-primary/10 cursor-pointer' 
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            disabled={isAlreadyPaid}
                            onChange={() => !isAlreadyPaid && handleBillToggle(b.id)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary dark:bg-slate-800 dark:border-slate-700 disabled:opacity-75 disabled:text-emerald-600"
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-semibold text-slate-900 dark:text-white font-mono">{billNo}</span>
                              {isAlreadyPaid && (
                                <span className="px-1.5 py-0.5 text-[8px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded">
                                  Paid
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400">{formatDate(b.date)}</span>
                          </div>
                        </div>
                        <span className="font-bold font-mono text-slate-950 dark:text-white">
                          {formatCurrency(Number(b.grand_total) || 0)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Narration / Description</label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <textarea
                placeholder="Enter transaction remarks..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg outline-none text-xs focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark text-xs flex items-center shadow-sm disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />} Save Entry
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, voucher: null })}
        onConfirm={confirmDelete}
        title={`Delete ${deleteDialog.voucher?.type || 'Voucher'}`}
        message={`Are you sure you want to permanently delete this ${deleteDialog.voucher?.type || 'voucher'}? This action is irreversible.`}
      />
    </div>
  );
};

export default Payments;
