
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
}

export interface StockItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  rate: number;
  hsn: string;
  in_stock?: number;
}

export interface BillItem {
  id: string;
  itemName: string;
  hsnCode: string;
  qty: number;
  unit: string;
  rate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  taxableAmount: number;
  amount: number;
}

export interface Bill {
  id: string;
  vendor_name: string;
  bill_number: string;
  date: string;
  items: BillItem[];
  total_without_gst: number;
  total_gst: number;
  grand_total: number;
  status: 'Pending' | 'Paid';
  is_deleted: boolean;
}