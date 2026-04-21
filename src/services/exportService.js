import * as XLSX from 'xlsx';

/**
 * Build a totals row for numeric columns.
 */
function buildTotalsRow(data, columns) {
  return columns.map((c, idx) => {
    if (c.noTotal) return '';
    const vals = data.map(row => row[c.key]);
    const allNumeric = vals.length > 0 && vals.every(v => typeof v === 'number' && !isNaN(v));
    if (allNumeric) {
      return Math.round(vals.reduce((s, v) => s + v, 0) * 100) / 100;
    }
    return idx === 0 ? 'TOTAL' : '';
  });
}

/**
 * Export data to an Excel file with timestamp in filename.
 * Automatically appends a TOTAL row for numeric columns.
 */
export function exportToExcel(data, columns, sheetName, filePrefix) {
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

  const headers = columns.map(c => c.header);
  const rows = data.map(row => columns.map(c => row[c.key] ?? ''));
  const totals = buildTotalsRow(data, columns);
  const emptyRow = columns.map(() => '');

  const wsData = [headers, ...rows, emptyRow, totals];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filePrefix}_${timestamp}.xlsx`);
}

/**
 * Export multiple sheets to a single Excel file.
 * Automatically appends a TOTAL row per sheet for numeric columns.
 */
export function exportMultiSheetExcel(sheets, filePrefix) {
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;

  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const headers = sheet.columns.map(c => c.header);
    const rows = sheet.data.map(row => sheet.columns.map(c => row[c.key] ?? ''));
    const totals = buildTotalsRow(sheet.data, sheet.columns);
    const emptyRow = sheet.columns.map(() => '');
    const wsData = [headers, ...rows, emptyRow, totals];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = sheet.columns.map(c => ({ wch: c.width || 15 }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName);
  }

  XLSX.writeFile(wb, `${filePrefix}_${timestamp}.xlsx`);
}
