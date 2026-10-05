export interface Company {
  id: string;
  name: string;
  gstin?: string;
  address?: string;
  phone?: string;
  partner_company_id?: string;
  is_deleted?: boolean;
}

export interface Vendor {
  id: string;
  master_id?: string;
  company_id?: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  account_number?: string;
  account_name?: string;
  ifsc_code?: string;
  address?: string;
  balance: number;
  state?: string;
  party_type?: 'customer' | 'vendor' | 'both';
  is_customer?: boolean;
  is_deleted?: boolean;
  default_duties?: any[];
}

export interface Customer {
  id: string;
  master_id?: string;
  company_id?: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  account_number?: string;
  account_name?: string;
  ifsc_code?: string;
  address?: string;
  balance: number;
  state?: string;
  party_type?: 'customer' | 'vendor' | 'both';
  is_customer?: boolean;
  is_deleted?: boolean;
}

export interface StockItem {
  id: string;
  master_id?: string;
  name: string;
  sku?: string;
  unit: string;
  hsn?: string;
  rate: number;
  selling_price: number;
  in_stock: number;
  description?: string;
  tax_rate: number;
  kg_per_bag?: number;
  company_id: string;
  is_deleted: boolean;
}

export interface BillItem {
  id: string;
  item_id?: string;
  itemId?: string;
  stock_item_id?: string;
  itemName: string;
  hsnCode: string;
  qty: number;
  unit: string;
  rate: number;
  tax_rate: number;
  taxableAmount: number;
  amount: number;
  discount?: number;
  discount_type?: string;
  itemTotal?: number;
}

export interface Bill {
  id: string;
  company_id?: string;
  party_id?: string;
  vendor_id?: string;
  vendor_name: string;
  bill_number: string;
  date: string;
  gst_type: 'Intra-State' | 'Inter-State';
  items: BillItem[];
  items_raw?: any;
  total_without_gst: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_gst: number;
  grand_total: number;
  round_off: number;
  duties_and_taxes: any[];
  status: 'Pending' | 'Paid';
  is_deleted: boolean;
  description?: string;
}

export interface SalesInvoice {
  id: string;
  company_id?: string;
  party_id?: string;
  customer_id?: string;
  customer_name: string;
  invoice_number: string;
  date: string;
  gst_type: 'Intra-State' | 'Inter-State';
  items: BillItem[];
  items_raw?: any;
  total_without_gst: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_gst: number;
  grand_total: number;
  round_off: number;
  duties_and_taxes: any[];
  status: 'Pending' | 'Paid';
  is_deleted: boolean;
  description?: string;
}

export interface AdditionalDutyTax {
  id: string;
  master_id?: string;
  company_id?: string;
  name: string;
  type: 'Charge' | 'Deduction';
  calc_method: 'Percentage' | 'Fixed Amount';
  rate: number;
  fixed_amount: number;
  apply_on: 'Subtotal' | 'Net Total';
  applicable_to: 'Sales Invoices' | 'Purchase Bills' | 'Both';
  is_default: boolean;
  is_deleted: boolean;
  is_readonly?: boolean;
}
