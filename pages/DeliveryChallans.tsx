import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Plus, Printer, Edit, Trash2, Truck, Calendar, FileText } from 'lucide-react';
import { formatDate, getActiveCompanyId, normalizeBill } from '../utils/helpers';
import Modal from '../components/Modal';
import DeliveryChallanForm from '../components/DeliveryChallanForm';
import ConfirmDialog from '../components/ConfirmDialog';
import DateFilter, { DateFilterHandle } from '../components/DateFilter';
import EmptyState from '../components/EmptyState';
import { supabase } from '../lib/supabase';
import { InvoicePrintModal } from '../components/InvoicePrintModal';

export const DeliveryChallans = () => {
  const location = useLocation();
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChallan, setEditingChallan] = useState<any | null>(null);
  const [printModalChallan, setPrintModalChallan] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null
  });

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; challan: any | null }>({
    isOpen: false,
    challan: null
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dateFilterRef = useRef<DateFilterHandle>(null);

  const loadData = async () => {
    setLoading(true);
    const cid = getActiveCompanyId();
    if (!cid) return;

    try {
      let query = supabase
        .from('sales_invoices')
        .select('*')
        .eq('company_id', cid)
        .eq('is_deleted', false);

      if (dateRange.startDate && dateRange.endDate) {
        query = query.gte('date', dateRange.startDate).lte('date', dateRange.endDate);
      }

      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;

      // Filter to only include delivery challans (by items_raw.is_delivery_challan or invoice_number starting with DC-)
      const dcData = (data || [])
        .map(normalizeBill)
        .filter((b: any) => b && (b.items_raw?.is_delivery_challan === true || b.invoice_number?.startsWith('DC-')));

      setChallans(dcData);
    } catch (err: any) {
      console.error('Error loading delivery challans:', err.message || err);
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

  // Open modal if state contains flag or selected item
  useEffect(() => {
    if (location.state?.createNew) {
      setEditingChallan(null);
      setIsModalOpen(true);
    }
  }, [location.state]);

  const filtered = challans.filter(c => {
    const search = searchQuery.toLowerCase();
    const customer = c.customer_name?.toLowerCase() || '';
    const num = c.invoice_number?.toLowerCase() || c.bill_number?.toLowerCase() || '';
    const veh = c.items_raw?.vehicle_no?.toLowerCase() || '';
    return customer.includes(search) || num.includes(search) || veh.includes(search);
  });

  const confirmDelete = async () => {
    if (!deleteDialog.challan) return;
    const { error } = await supabase
      .from('sales_invoices')
      .update({ is_deleted: true })
      .eq('id', deleteDialog.challan.id);

    if (!error) {
      loadData();
      window.dispatchEvent(new Event('appSettingsChanged'));
    }
    setDeleteDialog({ isOpen: false, challan: null });
  };

  const totalDispatchedValue = filtered.reduce(
    (acc, c) => acc + Number(c.grand_total || c.total_without_gst || 0),
    0
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Creation / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingChallan(null);
        }}
        title={editingChallan ? 'Update Delivery Challan' : 'New Delivery Challan'}
        maxWidth="max-w-5xl"
      >
        <DeliveryChallanForm
          initialData={editingChallan}
          onSubmit={(challan, shouldPrint) => {
            setIsModalOpen(false);
            setEditingChallan(null);
            loadData();
            if (shouldPrint && challan) {
              setPrintModalChallan(challan);
            }
          }}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingChallan(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, challan: null })}
        onConfirm={confirmDelete}
        title="Delete Delivery Challan"
        message={`Are you sure you want to delete delivery challan ${deleteDialog.challan?.invoice_number}?`}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-medium text-slate-900 dark:text-white capitalize flex items-center space-x-2">
            <Truck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Delivery Challan Ledger</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage goods transport, dispatch notes, and delivery challans
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <DateFilter ref={dateFilterRef} onFilterChange={setDateRange} />
          <button
            onClick={() => {
              setEditingChallan(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-2 rounded-md font-medium text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center justify-center space-x-1.5 w-full sm:w-auto shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New Delivery Challan</span>
          </button>
        </div>
      </div>

      {!loading && challans.length === 0 ? (
        <EmptyState
          title="No Delivery Challans"
          message="Issue delivery challans to track goods dispatched to customers before invoicing."
          actionLabel="Create Delivery Challan"
          onAction={() => {
            setEditingChallan(null);
            setIsModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium capitalize block mb-1">
                Total Delivery Challans
              </span>
              <span className="text-[24px] font-bold text-slate-900 dark:text-white font-mono">
                {filtered.length}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium capitalize block mb-1">
                Total Dispatched Goods Value
              </span>
              <span className="text-[24px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{totalDispatchedValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Search Bar & Table */}
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by challan number, customer name, or vehicle number..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
              />
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs overflow-x-auto">
              <table className="clean-table min-w-[850px] w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="w-12 text-center py-3">Sr</th>
                    <th className="py-3">Date</th>
                    <th className="py-3">Challan #</th>
                    <th className="py-3">Customer Name</th>
                    <th className="py-3">Vehicle / Transport</th>
                    <th className="text-right py-3">Subtotal</th>
                    <th className="text-right py-3">Total Value</th>
                    <th className="text-center py-3">Status</th>
                    <th className="text-center py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-slate-400 font-medium text-xs">
                        Loading delivery challans...
                      </td>
                    </tr>
                  ) : filtered.map((c, i) => {
                      const veh = c.items_raw?.vehicle_no || '—';
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <td className="text-center text-slate-400">{i + 1}</td>
                          <td className="text-slate-600 dark:text-slate-300 font-medium">
                            {formatDate(c.date)}
                          </td>
                          <td className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {c.invoice_number || c.bill_number}
                          </td>
                          <td className="font-semibold text-slate-900 dark:text-white">
                            {c.customer_name || c.vendor_name}
                          </td>
                          <td className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                            {veh}
                          </td>
                          <td className="text-right font-mono text-slate-600 dark:text-slate-400">
                            ₹{(Number(c.total_without_gst) || 0).toFixed(2)}
                          </td>
                          <td className="text-right font-mono font-bold text-slate-900 dark:text-white">
                            ₹{(Number(c.grand_total) || 0).toFixed(2)}
                          </td>
                          <td className="text-center">
                            <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              {c.status || 'Dispatched'}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                onClick={() => setPrintModalChallan(c)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition-all"
                                title="Print Delivery Challan"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingChallan(c);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all"
                                title="Edit Challan"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteDialog({ isOpen: true, challan: c })}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-all"
                                title="Delete Challan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-slate-400 italic font-medium text-xs">
                        No delivery challans found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Print Modal */}
      <InvoicePrintModal
        isOpen={!!printModalChallan}
        onClose={() => setPrintModalChallan(null)}
        invoice={printModalChallan}
      />
    </div>
  );
};

export default DeliveryChallans;
