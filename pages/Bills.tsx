
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Edit, Trash2 } from 'lucide-react';
import { formatDate, getActiveCompanyId, normalizeBill } from '../utils/helpers';
import Modal from '../components/Modal';
import BillForm from '../components/BillForm';
import ConfirmDialog from '../components/ConfirmDialog';
import DateFilter, { DateFilterHandle } from '../components/DateFilter';
import ExportModal from '../components/ExportModal';
import { supabase } from '../lib/supabase';

const Bills = () => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: null, endDate: null });
  
  // Selection states
  const [headerFocusIdx, setHeaderFocusIdx] = useState<number | null>(0); // Default to first dropdown
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [lastShiftNTime, setLastShiftNTime] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dateFilterRef = useRef<DateFilterHandle>(null);
  const newEntryBtnRef = useRef<HTMLButtonElement>(null);

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
        .filter(b => b.type === 'Purchase');
        
      setBills(normalizedData);
    } catch (err: any) {
      console.error("Error loading bills:", err.message || err);
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

  // Sync Focus for header cycle
  useEffect(() => {
    if (headerFocusIdx === 0) dateFilterRef.current?.focusYear();
    if (headerFocusIdx === 1) dateFilterRef.current?.focusMonth();
    if (headerFocusIdx === 2) newEntryBtnRef.current?.focus();
  }, [headerFocusIdx]);

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      // Escape Logic
      if (e.key === 'Escape') {
        if (deleteDialog.isOpen) {
          e.preventDefault();
          setDeleteDialog({ isOpen: false, bill: null });
        } else if (isModalOpen) {
          e.preventDefault();
          setIsModalOpen(false);
          setEditingBill(null);
        } else if (isExportModalOpen) {
          e.preventDefault();
          setIsExportModalOpen(false);
        } else if (selectedRowIdx !== null) {
          setSelectedRowIdx(null);
        }
        return;
      }

      const activeEl = document.activeElement;
      const isFocusedInInput = (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'SELECT') && activeEl !== searchInputRef.current;
      if (isFocusedInInput || isModalOpen || isExportModalOpen) return;

      // Table Navigation
      if (selectedRowIdx !== null) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedRowIdx(prev => Math.min((prev || 0) + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedRowIdx(prev => Math.max((prev || 0) - 1, 0));
        }
      }

      if (e.shiftKey) {
        // Sequences
        if (e.key === 'N' || e.key === 'n') setLastShiftNTime(Date.now());
        if ((e.key === 'P' || e.key === 'p') && (Date.now() - lastShiftNTime < 1000)) {
            e.preventDefault(); setEditingBill(null); setIsModalOpen(true); setLastShiftNTime(0); return;
        }

        // Shift + X: Export
        if (e.key === 'X' || e.key === 'x') {
            e.preventDefault(); setIsExportModalOpen(true); return;
        }

        // Header Navigation
        if (e.key === 'ArrowRight') {
            e.preventDefault(); setHeaderFocusIdx(prev => (prev === null ? 0 : (prev + 1) % 3)); setSelectedRowIdx(null);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault(); setHeaderFocusIdx(prev => (prev === null ? 2 : (prev - 1 + 3) % 3)); setSelectedRowIdx(null);
        }

        // Context Switch: Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            if (activeEl !== searchInputRef.current) {
                searchInputRef.current?.focus();
                setSelectedRowIdx(null); setHeaderFocusIdx(null);
            } else {
                if (filtered.length > 0) {
                    setSelectedRowIdx(0); searchInputRef.current?.blur();
                }
            }
        }

        // Row Actions
        if (selectedRowIdx !== null && filtered[selectedRowIdx]) {
            if (e.key === 'E' || e.key === 'e') {
                e.preventDefault(); setEditingBill(filtered[selectedRowIdx]); setIsModalOpen(true);
            } else if (e.key === 'D' || e.key === 'd') {
                e.preventDefault();
                if (!deleteDialog.isOpen) setDeleteDialog({ isOpen: true, bill: filtered[selectedRowIdx] });
                else confirmDelete();
            }
        }
      }
    };

    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [bills, selectedRowIdx, headerFocusIdx, isModalOpen, isExportModalOpen, deleteDialog, lastShiftNTime]);

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
    return b.bill_number?.toLowerCase().includes(search) || b.vendor_name?.toLowerCase().includes(search);
  });

  const totalPurchase = filtered.reduce((acc, b) => acc + Number(b.grand_total || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBill ? "Edit Purchase Bill" : "Register Purchase Bill"} maxWidth="max-w-6xl">
        <BillForm initialData={editingBill} onSubmit={() => { setIsModalOpen(false); loadData(); }} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onExport={() => {}} reportName="Purchase Bills Ledger" />

      <ConfirmDialog isOpen={deleteDialog.isOpen} onClose={() => setDeleteDialog({ isOpen: false, bill: null })} onConfirm={confirmDelete} title="Archive Bill" message={`Are you sure you want to delete bill ${deleteDialog.bill?.bill_number}? (Press Shift + D again to confirm)`} />

      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-normal text-slate-900">Bills Ledger</h1>
        <div className="flex items-center space-x-2">
          <DateFilter ref={dateFilterRef} onFilterChange={setDateRange} />
          <button 
            ref={newEntryBtnRef}
            onClick={() => { setEditingBill(null); setIsModalOpen(true); }}
            className={`bg-primary text-slate-900 px-6 py-2 rounded-md font-normal text-sm transition-none uppercase border-2 ${headerFocusIdx === 2 ? 'border-slate-900 ring-2 ring-primary ring-offset-2' : 'border-transparent hover:bg-primary-dark'}`}
          >
            NEW ENTRY
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-md p-5 inline-block min-w-[200px]">
        <span className="text-[11px] text-slate-500 font-normal uppercase tracking-tight mb-1 block">TOTAL PURCHASE</span>
        <span className="text-[24px] font-normal text-slate-900 leading-none">{totalPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input 
            ref={searchInputRef}
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything (Shift + Enter to focus)..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-md text-xs outline-none focus:border-slate-300"
          />
        </div>
        
        <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
          <table className="clean-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                <th className="w-16">SR NO</th>
                <th>DATE</th>
                <th>BILL NO</th>
                <th>VENDOR</th>
                <th className="text-right">WITHOUT GST</th>
                <th className="text-right">GST</th>
                <th className="text-right">WITH GST</th>
                <th className="text-center">STATUS</th>
                <th className="text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-20 text-slate-400 font-semibold uppercase tracking-widest text-[10px]">Loading register...</td></tr>
              ) : filtered.map((b, i) => (
                <tr 
                    key={b.id} 
                    className={`transition-colors cursor-pointer ${selectedRowIdx === i ? 'bg-slate-50 border-l-4 border-primary' : 'hover:bg-slate-50/50'}`}
                    onClick={() => setSelectedRowIdx(i)}
                >
                  <td>{i + 1}</td>
                  <td>{formatDate(b.date)}</td>
                  <td className="font-mono font-bold text-slate-900">{b.bill_number}</td>
                  <td className="uppercase font-medium text-slate-700">{b.vendor_name}</td>
                  <td className="text-right font-mono text-slate-500">{(Number(b.total_without_gst) || 0).toFixed(2)}</td>
                  <td className="text-right font-mono text-slate-500">{(Number(b.total_gst) || 0).toFixed(2)}</td>
                  <td className="text-right font-mono font-bold text-slate-900">{(Number(b.grand_total) || 0).toFixed(2)}</td>
                  <td className="text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm uppercase ${b.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center space-x-2">
                        <button onClick={(e) => { e.stopPropagation(); setEditingBill(b); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-all"><Edit className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteDialog({ isOpen: true, bill: b }); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center py-20 text-slate-300 italic font-medium">No purchase bills found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Bills;
