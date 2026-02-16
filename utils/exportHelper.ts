
import * as XLSX from 'xlsx';

export interface ExportConfig {
    companyName: string;
    gstin: string;
    email: string;
    phone: string;
    address: string;
    reportTitle: string;
    dateRange: string;
}

export const exportToExcel = (
    headers: string[], 
    rows: any[][], 
    config: ExportConfig
) => {
    const sheetData: any[][] = [];
    
    // Header Section for Excel
    sheetData.push([config.companyName.toUpperCase()]); 
    sheetData.push([`GSTIN: ${config.gstin || 'N/A'} | Address: ${config.address || 'N/A'}`]); 
    sheetData.push([`REPORT: ${config.reportTitle} | PERIOD: ${config.dateRange}`]);
    sheetData.push([]); // Spacer
    sheetData.push(headers);

    rows.forEach(row => {
        sheetData.push(row);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto-size columns based on headers
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 12) }));
    ws['!cols'] = colWidths;

    // Merges for the header
    const lastColIndex = headers.length - 1;
    if (lastColIndex > 0) {
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIndex } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: lastColIndex } }
        ];
    }

    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${config.reportTitle.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
};

/**
 * Specialized export for Cashbook Entry Sheet with vertical stacked layout
 * as per requested format: Company Header -> Date -> Income Section -> Expense Section -> Closing Balance
 */
export const exportCashbookEntryToExcel = (
    incomeRows: any[],
    expenseRows: any[],
    config: { companyName: string; date: string }
) => {
    const sheetData: any[][] = [];
    const merges: any[] = [];
    
    // 1. Branding Headers
    sheetData.push([]); // Padding top
    sheetData.push(["", config.companyName.toUpperCase()]);
    merges.push({ s: { r: 1, c: 1 }, e: { r: 1, c: 3 } });
    
    sheetData.push(["", `DAILY CASH STATEMENT - DATE: ${config.date}`]);
    merges.push({ s: { r: 2, c: 1 }, e: { r: 2, c: 3 } });
    
    sheetData.push([]); // Spacer row

    // 2. INCOME SECTION
    sheetData.push(["", "INCOME (INWARD)"]);
    merges.push({ s: { r: 4, c: 1 }, e: { r: 4, c: 3 } });
    
    sheetData.push(["", "SR NO", "PARTICULARS / SOURCE", "AMOUNT (INR)"]);
    
    let totalIncome = 0;
    const cleanIncome = incomeRows.filter(r => r.particulars.trim() !== '' || r.amount !== '');
    
    cleanIncome.forEach((row, idx) => {
        const amt = parseFloat(row.amount) || 0;
        totalIncome += amt;
        sheetData.push(["", idx + 1, row.particulars, amt]);
    });
    
    // Income Total row
    const incomeTotalRowIndex = sheetData.length;
    sheetData.push(["", "TOTAL", "", totalIncome]);
    merges.push({ s: { r: incomeTotalRowIndex, c: 1 }, e: { r: incomeTotalRowIndex, c: 2 } });
    
    sheetData.push([]); // Spacer row between sections

    // 3. EXPENSE SECTION
    const expenseHeaderIndex = sheetData.length;
    sheetData.push(["", "EXPENSE (OUTWARD)"]);
    merges.push({ s: { r: expenseHeaderIndex, c: 1 }, e: { r: expenseHeaderIndex, c: 3 } });
    
    sheetData.push(["", "SR NO", "PARTICULARS / USAGE", "AMOUNT (INR)"]);
    
    let totalExpense = 0;
    const cleanExpense = expenseRows.filter(r => r.particulars.trim() !== '' || r.amount !== '');
    
    cleanExpense.forEach((row, idx) => {
        const amt = parseFloat(row.amount) || 0;
        totalExpense += amt;
        sheetData.push(["", idx + 1, row.particulars, amt]);
    });
    
    // Expense Total row
    const expenseTotalRowIndex = sheetData.length;
    sheetData.push(["", "TOTAL", "", totalExpense]);
    merges.push({ s: { r: expenseTotalRowIndex, c: 1 }, e: { r: expenseTotalRowIndex, c: 2 } });
    
    sheetData.push([]); // Spacer row before summary

    // 4. SUMMARY SECTION (Closing Net Balance)
    const summaryRowIndex = sheetData.length;
    const netBalance = totalIncome - totalExpense;
    sheetData.push(["", "CLOSING NET BALANCE:", "", netBalance]);
    merges.push({ s: { r: summaryRowIndex, c: 1 }, e: { r: summaryRowIndex, c: 2 } });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Apply merges
    ws['!merges'] = merges;

    // Set Column Widths: A(Padding: 2), B(Sr: 10), C(Particulars: 60), D(Amount: 20)
    ws['!cols'] = [
        { wch: 2 },  // A: Left gutter
        { wch: 10 }, // B: Sr
        { wch: 60 }, // C: Particulars
        { wch: 20 }  // D: Amount
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Cashbook_Report");
    XLSX.writeFile(wb, `Cashbook_${config.date.replace(/[\/\-]/g, '_')}.xlsx`);
};

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
};

export const triggerPrint = () => {
    window.print();
};
