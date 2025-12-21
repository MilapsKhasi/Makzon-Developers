
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
    
    // Header Row 1: Company Name
    sheetData.push([config.companyName.toUpperCase()]); 

    // Header Row 2: Company Details
    sheetData.push([`GSTIN: ${config.gstin || 'N/A'} | Address: ${config.address || 'N/A'}`]); 

    // Header Row 3: Report Info
    sheetData.push([`REPORT: ${config.reportTitle} | PERIOD: ${config.dateRange}`]);

    // Header Row 4: Column Headers (Strictly following the provided mapping)
    sheetData.push(headers);

    // Data Rows
    rows.forEach(row => {
        sheetData.push(row);
    });

    // Create Sheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set Column Widths for readability
    const colWidths = headers.map(() => ({ wch: 15 }));
    // Specific wider columns
    colWidths[3] = { wch: 30 }; // Party Name
    colWidths[7] = { wch: 25 }; // Item Name
    colWidths[16] = { wch: 30 }; // Narration
    
    ws['!cols'] = colWidths;

    // Merge logic: Merge top 3 header rows across all columns
    const lastColIndex = headers.length - 1;
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } }, // Merge Company Name
        { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIndex } }, // Merge GSTIN/Address
        { s: { r: 2, c: 0 }, e: { r: 2, c: lastColIndex } }  // Merge Report Info
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Professional_Report");
    // Filename changed to avoid Tally keyword
    XLSX.writeFile(wb, `${config.reportTitle.replace(/\s+/g, '_')}_Report.xlsx`);
};

export const exportToCSV = (headers: string[], rows: any[][], config: ExportConfig) => {
    const csvContent = [
        `"${config.companyName.replace(/"/g, '""')}"`,
        `"GSTIN: ${config.gstin}","Address: ${config.address}"`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => {
            const stringCell = String(cell ?? '');
            if (stringCell.includes(',') || stringCell.includes('"')) {
                return `"${stringCell.replace(/"/g, '""')}"`;
            }
            return stringCell;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    // Filename changed to avoid Tally keyword
    link.setAttribute('download', `${config.reportTitle.replace(/\s+/g, '_')}_Report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
