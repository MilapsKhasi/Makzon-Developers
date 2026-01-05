
import React, { useEffect, useState, useRef } from 'react';
import { Search, Loader2, ChevronDown, TrendingUp, TrendingDown, Wallet, Clock, Receipt } from 'lucide-react';
import { getActiveCompanyId, formatDate, normalizeBill } from '../utils/helpers';
import DateFilter, { DateFilterHandle } from '../components/DateFilter';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import SalesInvoiceForm from '../components/SalesInvoiceForm';
import ConfirmDialog from '../components/ConfirmDialog';
import { supabase } from '../lib/supabase';

const Dashboard = () => {
  const [stats, setStats] = useState({ 
    totalSales: 0,
    totalPurchases: 0, 
    payables: 0,
    receivables: 0,
    gstPaid: 0
  });
  const [recentVouchers, setRecentVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection / Shortcut states
  const [headerFocusIdx, setHeaderFocusIdx] = useState<number | null>(null);
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);
  const [lastShiftNTime, setLastShiftNTime] = useState<number>(0);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; voucher: any | null }>({
    isOpen: false,
    voucher: null
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dateFilterRef = useRef<DateFilterHandle>(null);
  const newSaleBtnRef = useRef<HTMLButtonElement>(null);
  const newPurchaseBtnRef = useRef<HTMLButtonElement>(null);

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase.from('bills').select('*').eq('company_id', cid).eq('is_deleted', false);
      if (dateRange.startDate && dateRange.endDate) {
        query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }
      const { data: vouchers, error } = await query;
      if (error) throw error;
      
      const normalizedVouchers = (vouchers || []).map(normalizeBill);
      
      const purchaseItems = normalizedVouchers.filter(v => v.type === 'Purchase');
      const salesItems = normalizedVouchers.filter(v => v.type === 'Sale');

      const totalSales = salesItems.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
      const totalPurchases = purchaseItems.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);
      const payables = purchaseItems.filter(v => v.status === 'Pending').reduce((acc, v) => acc + Number(v.grand_total || 0), 0);
      const receivables = salesItems.filter(v => v.status === 'Pending').reduce((acc, v) => acc + Number(v.grand_total || 0), 0);
      const gstPaid = purchaseItems.filter(v => v.status === 'Paid').reduce((acc, v) => acc + Number(v.total_gst || 0), 0);

      setStats({ totalSales, totalPurchases, payables, receivables, gstPaid });

      const combined = normalizedVouchers.map(b => ({ 
        ...b, 
        docNo: b.bill_number, 
        party: b.vendor_name,
        displayType: b.type
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setRecentVouchers(combined);
    } catch (err: any) {
      console.error("Dashboard load error:", err.message || err);
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

  const filteredVouchers = recentVouchers.filter(v => {
    const search = searchQuery.toLowerCase();
    return v.docNo?.toLowerCase().includes(search) || v.party?.toLowerCase().includes(search);
  }).slice(0, 10);

  // Focus effect for header elements
  useEffect(() => {
    if (headerFocusIdx === 0) dateFilterRef.current?.focusYear();
    if (headerFocusIdx === 1) dateFilterRef.current?.focusMonth();
    if (headerFocusIdx === 2) newSaleBtnRef.current?.focus();
    if (headerFocusIdx === 3) newPurchaseBtnRef.current?.focus();
  }, [headerFocusIdx]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      // If we are in the delete confirmation state, Esc should cancel
      if (deleteDialog.isOpen && e.key === 'Escape') {
        setDeleteDialog({ isOpen: false, voucher: null });
        return;
      }

      // Context Check: Are we in an input? (Unless it's our own search bar)
      const isFocusedInInput = (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT' || document.activeElement?.tagName === 'TEXTAREA') && document.activeElement !== searchInputRef.current;
      if (isFocusedInInput) return;

      // Table Navigation: Up/Down arrow keys move selection ONLY if a row is already selected
      if (selectedRowIdx !== null) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedRowIdx(prev => (prev === null ? 0 : Math.min(prev + 1, filteredVouchers.length - 1)));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedRowIdx(prev => (prev === null ? 0 : Math.max(prev - 1, 0)));
        }
      }

      if (e.shiftKey) {
        // Shift + N sequence detection
        if (e.key === 'N' || e.key === 'n') {
            setLastShiftNTime(Date.now());
        }
        
        // Shift + N + S sequence
        if ((e.key === 'S' || e.key === 's') && (Date.now() - lastShiftNTime < 1000)) {
            e.preventDefault();
            setEditingVoucher(null);
            setIsSalesModalOpen(true);
            setLastShiftNTime(0);
            return;
        }

        // Shift + Arrows: Header Navigation
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setHeaderFocusIdx(prev => (prev === null ? 0 : (prev + 1) % 4));
          setSelectedRowIdx(null);
        }
        else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setHeaderFocusIdx(prev => (prev === null ? 3 : (prev - 1 + 4) % 4));
          setSelectedRowIdx(null);
        }
        // Shift + Enter: Context Switch (Search -> Table)
        else if (e.key === 'Enter') {
          e.preventDefault();
          if (document.activeElement !== searchInputRef.current) {
            searchInputRef.current?.focus();
            setSelectedRowIdx(null);
            setHeaderFocusIdx(null);
          } else {
            if (filteredVouchers.length > 0) {
              setSelectedRowIdx(0);
              searchInputRef.current?.blur();
            }
          }
        }
        // Shift + E: Edit Entry
        else if (e.key === 'E' || e.key === 'e') {
          if (selectedRowIdx !== null && filteredVouchers[selectedRowIdx]) {
            e.preventDefault();
            const voucher = filteredVouchers[selectedRowIdx];
            setEditingVoucher(voucher);
            if (voucher.displayType === 'Sale') setIsSalesModalOpen(true);
            else setIsPurchaseModalOpen(true);
          }
        }
        // Shift + D: Delete Entry (Double Press Flow)
        else if (e.key === 'D' || e.key === 'd') {
          if (selectedRowIdx !== null && filteredVouchers[selectedRowIdx]) {
            e.preventDefault();
            const voucher = filteredVouchers[recentVouchers.indexOf(filteredVouchers[selectedRowIdx])];
            if (!deleteDialog.isOpen) {
              setDeleteDialog({ isOpen: true, voucher });
            } else {
              // If already open, confirm delete
              handleConfirmDelete();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [filteredVouchers, selectedRowIdx, deleteDialog, headerFocusIdx, lastShiftNTime]);

  const handleConfirmDelete = async () => {
    if (!deleteDialog.voucher) return;
    const { error } = await supabase.from('bills').update({ is_deleted: true }).eq('id', deleteDialog.voucher.id);
    if (!error) {
      loadData();
      window.dispatchEvent(new Event('appSettingsChanged'));
    }
    setDeleteDialog({ isOpen: false, voucher: null });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Modal isOpen={isPurchaseModalOpen} onClose={() => { setIsPurchaseModalOpen(false); setEditingVoucher(null); }} title={editingVoucher ? "Edit Purchase Bill" : "Register Purchase Bill"} maxWidth="max-w-6xl">
        <BillForm initialData={editingVoucher} onSubmit={() => { setIsPurchaseModalOpen(false); setEditingVoucher(null); loadData(); }} onCancel={() => { setIsPurchaseModalOpen(false); setEditingVoucher(null); }} />
      </Modal>

      <Modal isOpen={isSalesModalOpen} onClose={() => { setIsSalesModalOpen(false); setEditingVoucher(null); }} title={editingVoucher ? "Edit Sales Invoice" : "Generate Sales Invoice"} maxWidth="max-w-6xl">
        <SalesInvoiceForm initialData={editingVoucher} onSubmit={() => { setIsSalesModalOpen(false); setEditingVoucher(null); loadData(); }} onCancel={() => { setIsSalesModalOpen(false); setEditingVoucher(null); }} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen} 
        onClose={() => setDeleteDialog({ isOpen: false, voucher: null })} 
        onConfirm={handleConfirmDelete} 
        title="Archive Transaction" 
        message={`Delete ${deleteDialog.voucher?.displayType} ${deleteDialog.voucher?.docNo}? (Press Shift + D again to confirm, or Esc to cancel)`} 
      />

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-normal text-slate-900">Dashboard Overview</h1>
        <div className="flex items-center space-x-3">
          <DateFilter ref={dateFilterRef} onFilterChange={setDateRange} />
          <div className="flex space-x-2">
            <button 
                ref={newSaleBtnRef}
                onClick={() => setIsSalesModalOpen(true)}
                className={`px-6 py-2 rounded-md font-normal text-sm transition-none border-2 ${headerFocusIdx === 2 ? 'border-slate-900 ring-2 ring-link ring-offset-2' : 'border-transparent bg-link text-white hover:bg-link/90'}`}
            >
                NEW SALE
            </button>
            <button 
                ref={newPurchaseBtnRef}
                onClick={() => setIsPurchaseModalOpen(true)}
                className={`px-6 py-2 rounded-md font-normal text-sm transition-none border-2 ${headerFocusIdx === 3 ? 'border-slate-900 ring-2 ring-primary ring-offset-2' : 'border-transparent bg-primary text-slate-900 hover:bg-primary-dark'}`}
            >
                NEW PURCHASE
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'TOTAL SALES', value: stats.totalSales, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'TOTAL PURCHASES', value: stats.totalPurchases, icon: TrendingDown, color: 'text-rose-600' },
          { label: 'PAYABLES', value: stats.payables, icon: Clock, color: 'text-amber-600' },
          { label: 'RECEIVABLES', value: stats.receivables, icon: Wallet, color: 'text-link' },
          { label: 'GST PAID', value: stats.gstPaid, icon: Receipt, color: 'text-slate-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-md p-5 flex flex-col h-full justify-between">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{stat.label}</span>
                <stat.icon className={`w-4 h-4 ${stat.color} opacity-70`} />
            </div>
            <span className={`text-[22px] font-semibold leading-none font-mono ${stat.color}`}>
                {stat.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            ref={searchInputRef}
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recent entries (Bill #, Party)..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-primary shadow-sm"
          />
        </div>
        
        <h2 className="text-[16px] font-normal text-slate-900">Recent Transactions</h2>
        
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          <table className="clean-table">
            <thead>
              <tr>
                <th className="w-16">SR</th>
                <th>DATE</th>
                <th>TYPE</th>
                <th>VOUCHER #</th>
                <th>PARTY NAME</th>
                <th className="text-right">AMOUNT</th>
                <th className="text-center">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400 font-semibold tracking-widest text-[10px] uppercase">Loading register...</td></tr>
              ) : filteredVouchers.map((v, i) => (
                <tr 
                  key={v.id} 
                  className={`transition-colors cursor-pointer ${selectedRowIdx === i ? 'bg-slate-50 border-l-4 border-primary' : 'hover:bg-slate-50/50'}`}
                  onClick={() => setSelectedRowIdx(i)}
                >
                  <td>{i + 1}</td>
                  <td>{formatDate(v.date)}</td>
                  <td>
                    <span className={`text-[10px] font-bold uppercase ${v.displayType === 'Sale' ? 'text-link' : 'text-primary-dark'}`}>
                        {v.displayType}
                    </span>
                  </td>
                  <td className="font-mono">{v.docNo}</td>
                  <td className="uppercase font-medium text-slate-700">{v.party}</td>
                  <td className={`text-right font-mono font-bold ${v.displayType === 'Sale' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {(Number(v.grand_total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm uppercase ${v.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {v.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && filteredVouchers.length === 0 && (
                <tr><td colSpan={7} className="text-center py-20 text-slate-400 italic">No recent transactions recorded.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
