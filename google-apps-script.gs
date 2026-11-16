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
  const lastColumn = sheet.getLastColumn();
  const existing = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    : [];
  if (sheet.getLastRow() === 0 || existing.every((value) => value === '')) {
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
    transferPaid: isTransferPaid_(row[8]),
    notes: row[9] || '',
    shippingFee: Number(row[10] || 0)
  };
}

function isTransferPaid_(value) {
  const normalized = String(value).toLowerCase();
  return value === true || normalized === 'true' || normalized === 'yes';
}

function orderTimestamp_(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function pickupDate_(value, timezoneOffset) {
  if (typeof value === 'string') {
    const localDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
    if (localDate && !hasTimezone) return localDate[1];
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return '';
  return Utilities.formatDate(
    new Date(timestamp - timezoneOffset * 60000),
    'GMT',
    'yyyy-MM-dd'
  );
}

function listItems_() {
  const sheet = ensureSheet_(SHEET_NAMES.items);
  ensureHeaders_(sheet, ['id', 'name', 'sellingPrice', 'cost']);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, 4).getValues()
    .filter((row) => row[0] || row[1])
    .map(normalizeItemRow_);
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

  const lastRow = sheet.getLastRow();
  const existingIds = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    : [];
  const existingIndex = existingIds.findIndex((existingRow) => String(existingRow[0]) === String(item.id));

  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 2, 1, 1, row.length).setValues([row]);
    return { id: row[0], ...item };
  }

  sheet.appendRow(row);
  return { id: row[0], ...item };
}

function listOrders_() {
  const sheet = ensureSheet_(SHEET_NAMES.orders);
  ensureHeaders_(sheet, ['id', 'customerName', 'pickupTime', 'orderedAt', 'items', 'totalRevenue', 'totalCost', 'profit', 'transferPaid', 'notes', 'shippingFee']);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  return sheet.getRange(2, 1, lastRow - 1, 11).getValues()
    .filter((row) => row[0] || row[1])
    .map(normalizeOrderRow_);
}

function listOrdersPage_(filter = {}) {
  const sheet = ensureSheet_(SHEET_NAMES.orders);
  ensureHeaders_(sheet, ['id', 'customerName', 'pickupTime', 'orderedAt', 'items', 'totalRevenue', 'totalCost', 'profit', 'transferPaid', 'notes', 'shippingFee']);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    const pageSize = Math.min(10, Math.max(1, Number(filter.pageSize) || 10));
    return { orders: [], page: 1, pageSize, total: 0 };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const customerSearch = String(filter.customerSearch || '').trim().toLowerCase();
  const orderDate = String(filter.orderDate || '').trim();
  const timezoneOffset = Number(filter.dateTimezoneOffsetMinutes) || 0;
  const paymentFilter = filter.paymentFilter || 'all';
  const matchingRows = values.filter((row) => {
    if (!(row[0] || row[1])) return false;
    if (customerSearch && !(
      String(row[1] || '').toLowerCase().includes(customerSearch) ||
      String(row[9] || '').toLowerCase().includes(customerSearch)
    )) return false;
    if (orderDate && pickupDate_(row[2], timezoneOffset) !== orderDate) return false;
    if (paymentFilter === 'paid') return isTransferPaid_(row[8]);
    if (paymentFilter === 'unpaid') return !isTransferPaid_(row[8]);
    return true;
  });

  matchingRows.sort((left, right) => (
    orderTimestamp_(right[3]) - orderTimestamp_(left[3]) ||
    String(right[0]).localeCompare(String(left[0]))
  ));

  const pageSize = Math.min(10, Math.max(1, Number(filter.pageSize) || 10));
  const total = matchingRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(filter.page) || 1), pageCount);
  const start = (page - 1) * pageSize;

  return {
    orders: matchingRows.slice(start, start + pageSize).map(normalizeOrderRow_),
    page,
    pageSize,
    total
  };
}

function searchCustomers_(query) {
  const search = String(query || '').trim().toLowerCase();
  if (!search) return [];

  const sheet = ensureSheet_(SHEET_NAMES.orders);
  ensureHeaders_(sheet, ['id', 'customerName', 'pickupTime', 'orderedAt', 'items', 'totalRevenue', 'totalCost', 'profit', 'transferPaid', 'notes', 'shippingFee']);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const customers = new Map();

  values.forEach((row) => {
    const name = String(row[1] || '').trim();
    if (!name || !name.toLowerCase().includes(search)) return;

    const key = name.toLowerCase();
    const timestamp = orderTimestamp_(row[3]);
    const existing = customers.get(key);
    if (!existing || timestamp > existing.timestamp) {
      customers.set(key, { name, timestamp });
    }
  });

  return [...customers.values()]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 10)
    .map((customer) => customer.name);
}

function saveOrder_(order) {
  const sheet = ensureSheet_(SHEET_NAMES.orders);
  ensureHeaders_(sheet, ['id', 'customerName', 'pickupTime', 'orderedAt', 'items', 'totalRevenue', 'totalCost', 'profit', 'transferPaid', 'notes', 'shippingFee']);

  const row = [
    order.id || Utilities.getUuid(),
    order.customerName,
    order.pickupTime || '',
    order.orderedAt || new Date().toISOString(),
    JSON.stringify(order.items || []),
    Number(order.totalRevenue || 0),
    Number(order.totalCost || 0),
    Number(order.profit || 0),
    Boolean(order.transferPaid),
    String(order.notes || ''),
    Number(order.shippingFee || 0)
  ];

  const lastRow = sheet.getLastRow();
  const existingIds = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    : [];
  const existingIndex = existingIds.findIndex((existingRow) => String(existingRow[0]) === String(order.id));

  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 2, 1, 1, row.length).setValues([row]);
    return { ...order, id: row[0] };
  }

  sheet.appendRow(row);
  return { ...order, id: row[0] };
}

function deleteOrder_(orderId) {
  const sheet = ensureSheet_(SHEET_NAMES.orders);
  ensureHeaders_(sheet, ['id', 'customerName', 'pickupTime', 'orderedAt', 'items', 'totalRevenue', 'totalCost', 'profit', 'transferPaid', 'notes', 'shippingFee']);

  const lastRow = sheet.getLastRow();
  const existingIds = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getValues()
    : [];
  const existingIndex = existingIds.findIndex((row) => String(row[0]) === String(orderId));
  if (existingIndex < 0) {
    return { deleted: false };
  }

  sheet.deleteRow(existingIndex + 2);
  return { deleted: true };
}

function getStats_(filter = {}) {
  const orders = listOrders_();
  const range = filter.range || 'day';
  const filterValue = filter.value || '';
  const timezoneOffset = Number(filter.dateTimezoneOffsetMinutes) || 0;

  const filtered = orders.filter((order) => {
    const pickupDate = pickupDate_(order.pickupTime, timezoneOffset);
    if (!pickupDate) return false;
    if (!filterValue) return true;

    if (range === 'day') {
      return pickupDate === filterValue;
    }

    if (range === 'month') {
      return pickupDate.slice(0, 7) === filterValue;
    }

    return Number(pickupDate.slice(0, 4)) === Number(filterValue);
  });

  const totals = filtered.reduce(
    (summary, order) => {
      summary.revenue += Number(order.totalRevenue || 0);
      summary.cost += Number(order.totalCost || 0);
      summary.profit += Number(order.profit || 0);
      summary.orders += 1;
      if (!isTransferPaid_(order.transferPaid)) {
        summary.unpaidAmount += Number(order.totalRevenue || 0) + Number(order.shippingFee || 0);
      }
      return summary;
    },
    { revenue: 0, cost: 0, profit: 0, orders: 0, unpaidAmount: 0 }
  );

  const itemTotals = new Map();
  const customerTotals = new Map();
  filtered.forEach((order) => {
    const customerName = order.customerName || 'Chưa rõ';
    customerTotals.set(customerName, (customerTotals.get(customerName) || 0) + Number(order.totalRevenue || 0));
    (order.items || []).forEach((item) => {
      const itemName = item.name || 'Chưa rõ';
      const total = itemTotals.get(itemName) || { value: 0, quantity: 0 };
      const quantity = Number(item.quantity || 0);
      total.value += quantity * Number(item.sellingPrice || 0);
      total.quantity += quantity;
      itemTotals.set(itemName, total);
    });
  });

  const topEntries = (totalsByName) => [...totalsByName.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
  const topItems = [...itemTotals.entries()]
    .map(([name, total]) => ({ name, ...total }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);

  return {
    ...totals,
    items: topItems,
    customers: topEntries(customerTotals)
  };
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
      case 'listOrdersPage':
        data = listOrdersPage_(payload || {});
        break;
      case 'searchCustomers':
        data = searchCustomers_(payload.query);
        break;
      case 'saveOrder':
        data = saveOrder_(payload.order || payload);
        break;
      case 'deleteOrder':
        data = deleteOrder_(payload.orderId);
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
