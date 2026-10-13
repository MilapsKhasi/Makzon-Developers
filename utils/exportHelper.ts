import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { formatDate, toDisplayValue } from './helpers';

export interface ExportConfig {
    companyName: string;
    gstin: string;
    email: string;
    phone: string;
    address: string;
    reportTitle: string;
    dateRange: string;
}

export interface ComprehensiveExportData {
    companyName: string;
    gstin?: string;
    address?: string;
    customers: any[];
    vendors: any[];
    parties: any[];
    stockItems: any[];
    salesInvoices: any[];
    purchaseBills: any[];
    cashbooks: any[];
    dutiesTaxes: any[];
}

export const triggerBrowserDownload = (buffer: ArrayBuffer | Uint8Array, filename: string) => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([buffer as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    }
};

export const getExcelColumnLetter = (colIndex: number): string => {
    let temp: number;
    let letter = '';
    while (colIndex > 0) {
        temp = (colIndex - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        colIndex = Math.floor((colIndex - temp - 1) / 26);
    }
    return letter || 'A';
};

const isCurrencyHeader = (h: string): boolean => 
    /(amount|total|balance|rate|price|debit|credit|tax|gst|cgst|sgst|igst|cess|subtotal|discount|val|grand)/i.test(h);

const isQuantityHeader = (h: string): boolean => 
    /(qty|quantity|stock|in stock|count|nos|pcs|boxes|pieces)/i.test(h);

const isDateHeader = (h: string): boolean => 
    /(date|dated|created|due date|invoice date)/i.test(h);

/**
 * Professional presentation report export with ExcelJS v4.4.0:
 * - High-level visual hierarchy: Company name banner, GSTIN/contact details, report title and period
 * - Corporate slate/indigo header styling with auto-filters and frozen top panes
 * - Currency, numeric and date formatting with sensible alignment
 * - Sensible column widths and row heights
 * - Zebra row striping and accounting total rows
 */
export const exportToExcel = async (
    headers: string[], 
    rows: any[][], 
    config: ExportConfig
): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = config.companyName || 'ZenterPrime';
    workbook.created = new Date();
    workbook.properties.date1904 = false;

    const sheetTitle = (config.reportTitle.slice(0, 31) || 'Report').replace(/[*?:/\\\[\]]/g, '_');
    const worksheet = workbook.addWorksheet(sheetTitle, {
        views: [{ state: 'frozen', ySplit: 5, activeCell: 'A6', showGridLines: true }],
        pageSetup: {
            orientation: headers.length > 5 ? 'landscape' : 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            paperSize: 9
        }
    });

    const totalCols = Math.max(headers.length, 1);
    const lastColLetter = getExcelColumnLetter(totalCols);

    // 1. Company Name Header (Row 1)
    const companyRow = worksheet.addRow([config.companyName ? config.companyName.toUpperCase() : 'ZENTERPRIME']);
    companyRow.height = 30;
    companyRow.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0F172A' } };
    companyRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    companyRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' } // Slate-100 banner
    };
    if (totalCols > 1) {
        worksheet.mergeCells(`A1:${lastColLetter}1`);
    }

    // 2. GSTIN & Address Subtitle (Row 2)
    const subParts = [
        config.gstin ? `GSTIN: ${config.gstin}` : '',
        config.phone ? `Phone: ${config.phone}` : '',
        config.email ? `Email: ${config.email}` : '',
        config.address ? `Address: ${config.address}` : ''
    ].filter(Boolean);
    const subText = subParts.length > 0 ? subParts.join('   |   ') : 'Company Financial Statement';
    
    const subRow = worksheet.addRow([subText]);
    subRow.height = 20;
    subRow.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF475569' } };
    subRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    subRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' } // Slate-50 banner
    };
    if (totalCols > 1) {
        worksheet.mergeCells(`A2:${lastColLetter}2`);
    }

    // 3. Report Title & Period Card (Row 3)
    const reportText = `REPORT: ${(config.reportTitle || 'STATEMENT').toUpperCase()}   |   PERIOD: ${config.dateRange || 'All Time'}`;
    const repRow = worksheet.addRow([reportText]);
    repRow.height = 24;
    repRow.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E3A8A' } }; // Blue-900
    repRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    repRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFF6FF' } // Blue-50 soft card
    };
    if (totalCols > 1) {
        worksheet.mergeCells(`A3:${lastColLetter}3`);
    }

    // 4. Spacer Row (Row 4)
    const spacerRow = worksheet.addRow([]);
    spacerRow.height = 10;

    // 5. Table Header Row (Row 5)
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 26;
    headerRow.eachCell((cell, colNumber) => {
        const headerName = headers[colNumber - 1] || '';
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' } // Dark Slate-800
        };
        const alignH = isCurrencyHeader(headerName) ? 'right' : (isDateHeader(headerName) ? 'center' : 'left');
        cell.alignment = { vertical: 'middle', horizontal: alignH, indent: alignH === 'left' ? 1 : 0 };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF475569' } },
            left: { style: 'thin', color: { argb: 'FF475569' } },
            bottom: { style: 'thin', color: { argb: 'FF475569' } },
            right: { style: 'thin', color: { argb: 'FF475569' } }
        };
    });

    // Auto-filter on column headers (Row 5)
    worksheet.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: 5, column: totalCols }
    };

    // 6. Data Rows (Row 6 onwards)
    rows.forEach((row, rowIndex) => {
        const dataRow = worksheet.addRow(row);
        dataRow.height = 21;
        const isOdd = rowIndex % 2 === 1;

        // Detect if this is an accounting total/summary row
        const firstColVal = String(row[0] || '').toUpperCase();
        const secondColVal = String(row[1] || '').toUpperCase();
        const isTotalRow = firstColVal.includes('TOTAL') || firstColVal.includes('CLOSING') || 
                           secondColVal.includes('TOTAL') || firstColVal === 'NET';

        dataRow.eachCell((cell, colNumber) => {
            const headerName = headers[colNumber - 1] || '';
            const rawVal = row[colNumber - 1];

            if (isTotalRow) {
                cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF1F5F9' } // Slate-100 total row
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'double', color: { argb: 'FF0F172A' } }, // Classic double underline for totals
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            } else {
                cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
                if (isOdd) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF8FAFC' } // Slate-50 zebra stripe
                    };
                }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            }

            // Type conversion & number formatting
            if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
                if (isCurrencyHeader(headerName)) {
                    const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
                    if (!isNaN(num)) {
                        cell.value = num;
                        cell.numFmt = '#,##0.00';
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                } else if (isQuantityHeader(headerName)) {
                    const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
                    if (!isNaN(num)) {
                        cell.value = num;
                        cell.numFmt = '#,##0';
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                } else if (isDateHeader(headerName)) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (typeof rawVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawVal)) {
                        cell.value = rawVal.split('T')[0];
                    }
                } else if (typeof rawVal === 'number') {
                    cell.value = rawVal;
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                }
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
        });
    });

    // Auto-fit column widths (minimum 13, maximum 45)
    worksheet.columns.forEach((column, colIdx) => {
        const headerName = headers[colIdx] || '';
        let maxLen = headerName.length;
        rows.forEach(r => {
            const v = r[colIdx];
            if (v !== null && v !== undefined) {
                const str = String(v);
                if (str.length > maxLen) maxLen = str.length;
            }
        });
        column.width = Math.min(Math.max(maxLen + 4, 13), 45);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const downloadFileName = `${config.reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    triggerBrowserDownload(buffer, downloadFileName);
};

/**
 * Helper to build an import-compatible worksheet in ExcelJS:
 * - Row 1 is STRICTLY the machine-readable column headers (no decorative metadata rows above Row 1)
 * - Row 1 is styled with professional bold text, dark slate fill, auto-filter and frozen top pane
 * - Preserves Record IDs, relationships and numeric precision for 100% round-trip re-import
 */
const buildImportCompatibleSheet = (
    workbook: ExcelJS.Workbook,
    sheetName: string,
    headers: string[],
    rows: any[][]
) => {
    const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2', showGridLines: true }]
    });

    // Row 1: Machine-readable Header
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 25;
    headerRow.eachCell((cell, colNumber) => {
        const headerName = headers[colNumber - 1] || '';
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' } // Slate-800
        };
        const alignH = isCurrencyHeader(headerName) ? 'right' : (isDateHeader(headerName) ? 'center' : 'left');
        cell.alignment = { vertical: 'middle', horizontal: alignH, indent: alignH === 'left' ? 1 : 0 };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF475569' } },
            left: { style: 'thin', color: { argb: 'FF475569' } },
            bottom: { style: 'thin', color: { argb: 'FF475569' } },
            right: { style: 'thin', color: { argb: 'FF475569' } }
        };
    });

    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: Math.max(headers.length, 1) }
    };

    // Data Rows
    rows.forEach((row, rowIndex) => {
        const dataRow = worksheet.addRow(row);
        dataRow.height = 20;
        const isOdd = rowIndex % 2 === 1;

        dataRow.eachCell((cell, colNumber) => {
            const headerName = headers[colNumber - 1] || '';
            const rawVal = row[colNumber - 1];

            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
            if (isOdd) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8FAFC' }
                };
            }
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            // Formatting
            if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
                if (isCurrencyHeader(headerName)) {
                    const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
                    if (!isNaN(num)) {
                        cell.value = num;
                        cell.numFmt = '#,##0.00';
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                } else if (isQuantityHeader(headerName)) {
                    const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
                    if (!isNaN(num)) {
                        cell.value = num;
                        cell.numFmt = '#,##0';
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    }
                } else if (isDateHeader(headerName)) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                }
            } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
        });
    });

    // Auto-fit column widths
    worksheet.columns.forEach((column, colIdx) => {
        const headerName = headers[colIdx] || '';
        let maxLen = headerName.length;
        rows.forEach(r => {
            const v = r[colIdx];
            if (v !== null && v !== undefined) {
                const str = String(v);
                if (str.length > maxLen) maxLen = str.length;
            }
        });
        column.width = Math.min(Math.max(maxLen + 4, 13), 45);
    });
};

/**
 * Builds and downloads a multi-sheet, fully compatible Excel workbook
 * containing: Parties, Customers, Vendors, Stock Items, Sales Invoices,
 * Purchase Bills, Cashbooks, and Duties & Taxes.
 * Preserves Record IDs and line item structures for 100% round-trip re-import
 * while delivering executive styling via ExcelJS v4.4.0.
 */
export const exportComprehensiveWorkbook = async (
    data: ComprehensiveExportData, 
    filename: string
): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = data.companyName || 'ZenterPrime';
    workbook.created = new Date();

    // 1. Parties Sheet (Unified)
    const partiesHeaders = [
        'Record ID', 'Party Name', 'Party Type', 'GSTIN', 'Phone Number', 
        'Email', 'State', 'Address', 'PAN', 'Opening Balance', 
        'Bank Account', 'IFSC Code', 'Bank Name'
    ];
    const partiesRows = data.parties.map(p => [
        p.id || '',
        p.name || '',
        p.party_type === 'both' ? 'Both' : (p.party_type === 'customer' || p.is_customer ? 'Customer' : 'Vendor'),
        p.gstin || '',
        p.phone || '',
        p.email || '',
        p.state || '',
        p.address || '',
        p.pan || '',
        Number(p.balance) || 0,
        p.account_number || '',
        p.ifsc_code || '',
        p.account_name || ''
    ]);
    buildImportCompatibleSheet(
        workbook, 
        'Parties', 
        partiesHeaders, 
        partiesRows.length > 0 ? partiesRows : [['', '', 'Customer', '', '', '', '', '', '', 0, '', '', '']]
    );

    // 2. Customers Sheet
    const custHeaders = [
        'Record ID', 'Customer Name', 'GSTIN', 'Phone Number', 'Email', 
        'State', 'Address', 'PAN', 'Opening Balance', 'Bank Account', 
        'IFSC Code', 'Bank Name'
    ];
    const custRows = data.customers.map(c => [
        c.id || '',
        c.name || '',
        c.gstin || '',
        c.phone || '',
        c.email || '',
        c.state || '',
        c.address || '',
        c.pan || '',
        Number(c.balance) || 0,
        c.account_number || '',
        c.ifsc_code || '',
        c.account_name || ''
    ]);
    buildImportCompatibleSheet(
        workbook, 
        'Customers', 
        custHeaders, 
        custRows.length > 0 ? custRows : [['', '', '', '', '', '', '', '', 0, '', '', '']]
    );

    // 3. Vendors Sheet
    const vendHeaders = [
        'Record ID', 'Vendor Name', 'GSTIN', 'Phone Number', 'Email', 
        'State', 'Address', 'PAN', 'Opening Balance', 'Bank Account', 
        'IFSC Code', 'Bank Name'
    ];
    const vendRows = data.vendors.map(v => [
        v.id || '',
        v.name || '',
        v.gstin || '',
        v.phone || '',
        v.email || '',
        v.state || '',
        v.address || '',
        v.pan || '',
        Number(v.balance) || 0,
        v.account_number || '',
        v.ifsc_code || '',
        v.account_name || ''
    ]);
    buildImportCompatibleSheet(
        workbook, 
        'Vendors', 
        vendHeaders, 
        vendRows.length > 0 ? vendRows : [['', '', '', '', '', '', '', '', 0, '', '', '']]
    );

    // 4. Stock Items Sheet
    const itemHeaders = [
        'Record ID', 'Item Name', 'HSN / SAC', 'SKU', 'Unit', 
        'Category', 'Purchase Rate', 'Selling Price', 'Opening Stock', 
        'Tax Rate (%)', 'Description'
    ];
    const itemRows = data.stockItems.map(item => [
        item.id || '',
        item.name || '',
        item.hsn || '',
        item.sku || '',
        item.unit || 'PCS',
        item.category || 'General',
        Number(item.rate) || 0,
        Number(item.selling_price) || 0,
        Number(item.in_stock) || 0,
        Number(item.tax_rate) || 18,
        item.description || ''
    ]);
    buildImportCompatibleSheet(
        workbook, 
        'Stock Items', 
        itemHeaders, 
        itemRows.length > 0 ? itemRows : [['', '', '', '', 'PCS', 'General', 0, 0, 0, 18, '']]
    );

    // 5. Sales Invoices Sheet
    const invHeaders = [
        'Record ID', 'Invoice Number', 'Date', 'Customer Name', 'Subtotal', 
        'Total GST', 'Round Off', 'Grand Total', 'Status', 'Description', 
        'Line Items JSON'
    ];
    const invoiceRows = data.salesInvoices.map(inv => {
        let itemsJsonStr = '';
        if (inv.items) {
            try { itemsJsonStr = typeof inv.items === 'string' ? inv.items : JSON.stringify(inv.items); } catch (_) {}
        }
        return [
            inv.id || '',
            inv.invoice_number || '',
            inv.date || '',
            inv.customer_name || '',
            Number(inv.total_without_gst) || 0,
            Number(inv.total_gst) || 0,
            Number(inv.round_off) || 0,
            Number(inv.grand_total) || 0,
            inv.status || 'Pending',
            inv.description || '',
            itemsJsonStr
        ];
    });
    buildImportCompatibleSheet(
        workbook, 
        'Sales Invoices', 
        invHeaders, 
        invoiceRows.length > 0 ? invoiceRows : [['', '', '', '', 0, 0, 0, 0, 'Pending', '', '']]
    );

    // 6. Purchase Bills Sheet
    const billHeaders = [
        'Record ID', 'Bill Number', 'Date', 'Vendor Name', 'Subtotal', 
        'Total GST', 'Round Off', 'Grand Total', 'Status', 'Description', 
        'Line Items JSON'
    ];
    const billRows = data.purchaseBills.map(bill => {
        let itemsJsonStr = '';
        if (bill.items) {
            try { itemsJsonStr = typeof bill.items === 'string' ? bill.items : JSON.stringify(bill.items); } catch (_) {}
        }
        return [
            bill.id || '',
            bill.bill_number || '',
            bill.date || '',
            bill.vendor_name || '',
            Number(bill.total_without_gst) || 0,
            Number(bill.total_gst) || 0,
            Number(bill.round_off) || 0,
            Number(bill.grand_total) || 0,
            bill.status || 'Pending',
            bill.description || '',
            itemsJsonStr
        ];
    });
    buildImportCompatibleSheet(
        workbook, 
        'Purchase Bills', 
        billHeaders, 
        billRows.length > 0 ? billRows : [['', '', '', '', 0, 0, 0, 0, 'Pending', '', '']]
    );

    // 7. Cashbooks Sheet
    const cbHeaders = [
        'Record ID', 'Date', 'Income Total', 'Expense Total', 'Net Balance', 'Entries JSON'
    ];
    const cashbookRows = data.cashbooks.map(cb => {
        let rawJsonStr = '';
        if (cb.raw_data) {
            try { rawJsonStr = typeof cb.raw_data === 'string' ? cb.raw_data : JSON.stringify(cb.raw_data); } catch (_) {}
        }
        return [
            cb.id || '',
            cb.date || '',
            Number(cb.income_total) || 0,
            Number(cb.expense_total) || 0,
            Number(cb.balance) || 0,
            rawJsonStr
        ];
    });
    buildImportCompatibleSheet(
        workbook, 
        'Cashbooks', 
        cbHeaders, 
        cashbookRows.length > 0 ? cashbookRows : [['', '', 0, 0, 0, '']]
    );

    // 8. Duties & Taxes Sheet
    const taxHeaders = [
        'Record ID', 'Tax Name', 'Type', 'Calculation Method', 
        'Rate (%)', 'Fixed Amount', 'Apply On', 'Applicable To', 'Is Default'
    ];
    const taxRows = data.dutiesTaxes.map(tax => [
        tax.id || '',
        tax.name || '',
        tax.type || 'Charge',
        tax.calc_method || 'Percentage',
        Number(tax.rate) || 0,
        Number(tax.fixed_amount) || 0,
        tax.apply_on || 'Subtotal',
        tax.applicable_to || 'Both',
        tax.is_default ? 'Yes' : 'No'
    ]);
    buildImportCompatibleSheet(
        workbook, 
        'Duties & Taxes', 
        taxHeaders, 
        taxRows.length > 0 ? taxRows : [['', '', 'Charge', 'Percentage', 0, 0, 'Subtotal', 'Both', 'No']]
    );

    const buffer = await workbook.xlsx.writeBuffer();
    triggerBrowserDownload(buffer, filename);
};

/**
 * Builds CSV string from headers and object rows
 */
export const buildCsvString = (headers: string[], rows: any[]): string => {
    const lines = [headers.join(',')];
    rows.forEach(row => {
        const line = headers.map(h => {
            const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
            return `"${val.replace(/"/g, '""')}"`;
        });
        lines.push(line.join(','));
    });
    return lines.join('\n');
};

/**
 * Bundles all entity CSV files into a single ZIP archive to prevent
 * popup blocking and ensure atomic download.
 */
export const exportZipOfCsvFiles = async (data: ComprehensiveExportData, zipFilename: string) => {
    const zip = new JSZip();

    // 1. Parties CSV
    const partiesHeaders = ['Record ID', 'Party Name', 'Party Type', 'GSTIN', 'Phone Number', 'Email', 'State', 'Address', 'PAN', 'Opening Balance', 'Bank Account', 'IFSC Code', 'Bank Name'];
    const partiesRows = data.parties.map(p => ({
        'Record ID': p.id || '',
        'Party Name': p.name || '',
        'Party Type': p.party_type === 'both' ? 'Both' : (p.party_type === 'customer' || p.is_customer ? 'Customer' : 'Vendor'),
        'GSTIN': p.gstin || '',
        'Phone Number': p.phone || '',
        'Email': p.email || '',
        'State': p.state || '',
        'Address': p.address || '',
        'PAN': p.pan || '',
        'Opening Balance': p.balance || 0,
        'Bank Account': p.account_number || '',
        'IFSC Code': p.ifsc_code || '',
        'Bank Name': p.account_name || ''
    }));
    zip.file('parties.csv', buildCsvString(partiesHeaders, partiesRows));

    // 2. Customers CSV
    const custHeaders = ['Record ID', 'Customer Name', 'GSTIN', 'Phone Number', 'Email', 'State', 'Address', 'PAN', 'Opening Balance', 'Bank Account', 'IFSC Code', 'Bank Name'];
    const custRows = data.customers.map(c => ({
        'Record ID': c.id || '',
        'Customer Name': c.name || '',
        'GSTIN': c.gstin || '',
        'Phone Number': c.phone || '',
        'Email': c.email || '',
        'State': c.state || '',
        'Address': c.address || '',
        'PAN': c.pan || '',
        'Opening Balance': c.balance || 0,
        'Bank Account': c.account_number || '',
        'IFSC Code': c.ifsc_code || '',
        'Bank Name': c.account_name || ''
    }));
    zip.file('customers.csv', buildCsvString(custHeaders, custRows));

    // 3. Vendors CSV
    const vendHeaders = ['Record ID', 'Vendor Name', 'GSTIN', 'Phone Number', 'Email', 'State', 'Address', 'PAN', 'Opening Balance', 'Bank Account', 'IFSC Code', 'Bank Name'];
    const vendRows = data.vendors.map(v => ({
        'Record ID': v.id || '',
        'Vendor Name': v.name || '',
        'GSTIN': v.gstin || '',
        'Phone Number': v.phone || '',
        'Email': v.email || '',
        'State': v.state || '',
        'Address': v.address || '',
        'PAN': v.pan || '',
        'Opening Balance': v.balance || 0,
        'Bank Account': v.account_number || '',
        'IFSC Code': v.ifsc_code || '',
        'Bank Name': v.account_name || ''
    }));
    zip.file('vendors.csv', buildCsvString(vendHeaders, vendRows));

    // 4. Stock Items CSV
    const stockHeaders = ['Record ID', 'Item Name', 'HSN / SAC', 'SKU', 'Unit', 'Category', 'Purchase Rate', 'Selling Price', 'Opening Stock', 'Tax Rate (%)', 'Description'];
    const stockRows = data.stockItems.map(i => ({
        'Record ID': i.id || '',
        'Item Name': i.name || '',
        'HSN / SAC': i.hsn || '',
        'SKU': i.sku || '',
        'Unit': i.unit || 'PCS',
        'Category': i.category || 'General',
        'Purchase Rate': i.rate || 0,
        'Selling Price': i.selling_price || 0,
        'Opening Stock': i.in_stock || 0,
        'Tax Rate (%)': i.tax_rate ?? 18,
        'Description': i.description || ''
    }));
    zip.file('stock_items.csv', buildCsvString(stockHeaders, stockRows));

    // 5. Sales Invoices CSV
    const invHeaders = ['Record ID', 'Invoice Number', 'Date', 'Customer Name', 'Subtotal', 'Total GST', 'Round Off', 'Grand Total', 'Status', 'Description', 'Line Items JSON'];
    const invRows = data.salesInvoices.map(inv => ({
        'Record ID': inv.id || '',
        'Invoice Number': inv.invoice_number || '',
        'Date': inv.date || '',
        'Customer Name': inv.customer_name || '',
        'Subtotal': inv.total_without_gst || 0,
        'Total GST': inv.total_gst || 0,
        'Round Off': inv.round_off || 0,
        'Grand Total': inv.grand_total || 0,
        'Status': inv.status || 'Pending',
        'Description': inv.description || '',
        'Line Items JSON': typeof inv.items === 'string' ? inv.items : JSON.stringify(inv.items || [])
    }));
    zip.file('sales_invoices.csv', buildCsvString(invHeaders, invRows));

    // 6. Purchase Bills CSV
    const billHeaders = ['Record ID', 'Bill Number', 'Date', 'Vendor Name', 'Subtotal', 'Total GST', 'Round Off', 'Grand Total', 'Status', 'Description', 'Line Items JSON'];
    const billRows = data.purchaseBills.map(bill => ({
        'Record ID': bill.id || '',
        'Bill Number': bill.bill_number || '',
        'Date': bill.date || '',
        'Vendor Name': bill.vendor_name || '',
        'Subtotal': bill.total_without_gst || 0,
        'Total GST': bill.total_gst || 0,
        'Round Off': bill.round_off || 0,
        'Grand Total': bill.grand_total || 0,
        'Status': bill.status || 'Pending',
        'Description': bill.description || '',
        'Line Items JSON': typeof bill.items === 'string' ? bill.items : JSON.stringify(bill.items || [])
    }));
    zip.file('purchase_bills.csv', buildCsvString(billHeaders, billRows));

    // 7. Cashbooks CSV
    const cbHeaders = ['Record ID', 'Date', 'Income Total', 'Expense Total', 'Net Balance', 'Entries JSON'];
    const cbRows = data.cashbooks.map(cb => ({
        'Record ID': cb.id || '',
        'Date': cb.date || '',
        'Income Total': cb.income_total || 0,
        'Expense Total': cb.expense_total || 0,
        'Net Balance': cb.balance || 0,
        'Entries JSON': typeof cb.raw_data === 'string' ? cb.raw_data : JSON.stringify(cb.raw_data || {})
    }));
    zip.file('cashbooks.csv', buildCsvString(cbHeaders, cbRows));

    // 8. Duties & Taxes CSV
    const taxHeaders = ['Record ID', 'Tax Name', 'Type', 'Calculation Method', 'Rate (%)', 'Fixed Amount', 'Apply On', 'Applicable To', 'Is Default'];
    const taxRows = data.dutiesTaxes.map(tax => ({
        'Record ID': tax.id || '',
        'Tax Name': tax.name || '',
        'Type': tax.type || 'Charge',
        'Calculation Method': tax.calc_method || 'Percentage',
        'Rate (%)': tax.rate || 0,
        'Fixed Amount': tax.fixed_amount || 0,
        'Apply On': tax.apply_on || 'Subtotal',
        'Applicable To': tax.applicable_to || 'Both',
        'Is Default': tax.is_default ? 'Yes' : 'No'
    }));
    zip.file('duties_taxes.csv', buildCsvString(taxHeaders, taxRows));

    // Generate blob and download
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportCashbookEntryToPDF = (
    incomeRows: any[],
    expenseRows: any[],
    config: { companyName: string; date: string; openingBalance: number; openingDateText: string }
) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 20;

    const formattedDate = formatDate(config.date);

    const incomeTotal = incomeRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
    const expenseTotal = expenseRows.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
    const netClosing = config.openingBalance + incomeTotal - expenseTotal;

    const sharedColumnStyles: any = {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 40, halign: 'right' }
    };

    // 1. Company Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(config.companyName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // 2. Report Sub-header
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`DAILY CASH STATEMENT - DATE: ${formattedDate}`, pageWidth / 2, currentY, { align: 'center' });
    currentY += 12;

    // 3. Opening Balance Block
    autoTable(doc, {
        startY: currentY,
        body: [
            [`OPENING BALANCE FOR DATE ${config.openingDateText}`, config.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })]
        ],
        theme: 'grid',
        styles: { fontSize: 11, fontStyle: 'bold', cellPadding: 5, textColor: [0, 0, 0], lineWidth: 0.15, lineColor: [200, 200, 200] },
        columnStyles: {
            0: { halign: 'left', cellWidth: 'auto' },
            1: { halign: 'right', cellWidth: 40 }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 4. Income Section (Emerald Green)
    autoTable(doc, {
        startY: currentY,
        head: [
            [{ content: 'INCOME (INWARDS)', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fillColor: [0, 185, 93], textColor: [255, 255, 255], fontSize: 12 } }],
            ['SR NO', 'PARTICULARS', 'AMOUNT']
        ],
        body: incomeRows.map((row, i) => [i + 1, row.particulars.toUpperCase(), parseFloat(row.amount || '0').toFixed(2)]),
        foot: [['', 'TOTAL INWARD', incomeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })]],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [245, 245, 245], textColor: [80, 80, 80], fontStyle: 'bold', fontSize: 8 },
        columnStyles: sharedColumnStyles,
        footStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 128, 0], fontSize: 10 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 5. Expense Section (Vibrant Red)
    autoTable(doc, {
        startY: currentY,
        head: [
            [{ content: 'EXPENSE (OUTWARDS)', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fillColor: [220, 38, 38], textColor: [255, 255, 255], fontSize: 12 } }],
            ['SR NO', 'PARTICULARS', 'AMOUNT']
        ],
        body: expenseRows.map((row, i) => [i + 1, row.particulars.toUpperCase(), parseFloat(row.amount || '0').toFixed(2)]),
        foot: [['', 'TOTAL OUTWARD', expenseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })]],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4, lineWidth: 0.1, lineColor: [220, 220, 220] },
        headStyles: { fillColor: [245, 245, 245], textColor: [80, 80, 80], fontStyle: 'bold', fontSize: 8 },
        columnStyles: sharedColumnStyles,
        footStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [220, 38, 38], fontSize: 10 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 6. Bottom Summary Ledger
    autoTable(doc, {
        startY: currentY,
        body: [
            ['Total Income', incomeTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })],
            ['Total Expense', expenseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })],
            [`CLOSING BALANCE FOR DATE ${formattedDate}`, netClosing.toLocaleString('en-IN', { minimumFractionDigits: 2 })]
        ],
        theme: 'grid',
        styles: { fontSize: 12, fontStyle: 'bold', cellPadding: 5, textColor: [0, 0, 0], lineWidth: 0.15, lineColor: [200, 200, 200] },
        columnStyles: {
            0: { halign: 'left', cellWidth: 'auto' },
            1: { halign: 'right', cellWidth: 50 }
        }
    });

    const footerText = "GENERATED BY FINDESK PRIME";
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.setFont('helvetica', 'normal');
    doc.text(footerText, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    doc.save(`Cashbook_${formattedDate.replace(/\//g, '-')}.pdf`);
};

/**
 * Professional Cashbook Daily Statement export with ExcelJS v4.4.0:
 * - Clear executive header hierarchy with company name and statement date
 * - Highlighted opening balance card
 * - Emerald-themed Inward (Receipts) section with zebra striping and subtotal
 * - Rose-themed Outward (Payments) section with zebra striping and subtotal
 * - Double-underlined Net Closing Balance ledger summary box
 */
export const exportCashbookEntryToExcel = async (
    incomeRows: any[],
    expenseRows: any[],
    config: { companyName: string; date: string; openingBalance: number; openingDateText: string }
): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = config.companyName || 'ZenterPrime';
    workbook.created = new Date();

    const formattedDate = formatDate(config.date);
    const safeSheetName = `Cashbook_${formattedDate.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 31);
    const worksheet = workbook.addWorksheet(safeSheetName, {
        views: [{ state: 'frozen', ySplit: 5, activeCell: 'A6', showGridLines: true }],
        pageSetup: {
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            paperSize: 9
        }
    });

    // Explicit Column Widths: SR NO (12), PARTICULARS (46), AMOUNT (24)
    worksheet.getColumn(1).width = 12;
    worksheet.getColumn(2).width = 46;
    worksheet.getColumn(3).width = 24;

    // 1. Company Name Banner (Row 1)
    const companyRow = worksheet.addRow([config.companyName ? config.companyName.toUpperCase() : 'ZENTERPRIME']);
    companyRow.height = 30;
    companyRow.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0F172A' } };
    companyRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    companyRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    worksheet.mergeCells('A1:C1');

    // 2. Subtitle: Daily Cash Statement (Row 2)
    const subRow = worksheet.addRow([`DAILY CASH STATEMENT — DATE: ${formattedDate}`]);
    subRow.height = 22;
    subRow.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E3A8A' } };
    subRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    subRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    worksheet.mergeCells('A2:C2');

    // 3. Spacer (Row 3)
    const r3 = worksheet.addRow([]);
    r3.height = 10;

    // 4. Opening Balance Card (Row 4)
    const openingText = `OPENING BALANCE (${config.openingDateText || 'Beginning of Day'})`;
    const openRow = worksheet.addRow([openingText, '', Number(config.openingBalance) || 0]);
    openRow.height = 24;
    worksheet.mergeCells('A4:B4');
    
    const openCellA = openRow.getCell(1);
    openCellA.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1E293B' } };
    openCellA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    openCellA.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    openCellA.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    const openCellC = openRow.getCell(3);
    openCellC.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
    openCellC.numFmt = '#,##0.00';
    openCellC.alignment = { vertical: 'middle', horizontal: 'right' };
    openCellC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    openCellC.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    // 5. Spacer (Row 5)
    const r5 = worksheet.addRow([]);
    r5.height = 10;

    // 6. INWARDS SECTION
    const inSectionRow = worksheet.addRow(['INWARDS (CASH RECEIPTS / INCOME)']);
    inSectionRow.height = 25;
    inSectionRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    inSectionRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald-600
    inSectionRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    const inSecIdx = inSectionRow.number;
    worksheet.mergeCells(`A${inSecIdx}:C${inSecIdx}`);

    const inHeaderRow = worksheet.addRow(['SR NO', 'PARTICULARS', 'AMOUNT (INR)']);
    inHeaderRow.height = 22;
    inHeaderRow.eachCell((cell, col) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Emerald-100
        cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : (col === 3 ? 'right' : 'left'), indent: col === 2 ? 1 : 0 };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFA7F3D0' } },
            bottom: { style: 'thin', color: { argb: 'FFA7F3D0' } },
            left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
            right: { style: 'thin', color: { argb: 'FFA7F3D0' } }
        };
    });

    let totalIn = 0;
    incomeRows.forEach((r, idx) => {
        const amt = parseFloat(r.amount) || 0;
        totalIn += amt;
        const dRow = worksheet.addRow([idx + 1, (r.particulars || '').toUpperCase(), amt]);
        dRow.height = 20;
        const isOdd = idx % 2 === 1;

        dRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        dRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        dRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
        dRow.getCell(3).numFmt = '#,##0.00';

        dRow.eachCell((cell) => {
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
            if (isOdd) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    });

    // Inward Subtotal Row
    const inSubRow = worksheet.addRow(['', 'TOTAL INWARD (RECEIPTS)', totalIn]);
    inSubRow.height = 23;
    const inSubIdx = inSubRow.number;
    worksheet.mergeCells(`A${inSubIdx}:B${inSubIdx}`);
    const inSubLabel = inSubRow.getCell(1);
    inSubLabel.value = 'TOTAL INWARD (RECEIPTS)';
    inSubLabel.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF065F46' } };
    inSubLabel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    inSubLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    inSubLabel.border = {
        top: { style: 'thin', color: { argb: 'FF6EE7B7' } },
        bottom: { style: 'double', color: { argb: 'FF059669' } },
        left: { style: 'thin', color: { argb: 'FF6EE7B7' } }
    };

    const inSubVal = inSubRow.getCell(3);
    inSubVal.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF059669' } };
    inSubVal.numFmt = '#,##0.00';
    inSubVal.alignment = { vertical: 'middle', horizontal: 'right' };
    inSubVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
    inSubVal.border = {
        top: { style: 'thin', color: { argb: 'FF6EE7B7' } },
        bottom: { style: 'double', color: { argb: 'FF059669' } },
        right: { style: 'thin', color: { argb: 'FF6EE7B7' } }
    };

    // Spacer
    const rSep1 = worksheet.addRow([]);
    rSep1.height = 12;

    // 7. OUTWARDS SECTION
    const outSectionRow = worksheet.addRow(['OUTWARDS (CASH PAYMENTS / EXPENSES)']);
    outSectionRow.height = 25;
    outSectionRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    outSectionRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } }; // Rose-600
    outSectionRow.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    const outSecIdx = outSectionRow.number;
    worksheet.mergeCells(`A${outSecIdx}:C${outSecIdx}`);

    const outHeaderRow = worksheet.addRow(['SR NO', 'PARTICULARS', 'AMOUNT (INR)']);
    outHeaderRow.height = 22;
    outHeaderRow.eachCell((cell, col) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF9F1239' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } }; // Rose-100
        cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'center' : (col === 3 ? 'right' : 'left'), indent: col === 2 ? 1 : 0 };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFFECDD3' } },
            bottom: { style: 'thin', color: { argb: 'FFFECDD3' } },
            left: { style: 'thin', color: { argb: 'FFFECDD3' } },
            right: { style: 'thin', color: { argb: 'FFFECDD3' } }
        };
    });

    let totalOut = 0;
    expenseRows.forEach((r, idx) => {
        const amt = parseFloat(r.amount) || 0;
        totalOut += amt;
        const dRow = worksheet.addRow([idx + 1, (r.particulars || '').toUpperCase(), amt]);
        dRow.height = 20;
        const isOdd = idx % 2 === 1;

        dRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        dRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        dRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
        dRow.getCell(3).numFmt = '#,##0.00';

        dRow.eachCell((cell) => {
            cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
            if (isOdd) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    });

    // Outward Subtotal Row
    const outSubRow = worksheet.addRow(['', 'TOTAL OUTWARD (PAYMENTS)', totalOut]);
    outSubRow.height = 23;
    const outSubIdx = outSubRow.number;
    worksheet.mergeCells(`A${outSubIdx}:B${outSubIdx}`);
    const outSubLabel = outSubRow.getCell(1);
    outSubLabel.value = 'TOTAL OUTWARD (PAYMENTS)';
    outSubLabel.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF9F1239' } };
    outSubLabel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    outSubLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
    outSubLabel.border = {
        top: { style: 'thin', color: { argb: 'FFF43F5E' } },
        bottom: { style: 'double', color: { argb: 'FFE11D48' } },
        left: { style: 'thin', color: { argb: 'FFF43F5E' } }
    };

    const outSubVal = outSubRow.getCell(3);
    outSubVal.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFE11D48' } };
    outSubVal.numFmt = '#,##0.00';
    outSubVal.alignment = { vertical: 'middle', horizontal: 'right' };
    outSubVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
    outSubVal.border = {
        top: { style: 'thin', color: { argb: 'FFF43F5E' } },
        bottom: { style: 'double', color: { argb: 'FFE11D48' } },
        right: { style: 'thin', color: { argb: 'FFF43F5E' } }
    };

    // Spacer
    const rSep2 = worksheet.addRow([]);
    rSep2.height = 12;

    // 8. SUMMARY RECONCILIATION CARD
    const summaryRows = [
        ['Total Cash Receipts (Inwards)', '', totalIn],
        ['Total Cash Payments (Outwards)', '', totalOut],
        [`CLOSING BALANCE FOR DATE ${formattedDate}`, '', Number(config.openingBalance || 0) + totalIn - totalOut]
    ];

    summaryRows.forEach((sRow, sIdx) => {
        const sumRow = worksheet.addRow(sRow);
        sumRow.height = sIdx === 2 ? 26 : 22;
        const curIdx = sumRow.number;
        worksheet.mergeCells(`A${curIdx}:B${curIdx}`);

        const labelCell = sumRow.getCell(1);
        const valCell = sumRow.getCell(3);

        const isClosing = sIdx === 2;
        labelCell.font = { name: 'Calibri', size: isClosing ? 11 : 10, bold: isClosing, color: { argb: isClosing ? 'FF1E3A8A' : 'FF1E293B' } };
        labelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isClosing ? 'FFEFF6FF' : 'FFF8FAFC' } };

        valCell.font = { name: 'Calibri', size: isClosing ? 11.5 : 10, bold: isClosing, color: { argb: isClosing ? 'FF1E3A8A' : 'FF1E293B' } };
        valCell.numFmt = '#,##0.00';
        valCell.alignment = { vertical: 'middle', horizontal: 'right' };
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isClosing ? 'FFEFF6FF' : 'FFF8FAFC' } };

        const borderStyle: Partial<ExcelJS.Borders> = isClosing ? {
            top: { style: 'thin', color: { argb: 'FF93C5FD' } },
            bottom: { style: 'double', color: { argb: 'FF1E3A8A' } },
            left: { style: 'thin', color: { argb: 'FF93C5FD' } },
            right: { style: 'thin', color: { argb: 'FF93C5FD' } }
        } : {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        labelCell.border = borderStyle;
        valCell.border = borderStyle;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    triggerBrowserDownload(buffer, `Cashbook_${formattedDate.replace(/[^a-zA-Z0-9_-]/g, '-')}.xlsx`);
};

export const exportToStyledExcelJS = exportToExcel;

export const exportToCSV = (headers: string[], rows: any[][], config: ExportConfig) => {
    const csvContent = [
        `"${config.companyName.replace(/"/g, '""')}"`,
        `"GSTIN: ${config.gstin}","Address: ${config.address}"`,
        `"Report: ${config.reportTitle}","Period: ${config.dateRange}"`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => {
            const stringCell = String(cell ?? '');
            if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n')) {
                return `"${stringCell.replace(/"/g, '""')}"`;
            }
            return stringCell;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${config.reportTitle.replace(/\s+/g, '_')}_Data.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const triggerPrint = () => {
    window.print();
};
