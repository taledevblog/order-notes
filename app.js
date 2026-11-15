const config = window.ORDER_NOTES_CONFIG || { useGoogleSheets: false, scriptUrl: '' };
const state = {
  items: [],
  orders: [],
  cart: []
};

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
});

const el = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  hydrateDateInputs();
  loadData();
});

function cacheElements() {
  el.tabButtons = document.querySelectorAll('.tab-btn');
  el.tabPanes = document.querySelectorAll('.tab-pane');
  el.itemForm = document.getElementById('item-form');
  el.itemTableBody = document.getElementById('items-table-body');
  el.orderForm = document.getElementById('order-form');
  el.orderItemSelect = document.getElementById('order-item-select');
  el.orderQty = document.getElementById('order-item-qty');
  el.addOrderItem = document.getElementById('add-order-item');
  el.orderCart = document.getElementById('order-cart');
  el.pickupTime = document.getElementById('pickup-time');
  el.pickupName = document.getElementById('pickup-name');
  el.cartTotalRevenue = document.getElementById('cart-total-revenue');
  el.cartTotalProfit = document.getElementById('cart-total-profit');
  el.ordersList = document.getElementById('orders-list');
  el.syncButton = document.getElementById('sync-btn');
  el.toasts = document.getElementById('toast');
  el.statsRange = document.getElementById('stats-range');
  el.statsDate = document.getElementById('stats-date');
  el.refreshStats = document.getElementById('refresh-stats');
  el.statRevenue = document.getElementById('stat-revenue');
  el.statProfit = document.getElementById('stat-profit');
  el.statCost = document.getElementById('stat-cost');
  el.statOrders = document.getElementById('stat-orders');
}

function bindEvents() {
  el.tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.target));
  });

  el.itemForm.addEventListener('submit', saveItem);
  el.orderForm.addEventListener('submit', saveOrder);
  el.addOrderItem.addEventListener('click', addOrderItemToCart);
  el.syncButton.addEventListener('click', loadData);
  el.refreshStats.addEventListener('click', renderStats);
  el.statsRange.addEventListener('change', updateStatsInputType);
}

function hydrateDateInputs() {
  const today = new Date();
  const iso = toLocalDateTimeInputValue(today);
  el.pickupTime.value = iso;
  el.statsDate.value = today.toISOString().slice(0, 10);
  updateStatsInputType();
}

function switchTab(targetId) {
  el.tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.target === targetId));
  el.tabPanes.forEach((pane) => pane.classList.toggle('active', pane.id === targetId));
}

async function loadData() {
  try {
    if (config.useGoogleSheets && config.scriptUrl && !config.scriptUrl.includes('PASTE')) {
      showToast('Đang đồng bộ dữ liệu từ Google Sheets...');
      const [itemsResponse, ordersResponse] = await Promise.all([
        callSheetAction('listItems'),
        callSheetAction('listOrders')
      ]);

      state.items = itemsResponse.data || [];
      state.orders = ordersResponse.data || [];
      persistLocalDemoData();
    } else {
      const saved = localStorage.getItem('order-notes-demo');
      const parsed = saved ? JSON.parse(saved) : { items: [], orders: [] };
      state.items = parsed.items || [];
      state.orders = parsed.orders || [];
    }

    renderItemOptions();
    renderItemsTable();
    renderOrdersList();
    renderStats();
    showToast('Dữ liệu đã được tải.');
  } catch (error) {
    console.error(error);
    if (config.useGoogleSheets) {
      config.useGoogleSheets = false;
      showToast('Google Sheets bị chặn bởi CORS/OAuth trên localhost. Chuyển sang lưu local.');
    }

    const saved = localStorage.getItem('order-notes-demo');
    const parsed = saved ? JSON.parse(saved) : { items: [], orders: [] };
    state.items = parsed.items || [];
    state.orders = parsed.orders || [];
    renderItemOptions();
    renderItemsTable();
    renderOrdersList();
    renderStats();
  }
}

function persistLocalDemoData() {
  localStorage.setItem('order-notes-demo', JSON.stringify({ items: state.items, orders: state.orders }));
}

async function saveItem(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  const rawItem = {
    id: `item-${Date.now()}`,
    name: String(formData.get('itemName') || '').trim(),
    sellingPrice: Number(formData.get('sellingPrice')),
    cost: Number(formData.get('cost'))
  };

  if (!rawItem.name || Number.isNaN(rawItem.sellingPrice) || Number.isNaN(rawItem.cost)) {
    showToast('Vui lòng nhập đầy đủ thông tin món hàng.');
    return;
  }

  const item = {
    ...rawItem,
    sellingPrice: Number(rawItem.sellingPrice),
    cost: Number(rawItem.cost)
  };

  try {
    if (config.useGoogleSheets && config.scriptUrl && !config.scriptUrl.includes('PASTE')) {
      await callSheetAction('saveItem', { item });
    }

    const existingIndex = state.items.findIndex((entry) => entry.name.toLowerCase() === item.name.toLowerCase());
    if (existingIndex >= 0) {
      state.items[existingIndex] = { ...state.items[existingIndex], ...item };
    } else {
      state.items.push(item);
    }

    persistLocalDemoData();
    renderItemOptions();
    renderItemsTable();
    event.target.reset();
    showToast('Đã lưu món hàng.');
  } catch (error) {
    console.error(error);
    if (config.useGoogleSheets) {
      config.useGoogleSheets = false;
      showToast('Google Sheets bị chặn, đang lưu vào thiết bị.');
    } else {
      showToast('Không thể lưu món hàng.');
    }

    const existingIndex = state.items.findIndex((entry) => entry.name.toLowerCase() === item.name.toLowerCase());
    if (existingIndex >= 0) {
      state.items[existingIndex] = { ...state.items[existingIndex], ...item };
    } else {
      state.items.push(item);
    }

    persistLocalDemoData();
    renderItemOptions();
    renderItemsTable();
    event.target.reset();
  }
}

function renderItemOptions() {
  el.orderItemSelect.innerHTML = '<option value="">-- Chọn món --</option>';

  state.items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} (${moneyFormatter.format(item.sellingPrice)})`;
    el.orderItemSelect.appendChild(option);
  });
}

function renderItemsTable() {
  el.itemTableBody.innerHTML = '';

  state.items.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="Tên món">${item.name}</td>
      <td data-label="Giá bán">${moneyFormatter.format(item.sellingPrice)}</td>
      <td data-label="Giá cost">${moneyFormatter.format(item.cost)}</td>
      <td data-label="Thao tác"><button class="delete-btn" type="button" data-id="${item.id}">Xóa</button></td>
    `;
    row.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.id));
    el.itemTableBody.appendChild(row);
  });
}

function deleteItem(itemId) {
  state.items = state.items.filter((item) => item.id !== itemId);
  persistLocalDemoData();
  renderItemOptions();
  renderItemsTable();
  showToast('Đã xóa món hàng.');
}

function addOrderItemToCart() {
  const itemId = el.orderItemSelect.value;
  const quantity = Number(el.orderQty.value || 1);

  if (!itemId) {
    showToast('Vui lòng chọn một món trước khi thêm vào đơn.');
    return;
  }

  if (quantity <= 0) {
    showToast('Số lượng phải lớn hơn 0.');
    return;
  }

  const selectedItem = state.items.find((item) => item.id === itemId);
  if (!selectedItem) {
    showToast('Món hàng không tồn tại.');
    return;
  }

  const existingIndex = state.cart.findIndex((entry) => entry.id === itemId);
  if (existingIndex >= 0) {
    state.cart[existingIndex].quantity += quantity;
  } else {
    state.cart.push({
      id: selectedItem.id,
      name: selectedItem.name,
      quantity,
      sellingPrice: selectedItem.sellingPrice,
      cost: selectedItem.cost
    });
  }

  renderCart();
  el.orderQty.value = 1;
}

function renderCart() {
  el.orderCart.innerHTML = '';

  if (state.cart.length === 0) {
    el.orderCart.innerHTML = '<p>Chưa có món nào trong đơn hàng.</p>';
    el.cartTotalRevenue.textContent = moneyFormatter.format(0);
    el.cartTotalProfit.textContent = moneyFormatter.format(0);
    return;
  }

  let totalRevenue = 0;
  let totalProfit = 0;

  state.cart.forEach((entry) => {
    const subtotalRevenue = entry.quantity * entry.sellingPrice;
    const subtotalProfit = subtotalRevenue - entry.quantity * entry.cost;
    totalRevenue += subtotalRevenue;
    totalProfit += subtotalProfit;

    const itemCard = document.createElement('div');
    itemCard.className = 'cart-item';
    itemCard.innerHTML = `
      <div class="cart-meta">
        <strong>${entry.name}</strong>
        <small>${entry.quantity} x ${moneyFormatter.format(entry.sellingPrice)} / mỗi món</small>
      </div>
      <div class="form-actions">
        <strong>${moneyFormatter.format(subtotalRevenue)}</strong>
        <button type="button" class="delete-btn" data-item-id="${entry.id}">Xóa</button>
      </div>
    `;

    itemCard.querySelector('.delete-btn').addEventListener('click', () => {
      state.cart = state.cart.filter((cartItem) => cartItem.id !== entry.id);
      renderCart();
    });

    el.orderCart.appendChild(itemCard);
  });

  el.cartTotalRevenue.textContent = moneyFormatter.format(totalRevenue);
  el.cartTotalProfit.textContent = moneyFormatter.format(totalProfit);
}

async function saveOrder(event) {
  event.preventDefault();

  if (state.cart.length === 0) {
    showToast('Đơn hàng đang trống, vui lòng thêm món trước khi lưu.');
    return;
  }

  const customerName = String(el.pickupName.value || '').trim();
  if (!customerName) {
    showToast('Vui lòng nhập tên người lấy (Zalo/Facebook).');
    return;
  }

  const order = {
    id: `order-${Date.now()}`,
    customerName,
    pickupTime: el.pickupTime.value || new Date().toISOString(),
    orderedAt: new Date().toISOString(),
    items: state.cart.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      sellingPrice: item.sellingPrice,
      cost: item.cost
    })),
    totalRevenue: state.cart.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0),
    totalCost: state.cart.reduce((sum, item) => sum + item.quantity * item.cost, 0),
    profit: state.cart.reduce((sum, item) => sum + item.quantity * (item.sellingPrice - item.cost), 0)
  };

  try {
    if (config.useGoogleSheets && config.scriptUrl && !config.scriptUrl.includes('PASTE')) {
      await callSheetAction('saveOrder', { order });
    }

    state.orders.push(order);
    persistLocalDemoData();
    state.cart = [];
    renderCart();
    renderOrdersList();
    renderStats();
    el.orderForm.reset();
    hydrateDateInputs();
    showToast('Đã lưu note bán hàng.');
  } catch (error) {
    console.error(error);
    if (config.useGoogleSheets) {
      config.useGoogleSheets = false;
      showToast('Google Sheets bị chặn, đang lưu vào thiết bị.');
    } else {
      showToast('Không thể lưu note bán hàng.');
    }

    state.orders.push(order);
    persistLocalDemoData();
    state.cart = [];
    renderCart();
    renderOrdersList();
    renderStats();
    el.orderForm.reset();
    hydrateDateInputs();
  }
}

function renderOrdersList() {
  el.ordersList.innerHTML = '';

  if (state.orders.length === 0) {
    el.ordersList.innerHTML = '<p>Chưa có đơn hàng nào.</p>';
    return;
  }

  [...state.orders].reverse().forEach((order) => {
    const card = document.createElement('div');
    card.className = 'order-card';
    const orderDate = new Date(order.orderedAt);

    card.innerHTML = `
      <div class="order-top">
        <div>
          <strong>Khách: ${order.customerName}</strong>
          <div><small>${formatDisplayDate(orderDate)}</small></div>
        </div>
        <div>
          <strong>${moneyFormatter.format(order.totalRevenue)}</strong>
        </div>
      </div>
      <div class="order-items">
        ${order.items
          .map(
            (item) => `
              <div class="order-item-line">
                <span><strong>${item.name}</strong> x${item.quantity}</span>
                <span>${moneyFormatter.format(item.quantity * item.sellingPrice)}</span>
              </div>
            `
          )
          .join('')}
      </div>
      <div class="order-item-line" style="margin-top: 12px;">
        <span>Lợi nhuận</span>
        <strong>${moneyFormatter.format(order.profit)}</strong>
      </div>
    `;

    el.ordersList.appendChild(card);
  });
}

function updateStatsInputType() {
  const range = el.statsRange.value;
  if (range === 'day') {
    el.statsDate.type = 'date';
  } else if (range === 'month') {
    el.statsDate.type = 'month';
  } else {
    el.statsDate.type = 'number';
    el.statsDate.min = '2020';
    el.statsDate.step = '1';
    el.statsDate.placeholder = '2026';
  }
}

function renderStats() {
  const range = el.statsRange.value;
  const filterValue = el.statsDate.value;
  const filteredOrders = state.orders.filter((order) => matchesRange(order.orderedAt, range, filterValue));

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.totalRevenue || 0), 0);
  const totalCost = filteredOrders.reduce((sum, order) => sum + Number(order.totalCost || 0), 0);
  const totalProfit = filteredOrders.reduce((sum, order) => sum + Number(order.profit || 0), 0);

  el.statRevenue.textContent = moneyFormatter.format(totalRevenue);
  el.statCost.textContent = moneyFormatter.format(totalCost);
  el.statProfit.textContent = moneyFormatter.format(totalProfit);
  el.statOrders.textContent = String(filteredOrders.length);
}

function matchesRange(dateValue, range, filterValue) {
  if (!dateValue) return true;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  if (!filterValue) return true;

  if (range === 'day') {
    return date.toISOString().slice(0, 10) === filterValue;
  }

  if (range === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === filterValue;
  }

  return date.getFullYear() === Number(filterValue);
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function toLocalDateTimeInputValue(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function showToast(message) {
  el.toasts.textContent = message;
  el.toasts.classList.add('show');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    el.toasts.classList.remove('show');
  }, 2200);
}

async function callSheetAction(action, payload = {}) {
  if (!config.scriptUrl || config.scriptUrl.includes('PASTE')) {
    throw new Error('Google Apps Script URL chưa được cấu hình.');
  }

  const response = await fetch(config.scriptUrl, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.error || 'Google Sheets request failed');
  }

  return result;
}
