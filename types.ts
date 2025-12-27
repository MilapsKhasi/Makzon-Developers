
export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  gstin: string;
  pan?: string;
  account_number?: string;
  account_name?: string;
  ifsc_code?: string;
  address: string;
  balance: number;
  state?: string;
  default_duties?: any[]; // For sticky charges feature
}

export interface StockItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  rate: number;
  hsn: string;
  in_stock?: number;
  tax_rate?: number; // GST Rate from Master
}

export interface BillItem {
  id: string;
  itemName: string;
  hsnCode: string;
  qty: number;
  unit: string;
  rate: number;
  tax_rate: number; // Single GST rate %
  taxableAmount: number;
  amount: number; // Inclusive Amount
}

export interface Bill {
  id: string;
  vendor_name: string;
  bill_number: string;
  date: string;
  gst_type: 'Intra-State' | 'Inter-State'; // Tally-style transaction type
  items: BillItem[];
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
