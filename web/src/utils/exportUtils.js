/**
 * Export Utilities: Generate CSV / Excel compatible files for inventory auditing
 */

export function exportInventoryToCSV(items, filenamePrefix = 'stock_opname_audit') {
  if (!items || items.length === 0) {
    alert('Tidak ada data yang dapat diekspor.');
    return;
  }

  // Extract all unique headers across items
  const headerSet = new Set();
  items.forEach((item) => {
    Object.keys(item).forEach((key) => headerSet.add(key));
  });

  const headers = Array.from(headerSet);

  // Build CSV rows
  const csvRows = [];

  // Header row
  csvRows.push(
    headers
      .map((header) => `"${String(header).replace(/"/g, '""')}"`)
      .join(',')
  );

  // Data rows
  items.forEach((item) => {
    const row = headers.map((header) => {
      const val = item[header] !== undefined && item[header] !== null ? String(item[header]) : '';
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  });

  // Create Blob with BOM for Excel UTF-8 compatibility
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  // Generate formatted filename
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const fileName = `${filenamePrefix}_${dateStr}_${timeStr}.csv`;

  // Download anchor
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
