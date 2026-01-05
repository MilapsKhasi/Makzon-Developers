
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Edit, Trash2, Plus } from 'lucide-react';
import { formatDate, getActiveCompanyId, normalizeBill } from '../utils/helpers';
import Modal from '../components/Modal';
import SalesInvoiceForm from '../components/SalesInvoiceForm';
import ConfirmDialog from '../components/ConfirmDialog';
import DateFilter, { DateFilterHandle } from '../components/DateFilter';
import { supabase } from '../lib/supabase';

const Sales = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  
  // Navigation & Shortcut states
  const [headerFocusIdx, setHeaderFocusIdx] = useState<number | null>(0); // Default to first dropdown
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [lastShiftNTime, setLastShiftNTime] = useState<number>(0);

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; invoice: any | null }>({
    isOpen: false,
    invoice: null
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dateFilterRef = useRef<DateFilterHandle>(null);
  const newSaleBtnRef = useRef<HTMLButtonElement>(null);

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;
    
    try {
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
        .filter(i => i.type === 'Sale');

      setInvoices(normalizedData);
    } catch (err: any) {
      console.error("Error loading sales:", err.message || err);
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

  const filtered = invoices.filter(i => {
    const search = searchQuery.toLowerCase();
    return i.bill_number?.toLowerCase().includes(search) || i.vendor_name?.toLowerCase().includes(search);
  });

  // Handle header cycle focus
  useEffect(() => {
    if (headerFocusIdx === 0) dateFilterRef.current?.focusYear();
    if (headerFocusIdx === 1) dateFilterRef.current?.focusMonth();
    if (headerFocusIdx === 2) newSaleBtnRef.current?.focus();
  }, [headerFocusIdx]);

  const confirmDelete = async () => {
    if (!deleteDialog.invoice) return;
    const { error } = await supabase.from('bills').update({ is_deleted: true }).eq('id', deleteDialog.invoice.id);
    if (!error) {
        loadData();
        window.dispatchEvent(new Event('appSettingsChanged'));
    }
    setDeleteDialog({ isOpen: false, invoice: null });
  };

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      // 1. ESC Handling (Cancel current context)
      if (e.key === 'Escape') {
        if (deleteDialog.isOpen) {
          e.preventDefault();
          setDeleteDialog({ isOpen: false, invoice: null });
        } else if (isModalOpen) {
          e.preventDefault();
          setIsModalOpen(false);
          setEditingInvoice(null);
        } else if (selectedRowIdx !== null) {
          setSelectedRowIdx(null);
        }
        return;
      }

      // Context Check: Are we in a sub-input or form?
      const activeEl = document.activeElement;
      const isFocusedInInput = (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'SELECT') && activeEl !== searchInputRef.current;
      if (isFocusedInInput || isModalOpen) return;

      // 2. Table Navigation (ArrowUp/Down) - Only if row is highlighted
      if (selectedRowIdx !== null) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedRowIdx(prev => (prev === null ? 0 : Math.min(prev + 1, filtered.length - 1)));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedRowIdx(prev => (prev === null ? 0 : Math.max(prev - 1, 0)));
        }
      }

      // 3. Shift Key Combinations
      if (e.shiftKey) {
        // Shift + N + S flow
        if (e.key === 'N' || e.key === 'n') {
          setLastShiftNTime(Date.now());
        }
        if ((e.key === 'S' || e.key === 's') && (Date.now() - lastShiftNTime < 1000)) {
          e.preventDefault();
          setEditingInvoice(null);
          setIsModalOpen(true);
          setLastShiftNTime(0);
          return;
        }

        // Shift + Arrows: Header cycle
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setHeaderFocusIdx(prev => (prev === null ? 0 : (prev + 1) % 3));
          setSelectedRowIdx(null);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setHeaderFocusIdx(prev => (prev === null ? 2 : (prev - 1 + 3) % 3));
          setSelectedRowIdx(null);
        } 
        // Shift + Enter: Context Switching
        else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeEl !== searchInputRef.current) {
            searchInputRef.current?.focus();
            setSelectedRowIdx(null);
            setHeaderFocusIdx(null);
          } else {
            if (filtered.length > 0) {
              setSelectedRowIdx(0);
              searchInputRef.current?.blur();
            }
          }
        } 
        // Shift + E: Edit Selected
        else if (e.key === 'E' || e.key === 'e') {
          if (selectedRowIdx !== null && filtered[selectedRowIdx]) {
            e.preventDefault();
            setEditingInvoice(filtered[selectedRowIdx]);
            setIsModalOpen(true);
          }
        } 
        // Shift + D: Delete Selected
        else if (e.key === 'D' || e.key === 'd') {
          if (selectedRowIdx !== null && filtered[selectedRowIdx]) {
            e.preventDefault();
            const inv = filtered[selectedRowIdx];
            if (!deleteDialog.isOpen) {
              setDeleteDialog({ isOpen: true, invoice: inv });
            } else {
              confirmDelete();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [filtered, selectedRowIdx, deleteDialog, headerFocusIdx, isModalOpen, lastShiftNTime]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingInvoice(null); }} title={editingInvoice ? "Update Sale Invoice" : "Generate Sale Invoice"} maxWidth="max-w-6xl">
        <SalesInvoiceForm initialData={editingInvoice} onSubmit={() => { setIsModalOpen(false); setEditingInvoice(null); loadData(); }} onCancel={() => { setIsModalOpen(false); setEditingInvoice(null); }} />
      </Modal>

      <ConfirmDialog 
        isOpen={deleteDialog.isOpen} 
        onClose={() => setDeleteDialog({ isOpen: false, invoice: null })} 
        onConfirm={confirmDelete} 
        title="Delete Invoice" 
        message={`Permanently archive sale invoice ${deleteDialog.invoice?.bill_number}? (Press Shift + D again to confirm, or Esc to cancel)`} 
      />

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-normal text-slate-900">Sales Ledger</h1>
        <div className="flex items-center space-x-2">
          <DateFilter ref={dateFilterRef} onFilterChange={setDateRange} />
          <button 
            ref={newSaleBtnRef}
            onClick={() => { setEditingInvoice(null); setIsModalOpen(true); }}
            className={`px-8 py-2 rounded-md font-normal text-sm transition-none uppercase border-2 ${headerFocusIdx === 2 ? 'border-slate-900 ring-2 ring-link ring-offset-2' : 'border-transparent bg-link text-white hover:bg-link/90'}`}
          >
            <Plus className="w-4 h-4 mr-2 inline" /> New Sale
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
            ref={searchInputRef}
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
                <tr 
                    key={inv.id} 
                    className={`transition-colors cursor-pointer ${selectedRowIdx === i ? 'bg-slate-50 border-l-4 border-link' : 'hover:bg-slate-50/50'}`}
                    onClick={() => setSelectedRowIdx(i)}
                >
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
                        <button onClick={(e) => { e.stopPropagation(); setEditingInvoice(inv); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-all"><Edit className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteDialog({ isOpen: true, invoice: inv }); }} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"><Trash2 className="w-4 h-4" /></button>
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
