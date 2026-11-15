const SHEET_NAMES = {
  items: 'items',
  orders: 'orders'
};

function ensureSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const existing = sheet.getDataRange().getValues();
  if (existing.length === 0 || existing[0].every((value) => value === '')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const missingHeaders = headers.filter((header) => !existing[0].includes(header));
  if (missingHeaders.length > 0) {
    sheet.getRange(1, existing[0].length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}

function normalizeItemRow_(row) {
  return {
    id: row[0] || '',
    name: row[1] || '',
    sellingPrice: Number(row[2] || 0),
    cost: Number(row[3] || 0)
  };
}

function normalizeOrderRow_(row) {
  return {
    id: row[0] || '',
    customerName: row[1] || '',
    pickupTime: row[2] || '',
    orderedAt: row[3] || '',
    items: JSON.parse(row[4] || '[]'),
    totalRevenue: Number(row[5] || 0),
    totalCost: Number(row[6] || 0),
    profit: Number(row[7] || 0),
    transferPaid: row[8] === true || String(row[8]).toLowerCase() === 'true' || String(row[8]).toLowerCase() === 'yes'
  };
}

function listItems_() {
  const sheet = ensureSheet_(SHEET_NAMES.items);
  ensureHeaders_(sheet, ['id', 'name', 'sellingPrice', 'cost']);

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  return values.slice(1).filter((row) => row[0] || row[1]).map(normalizeItemRow_);
}

function saveItem_(item) {
  const sheet = ensureSheet_(SHEET_NAMES.items);
  ensureHeaders_(sheet, ['id', 'name', 'sellingPrice', 'cost']);

  const row = [
    item.id || Utilities.getUuid(),
    item.name,
    Number(item.sellingPrice || 0),
    Number(item.cost || 0)
  ];

  const values = sheet.getDataRange().getValues();
  const existingIndex = values.findIndex((existingRow) => String(existingRow[0]) === String(item.id));

  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 1, 1, 1, row.length).setValues([row]);
    return { id: row[0], ...item };
  }

  sheet.appendRow(row);
  return { id: row[0], ...item };
}

function listOrders_() {
  const sheet = ensureSheet_(SHEET_NAMES.orders);
  ensureHeaders_(sheet, ['id', 'customerName', 'pickupTime', 'orderedAt', 'items', 'totalRevenue', 'totalCost', 'profit', 'transferPaid']);

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  return values.slice(1).filter((row) => row[0] || row[1]).map(normalizeOrderRow_);
}

function saveOrder_(order) {
  const sheet = ensureSheet_(SHEET_NAMES.orders);
  ensureHeaders_(sheet, ['id', 'customerName', 'pickupTime', 'orderedAt', 'items', 'totalRevenue', 'totalCost', 'profit', 'transferPaid']);

  const row = [
    order.id || Utilities.getUuid(),
    order.customerName,
    order.pickupTime || '',
    order.orderedAt || new Date().toISOString(),
    JSON.stringify(order.items || []),
    Number(order.totalRevenue || 0),
    Number(order.totalCost || 0),
    Number(order.profit || 0),
    Boolean(order.transferPaid)
  ];

  const values = sheet.getDataRange().getValues();
  const existingIndex = values.findIndex((existingRow) => String(existingRow[0]) === String(order.id));

  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 1, 1, 1, row.length).setValues([row]);
    return { ...order, id: row[0] };
  }

  sheet.appendRow(row);
  return { ...order, id: row[0] };
}

function getStats_(filter = {}) {
  const orders = listOrders_();
  const range = filter.range || 'day';
  const filterValue = filter.value || '';

  const filtered = orders.filter((order) => {
    if (!order.orderedAt) return false;
    const date = new Date(order.orderedAt);
    if (!filterValue) return true;

    if (range === 'day') {
      return date.toISOString().slice(0, 10) === filterValue;
    }

    if (range === 'month') {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return monthKey === filterValue;
    }

    return date.getFullYear() === Number(filterValue);
  });

  const totals = filtered.reduce(
    (summary, order) => {
      summary.revenue += Number(order.totalRevenue || 0);
      summary.cost += Number(order.totalCost || 0);
      summary.profit += Number(order.profit || 0);
      summary.orders += 1;
      return summary;
    },
    { revenue: 0, cost: 0, profit: 0, orders: 0 }
  );

  return totals;
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = body.action || '';
    const payload = body.payload || {};

    let data;

    switch (action) {
      case 'listItems':
        data = listItems_();
        break;
      case 'saveItem':
        data = saveItem_(payload.item || payload);
        break;
      case 'listOrders':
        data = listOrders_();
        break;
      case 'saveOrder':
        data = saveOrder_(payload.order || payload);
        break;
      case 'getStats':
        data = getStats_(payload || {});
        break;
      default:
        data = { message: 'Action not found' };
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, data })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({
      ok: true,
      message: 'Order Notes Apps Script is running.',
      sheets: SHEET_NAMES
    })
  ).setMimeType(ContentService.MimeType.JSON);
}
