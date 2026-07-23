import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ShoppingCart, ArrowDownCircle, ArrowUpCircle, 
  Users, UserPlus, Package, FolderPlus, Building, 
  BookOpen, Percent, Crown, Plus, X, Lock, ShieldAlert
} from 'lucide-react';
import Modal from './Modal';
import SalesInvoiceForm from './SalesInvoiceForm';
import BillForm from './BillForm';
import PaymentVoucherModal from './PaymentVoucherModal';
import PartyForm from './PartyForm';
import StockForm from './StockForm';

interface CreateNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateNewModal: React.FC<CreateNewModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  // Active sub-form or premium modal
  const [activeView, setActiveView] = useState<
    'list' | 'sales_invoice' | 'purchase_bill' | 'receive_payment' | 'make_payment' | 'customer' | 'vendor' | 'stock_item' | 'premium_notice'
  >('list');

  const [premiumNotice, setPremiumNotice] = useState<{ title: string; edition: string }>({
    title: '',
    edition: ''
  });

  const handleSelectOption = (type: string) => {
    switch (type) {
      case 'sales_invoice':
        setActiveView('sales_invoice');
        break;
      case 'purchase_bill':
        setActiveView('purchase_bill');
        break;
      case 'receive_payment':
        setActiveView('receive_payment');
        break;
      case 'make_payment':
        setActiveView('make_payment');
        break;
      case 'customer':
        setActiveView('customer');
        break;
      case 'vendor':
        setActiveView('vendor');
        break;
      case 'stock_item':
        setActiveView('stock_item');
        break;
      case 'delivery_challan':
        setPremiumNotice({
          title: 'Delivery Challan',
          edition: 'Standard & Advanced Edition'
        });
        setActiveView('premium_notice');
        break;
      case 'purchase_order':
        setPremiumNotice({
          title: 'Purchase Order',
          edition: 'Standard & Advanced Edition'
        });
        setActiveView('premium_notice');
        break;
      case 'stock_group':
        setPremiumNotice({
          title: 'Stock Group',
          edition: 'Standard Edition'
        });
        setActiveView('premium_notice');
        break;
      case 'stock_godown':
        setPremiumNotice({
          title: 'Stock Godown',
          edition: 'Standard Edition'
        });
        setActiveView('premium_notice');
        break;
      case 'cashbook':
        onClose();
        navigate('/cashbook');
        break;
      case 'additional_charges':
        onClose();
        navigate('/charges');
        break;
      default:
        break;
    }
  };

  const resetAll = () => {
    setActiveView('list');
    onClose();
  };

  const handleFormSuccess = () => {
    window.dispatchEvent(new Event('appSettingsChanged'));
    resetAll();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 1. Main Grouped Selection Modal */}
      {activeView === 'list' && (
        <Modal isOpen={isOpen} onClose={resetAll} title="Create New" maxWidth="max-w-2xl">
          <div className="p-5 space-y-5">
            {/* Sales Group */}
            <div>
              <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Sales
                </span>
                <span className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectOption('sales_invoice')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Sales Invoice</h4>
                      <p className="text-[10px] text-slate-400">Create & issue bill to customer</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOption('receive_payment')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      <ArrowDownCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Receive Payment</h4>
                      <p className="text-[10px] text-slate-400">Record money received</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOption('customer')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Customer</h4>
                      <p className="text-[10px] text-slate-400">Add new customer party</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOption('delivery_challan')}
                  className="flex items-center justify-between p-3 rounded-lg border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Delivery Challan</h4>
                        <span className="text-[10px]">👑</span>
                      </div>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Standard & Advanced Edition</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Purchase Group */}
            <div>
              <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  Purchase
                </span>
                <span className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectOption('purchase_bill')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-indigo-100/60 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Purchase Bill</h4>
                      <p className="text-[10px] text-slate-400">Record vendor purchase bill</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOption('make_payment')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-indigo-100/60 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      <ArrowUpCircle className="w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Make Payment</h4>
                      <p className="text-[10px] text-slate-400">Record payment to vendor</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOption('vendor')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-indigo-100/60 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Vendor</h4>
                      <p className="text-[10px] text-slate-400">Add new vendor party</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOption('purchase_order')}
                  className="flex items-center justify-between p-3 rounded-lg border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Purchase Order</h4>
                        <span className="text-[10px]">👑</span>
                      </div>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Standard & Advanced Edition</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Stock Group */}
            <div>
              <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                  Stock
                </span>
                <span className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectOption('stock_item')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-sky-100/60 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400">Stock Item</h4>
                      <p className="text-[10px] text-slate-400">Add new stock SKU or service</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOption('stock_group')}
                  className="flex items-center justify-between p-3 rounded-lg border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Stock Group</h4>
                        <span className="text-[10px]">👑</span>
                      </div>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Standard Edition</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOption('stock_godown')}
                  className="flex items-center justify-between p-3 rounded-lg border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Stock Godown</h4>
                        <span className="text-[10px]">👑</span>
                      </div>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Standard Edition</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Others Group */}
            <div>
              <div className="flex items-center space-x-2 pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Others
                </span>
                <span className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectOption('cashbook')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-slate-400 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">Cashbook</h4>
                      <p className="text-[10px] text-slate-400">Open cashbook ledger sheet</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOption('additional_charges')}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:border-slate-400 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">Additional Charges</h4>
                      <p className="text-[10px] text-slate-400">Manage charges & discounts</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Sub-Modals for creation */}
      {activeView === 'sales_invoice' && (
        <Modal isOpen={true} onClose={resetAll} title="New Sales Invoice" maxWidth="max-w-4xl">
          <SalesInvoiceForm
            onSubmit={(inv, shouldPrint, isSaveAndNew) => {
              if (!isSaveAndNew) resetAll();
              else window.dispatchEvent(new Event('appSettingsChanged'));
            }}
            onCancel={resetAll}
          />
        </Modal>
      )}

      {activeView === 'purchase_bill' && (
        <Modal isOpen={true} onClose={resetAll} title="New Purchase Bill" maxWidth="max-w-4xl">
          <BillForm
            onSubmit={(bill, isSaveAndNew) => {
              if (!isSaveAndNew) resetAll();
              else window.dispatchEvent(new Event('appSettingsChanged'));
            }}
            onCancel={resetAll}
          />
        </Modal>
      )}

      {(activeView === 'receive_payment' || activeView === 'make_payment') && (
        <PaymentVoucherModal
          isOpen={true}
          onClose={resetAll}
          initialType={activeView === 'receive_payment' ? 'Receipt' : 'Payment'}
          onSuccess={() => {
            window.dispatchEvent(new Event('appSettingsChanged'));
          }}
        />
      )}

      {(activeView === 'customer' || activeView === 'vendor') && (
        <Modal
          isOpen={true}
          onClose={resetAll}
          title={activeView === 'customer' ? 'Register New Customer' : 'Register New Vendor'}
          maxWidth="max-w-2xl"
        >
          <PartyForm
            defaultType={activeView}
            onSubmit={(party, isSaveAndNew) => {
              window.dispatchEvent(new Event('appSettingsChanged'));
              if (!isSaveAndNew) resetAll();
            }}
            onCancel={resetAll}
          />
        </Modal>
      )}

      {activeView === 'stock_item' && (
        <Modal isOpen={true} onClose={resetAll} title="Add New Stock Item" maxWidth="max-w-2xl">
          <StockForm
            onSubmit={(item, isSaveAndNew) => {
              window.dispatchEvent(new Event('appSettingsChanged'));
              if (!isSaveAndNew) resetAll();
            }}
            onCancel={resetAll}
          />
        </Modal>
      )}

      {/* 3. Premium Feature Lock Modal */}
      {activeView === 'premium_notice' && (
        <Modal isOpen={true} onClose={() => setActiveView('list')} title="Premium Feature" maxWidth="max-w-md">
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {premiumNotice.title} 👑
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                This feature is available in <span className="font-bold text-amber-600 dark:text-amber-400">{premiumNotice.edition}</span>.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 text-left text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
              <div className="flex items-center space-x-2 font-semibold text-slate-900 dark:text-white">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Upgrade Workspace Edition</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Unlock multi-warehouse godown management, stock grouping, delivery challans, and purchase orders seamlessly.
              </p>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Back to List
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default CreateNewModal;
