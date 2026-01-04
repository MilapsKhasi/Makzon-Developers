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
 * Specialized export for Cashbook Entry Sheet with dual side-by-side layout
 */
export const exportCashbookEntryToExcel = (
    incomeRows: any[],
    expenseRows: any[],
    config: { companyName: string; date: string }
) => {
    const sheetData: any[][] = [];
    
    // Branding Headers
    sheetData.push([config.companyName.toUpperCase()]);
    sheetData.push([`DAILY CASH STATEMENT - DATE: ${config.date}`]);
    sheetData.push([]); // Spacer

    // Section Headings
    // Columns: A(Sr), B(Part), C(Amt), D(Spacer), E(Sr), F(Part), G(Amt)
    sheetData.push(['INCOME (INWARD)', '', '', '', 'EXPENSE (OUTWARD)', '', '']);
    
    // Column Headers
    sheetData.push(['SR NO', 'PARTICULARS / SOURCE', 'AMOUNT (INR)', '', 'SR NO', 'PARTICULARS / USAGE', 'AMOUNT (INR)']);

    const maxRows = Math.max(incomeRows.length, expenseRows.length);
    let totalIncome = 0;
    let totalExpense = 0;

    for (let i = 0; i < maxRows; i++) {
        const inc = incomeRows[i] || { particulars: '', amount: '' };
        const exp = expenseRows[i] || { particulars: '', amount: '' };
        
        const incAmt = parseFloat(inc.amount) || 0;
        const expAmt = parseFloat(exp.amount) || 0;
        
        totalIncome += incAmt;
        totalExpense += expAmt;

        sheetData.push([
            inc.particulars ? i + 1 : '',
            inc.particulars || '',
            inc.particulars ? incAmt : '',
            '', // spacer column
            exp.particulars ? i + 1 : '',
            exp.particulars || '',
            exp.particulars ? expAmt : ''
        ]);
    }

    // Totals Row
    sheetData.push([]);
    sheetData.push([
        'TOTAL', 
        '', 
        totalIncome, 
        '', 
        'TOTAL', 
        '', 
        totalExpense
    ]);

    // Net Balance Summary
    sheetData.push([]);
    const netBalance = totalIncome - totalExpense;
    sheetData.push(['', 'CLOSING NET BALANCE:', netBalance]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Column Widths: Sr(8), Particulars(45), Amount(15), Spacer(5)
    ws['!cols'] = [
        { wch: 8 },  // A: Sr
        { wch: 45 }, // B: Particulars
        { wch: 15 }, // C: Amount
        { wch: 5 },  // D: Spacer
        { wch: 8 },  // E: Sr
        { wch: 45 }, // F: Particulars
        { wch: 15 }  // G: Amount
    ];

    // Merges
    ws['!merges'] = [
        // Company Branding
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
        // Section Titles
        { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } }, // Income Header
        { s: { r: 3, c: 4 }, e: { r: 3, c: 6 } }, // Expense Header
        // Totals labels
        { s: { r: 4 + maxRows + 1, c: 0 }, e: { r: 4 + maxRows + 1, c: 1 } }, // Total Income Label
        { s: { r: 4 + maxRows + 1, c: 4 }, e: { r: 4 + maxRows + 1, c: 5 } }  // Total Expense Label
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Cashbook_Statement");
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
