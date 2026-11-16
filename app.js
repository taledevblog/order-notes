const config = window.ORDER_NOTES_CONFIG || { useGoogleSheets: false, scriptUrl: '' };
const state = {
  items: [],
  orders: [],
  cart: [],
  editingItemId: null,
  editingOrderId: null,
  activeBillId: null,
  busyCount: 0,
  ordersPage: 1,
  ordersTotal: 0,
  ordersFromSheets: false,
  customerSearchQuery: '',
  ordersDateQuery: '',
  ordersDateTimezoneOffset: 0,
  customerSuggestionTimer: null,
  customerSuggestionRequestId: 0
};

const ORDERS_PER_PAGE = 10;

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
  el.itemFormTitle = document.getElementById('item-form-title');
  el.cancelItemEdit = document.getElementById('cancel-item-edit');
  el.itemTableBody = document.getElementById('items-table-body');
  el.orderForm = document.getElementById('order-form');
  el.orderFormTitle = document.getElementById('order-form-title');
  el.cancelOrderEdit = document.getElementById('cancel-order-edit');
  el.orderItemSelect = document.getElementById('order-item-select');
  el.orderQty = document.getElementById('order-item-qty');
  el.addOrderItem = document.getElementById('add-order-item');
  el.orderCart = document.getElementById('order-cart');
  el.pickupTime = document.getElementById('pickup-time');
  el.pickupName = document.getElementById('pickup-name');
  el.customerSuggestions = document.getElementById('customer-suggestions');
  el.transferPaid = document.getElementById('transfer-paid');
  el.shippingFee = document.getElementById('shipping-fee');
  el.orderNotes = document.getElementById('order-notes');
  el.cartTotalRevenue = document.getElementById('cart-total-revenue');
  el.cartTotalProfit = document.getElementById('cart-total-profit');
  el.ordersList = document.getElementById('orders-list');
  el.paymentFilter = document.getElementById('payment-filter');
  el.customerSearch = document.getElementById('customer-search');
  el.ordersDateFilter = document.getElementById('orders-date-filter');
  el.searchCustomer = document.getElementById('search-customer');
  el.ordersPagination = document.getElementById('orders-pagination');
  el.ordersPrev = document.getElementById('orders-prev');
  el.ordersNext = document.getElementById('orders-next');
  el.ordersPageInfo = document.getElementById('orders-page-info');
  el.syncButton = document.getElementById('sync-btn');
  el.toasts = document.getElementById('toast');
  el.loadingOverlay = document.getElementById('loading-overlay');
  el.loadingMessage = document.getElementById('loading-message');
  el.statsRange = document.getElementById('stats-range');
  el.statsDate = document.getElementById('stats-date');
  el.refreshStats = document.getElementById('refresh-stats');
  el.statRevenue = document.getElementById('stat-revenue');
  el.statProfit = document.getElementById('stat-profit');
  el.statCost = document.getElementById('stat-cost');
  el.statOrders = document.getElementById('stat-orders');
  el.itemStatsChart = document.getElementById('item-stats-chart');
  el.customerStatsChart = document.getElementById('customer-stats-chart');
  el.billModal = document.getElementById('bill-modal');
  el.billPreview = document.getElementById('bill-preview');
  el.closeBill = document.getElementById('close-bill');
  el.saveBillImage = document.getElementById('save-bill-image');
}

function bindEvents() {
  el.tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.target));
  });

  el.itemForm.addEventListener('submit', saveItem);
  el.itemForm.addEventListener('reset', cancelItemEdit);
  el.cancelItemEdit.addEventListener('click', () => el.itemForm.reset());
  el.orderForm.addEventListener('submit', saveOrder);
  el.pickupName.addEventListener('input', scheduleCustomerSuggestions);
  el.shippingFee.addEventListener('input', renderCart);
  el.cancelOrderEdit.addEventListener('click', cancelOrderEdit);
  el.addOrderItem.addEventListener('click', addOrderItemToCart);
  el.syncButton.addEventListener('click', loadData);
  el.paymentFilter.addEventListener('change', () => {
    if (state.ordersFromSheets) {
      loadOrdersPage(1);
    } else {
      state.ordersPage = 1;
      renderOrdersList();
    }
  });
  el.searchCustomer.addEventListener('click', searchOrders);
  el.customerSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchOrders();
    }
  });
  el.ordersDateFilter.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchOrders();
    }
  });
  el.ordersPrev.addEventListener('click', () => changeOrdersPage(-1));
  el.ordersNext.addEventListener('click', () => changeOrdersPage(1));
  el.refreshStats.addEventListener('click', renderStats);
  el.statsRange.addEventListener('change', updateStatsInputType);
  el.closeBill.addEventListener('click', closeBill);
  el.saveBillImage.addEventListener('click', downloadBillImage);
  el.billModal.addEventListener('click', (event) => {
    if (event.target === el.billModal) closeBill();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !el.billModal.hidden) closeBill();
  });
}

function hydrateDateInputs() {
  const today = new Date();
  const iso = toLocalDateTimeInputValue(today);
  el.pickupTime.value = iso;
  el.statsDate.value = formatLocalDate(today);
  updateStatsInputType();
}

function switchTab(targetId) {
  el.tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.target === targetId));
  el.tabPanes.forEach((pane) => pane.classList.toggle('active', pane.id === targetId));
  if (targetId === 'stats-section') renderStats();
}

async function loadData() {
  await beginBusy('Đang tải dữ liệu...');
  try {
    if (config.useGoogleSheets && config.scriptUrl && !config.scriptUrl.includes('PASTE')) {
      const [itemsResponse, ordersPageResponse] = await Promise.all([
        callSheetAction('listItems'),
        callSheetAction('listOrdersPage', {
          page: 1,
          pageSize: ORDERS_PER_PAGE,
          paymentFilter: el.paymentFilter.value,
          customerSearch: state.customerSearchQuery,
          orderDate: state.ordersDateQuery,
          dateTimezoneOffsetMinutes: state.ordersDateTimezoneOffset
        })
      ]);

      const ordersPage = ordersPageResponse.data;
      if (!ordersPage || !Array.isArray(ordersPage.orders) || !Number.isFinite(Number(ordersPage.total))) {
        throw new Error('ORDER_PAGINATION_UNAVAILABLE');
      }
      state.items = itemsResponse.data || [];
      state.orders = ordersPage.orders;
      state.ordersTotal = Number(ordersPage.total);
      state.ordersPage = Number(ordersPage.page) || 1;
      state.ordersFromSheets = true;
    } else {
      const saved = localStorage.getItem('order-notes-demo');
      const parsed = saved ? JSON.parse(saved) : { items: [], orders: [] };
      state.items = parsed.items || [];
      state.orders = parsed.orders || [];
      state.ordersTotal = state.orders.length;
      state.ordersPage = 1;
      state.ordersFromSheets = false;
    }

    renderItemOptions();
    renderItemsTable();
    renderOrdersList();
    showToast('Dữ liệu đã được tải.');
  } catch (error) {
    console.error(error);
    if (config.useGoogleSheets) {
      config.useGoogleSheets = false;
      state.ordersFromSheets = false;
      showToast(error.message === 'ORDER_PAGINATION_UNAVAILABLE'
        ? 'Apps Script cần cập nhật để phân trang note. Đang dùng dữ liệu trên thiết bị này.'
        : 'Không thể kết nối Google Sheets. Đang dùng dữ liệu lưu trên thiết bị này.');
    }

    const saved = localStorage.getItem('order-notes-demo');
    const parsed = saved ? JSON.parse(saved) : { items: [], orders: [] };
    state.items = parsed.items || [];
    state.orders = parsed.orders || [];
    state.ordersTotal = state.orders.length;
    state.ordersPage = 1;
    state.ordersFromSheets = false;
    renderItemOptions();
    renderItemsTable();
    renderOrdersList();
  } finally {
    endBusy();
  }
}

async function fetchOrdersPage(page) {
  const response = await callSheetAction('listOrdersPage', {
    page,
    pageSize: ORDERS_PER_PAGE,
    paymentFilter: el.paymentFilter.value,
    customerSearch: state.customerSearchQuery,
    orderDate: state.ordersDateQuery,
    dateTimezoneOffsetMinutes: state.ordersDateTimezoneOffset
  });
  const result = response.data;
  if (!result || !Array.isArray(result.orders) || !Number.isFinite(Number(result.total))) {
    throw new Error('ORDER_PAGINATION_UNAVAILABLE');
  }

  state.orders = result.orders;
  state.ordersTotal = Number(result.total);
  state.ordersPage = Number(result.page) || page;
  state.ordersFromSheets = true;
  renderOrdersList();
}

async function loadOrdersPage(page) {
  if (!state.ordersFromSheets) {
    state.ordersPage = page;
    renderOrdersList();
    return;
  }

  await beginBusy('Đang tải note...');
  try {
    await fetchOrdersPage(page);
  } catch (error) {
    console.error(error);
    showToast(error.message === 'ORDER_PAGINATION_UNAVAILABLE'
      ? 'Apps Script chưa hỗ trợ phân trang. Hãy triển khai phiên bản mới.'
      : 'Không thể tải trang note này.');
  } finally {
    endBusy();
  }
}

function beginBusy(message) {
  state.busyCount += 1;
  el.loadingMessage.textContent = message;
  el.loadingOverlay.hidden = false;
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function endBusy() {
  state.busyCount = Math.max(0, state.busyCount - 1);
  el.loadingOverlay.hidden = state.busyCount === 0;
}

function persistLocalDemoData() {
  if (state.ordersFromSheets) return;
  localStorage.setItem('order-notes-demo', JSON.stringify({ items: state.items, orders: state.orders }));
}

async function saveItem(event) {
  event.preventDefault();
  const wasEditing = Boolean(state.editingItemId);

  const formData = new FormData(event.target);
  const rawItem = {
    id: state.editingItemId || `item-${Date.now()}`,
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

  await beginBusy('Đang lưu món hàng...');
  try {
    if (config.useGoogleSheets && config.scriptUrl && !config.scriptUrl.includes('PASTE')) {
      await callSheetAction('saveItem', { item });
    }

    const existingIndex = state.editingItemId
      ? state.items.findIndex((entry) => entry.id === state.editingItemId)
      : state.items.findIndex((entry) => entry.name.toLowerCase() === item.name.toLowerCase());
    if (existingIndex >= 0) {
      state.items[existingIndex] = { ...state.items[existingIndex], ...item };
    } else {
      state.items.push(item);
    }

    persistLocalDemoData();
    renderItemOptions();
    renderItemsTable();
    event.target.reset();
    showToast(wasEditing ? 'Đã cập nhật món hàng.' : 'Đã lưu món hàng.');
  } catch (error) {
    console.error(error);
    if (config.useGoogleSheets) {
      config.useGoogleSheets = false;
      showToast('Google Sheets bị chặn, đang lưu vào thiết bị.');
    } else {
      showToast('Không thể lưu món hàng.');
    }

    const existingIndex = state.editingItemId
      ? state.items.findIndex((entry) => entry.id === state.editingItemId)
      : state.items.findIndex((entry) => entry.name.toLowerCase() === item.name.toLowerCase());
    if (existingIndex >= 0) {
      state.items[existingIndex] = { ...state.items[existingIndex], ...item };
    } else {
      state.items.push(item);
    }

    persistLocalDemoData();
    renderItemOptions();
    renderItemsTable();
    event.target.reset();
  } finally {
    endBusy();
  }
}

function cancelItemEdit() {
  state.editingItemId = null;
  if (!el.itemFormTitle) return;
  el.itemFormTitle.textContent = 'Thêm món hàng';
  el.itemForm.querySelector('button[type="submit"]').textContent = 'Lưu món';
  el.cancelItemEdit.hidden = true;
}

function editItem(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;

  state.editingItemId = item.id;
  document.getElementById('item-name').value = item.name;
  document.getElementById('item-price').value = item.sellingPrice;
  document.getElementById('item-cost').value = item.cost;
  el.itemFormTitle.textContent = 'Chỉnh sửa món hàng';
  el.itemForm.querySelector('button[type="submit"]').textContent = 'Cập nhật món';
  el.cancelItemEdit.hidden = false;
  el.itemForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function scheduleCustomerSuggestions() {
  window.clearTimeout(state.customerSuggestionTimer);
  const query = el.pickupName.value.trim();
  if (!query) {
    state.customerSuggestionRequestId += 1;
    renderCustomerSuggestions([]);
    return;
  }

  state.customerSuggestionTimer = window.setTimeout(() => {
    loadCustomerSuggestions(query);
  }, 250);
}

async function loadCustomerSuggestions(query) {
  const requestId = ++state.customerSuggestionRequestId;
  try {
    let names;
    if (state.ordersFromSheets) {
      const response = await callSheetAction('searchCustomers', { query });
      if (!Array.isArray(response.data)) {
        throw new Error('CUSTOMER_SUGGESTIONS_INVALID');
      }
      names = response.data;
    } else {
      const search = query.toLowerCase();
      names = [...new Set(state.orders
        .map((order) => String(order.customerName || '').trim())
        .filter((name) => name && name.toLowerCase().includes(search)))]
        .slice(0, 10);
    }

    if (requestId !== state.customerSuggestionRequestId || query !== el.pickupName.value.trim()) return;
    renderCustomerSuggestions(names);
  } catch (error) {
    if (requestId !== state.customerSuggestionRequestId) return;
    console.error(error);
    showToast('Không thể tải gợi ý khách hàng.');
  }
}

function renderCustomerSuggestions(names) {
  el.customerSuggestions.replaceChildren();
  names.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    el.customerSuggestions.appendChild(option);
  });
}

function renderItemsTable() {
  el.itemTableBody.innerHTML = '';

  state.items.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td data-label="Tên món"><span class="table-cell-value">${escapeHtml(item.name)}</span></td>
      <td data-label="Giá bán"><span class="table-cell-value">${moneyFormatter.format(item.sellingPrice)}</span></td>
      <td data-label="Giá cost"><span class="table-cell-value">${moneyFormatter.format(item.cost)}</span></td>
      <td data-label="Thao tác"><div class="table-actions">
        <button class="edit-btn" type="button">Sửa</button>
        <button class="delete-btn" type="button">Xóa</button>
      </div></td>
    `;
    row.querySelector('.edit-btn').addEventListener('click', () => editItem(item.id));
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
  const shippingFee = Number(el.shippingFee.value || 0);

  if (state.cart.length === 0) {
    el.orderCart.innerHTML = '<p>Chưa có món nào trong đơn hàng.</p>';
    el.cartTotalRevenue.textContent = moneyFormatter.format(shippingFee);
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
        <strong>${escapeHtml(entry.name)}</strong>
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

  el.cartTotalRevenue.textContent = moneyFormatter.format(totalRevenue + shippingFee);
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

  const previousOrder = state.orders.find((entry) => entry.id === state.editingOrderId);
  const order = {
    id: state.editingOrderId || `order-${Date.now()}`,
    customerName,
    pickupTime: el.pickupTime.value || new Date().toISOString(),
    orderedAt: previousOrder ? previousOrder.orderedAt : new Date().toISOString(),
    transferPaid: el.transferPaid.value === 'true',
    shippingFee: Number(el.shippingFee.value || 0),
    notes: el.orderNotes.value.trim(),
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

  const wasRemote = state.ordersFromSheets;
  const wasEditing = Boolean(state.editingOrderId);
  await beginBusy(state.editingOrderId ? 'Đang cập nhật note...' : 'Đang lưu note...');
  try {
    let listRefreshFailed = false;
    if (wasRemote) {
      const saveResponse = await callSheetAction('saveOrder', { order });
      if (!wasEditing && !state.customerSearchQuery && !state.ordersDateQuery && el.paymentFilter.value === 'all') {
        const savedOrder = saveResponse.data || order;
        state.orders = [savedOrder, ...state.orders.filter((entry) => entry.id !== savedOrder.id)]
          .sort((left, right) => (
            (Date.parse(right.orderedAt || '') || 0) - (Date.parse(left.orderedAt || '') || 0) ||
            String(right.id).localeCompare(String(left.id))
          ))
          .slice(0, ORDERS_PER_PAGE);
        state.ordersTotal += 1;
        state.ordersPage = 1;
        renderOrdersList();
      } else {
        const targetPage = wasEditing ? state.ordersPage : 1;
        try {
          await fetchOrdersPage(targetPage);
        } catch (error) {
          console.error(error);
          listRefreshFailed = true;
        }
      }
    } else {
      const existingIndex = state.orders.findIndex((entry) => entry.id === order.id);
      if (existingIndex >= 0) {
        state.orders[existingIndex] = order;
      } else {
        state.orders.push(order);
      }
      state.ordersPage = 1;
      persistLocalDemoData();
      renderOrdersList();
    }

    state.cart = [];
    state.editingOrderId = null;
    el.orderForm.reset();
    renderCart();
    resetOrderEditControls();
    hydrateDateInputs();
    showToast(listRefreshFailed
      ? 'Đã lưu note nhưng chưa tải lại danh sách. Hãy bấm Đồng bộ dữ liệu.'
      : wasRemote && wasEditing
        ? 'Đã cập nhật note bán hàng.'
        : 'Đã lưu note bán hàng.');
  } catch (error) {
    console.error(error);
    if (wasRemote) {
      showToast('Không thể lưu note lên Google Sheets. Thông tin vẫn còn trên form.');
      return;
    }

    if (config.useGoogleSheets) {
      config.useGoogleSheets = false;
    }
    showToast('Không thể lưu note bán hàng.');

    const existingIndex = state.orders.findIndex((entry) => entry.id === order.id);
    if (existingIndex >= 0) {
      state.orders[existingIndex] = order;
    } else {
      state.orders.push(order);
      state.ordersPage = 1;
    }
    persistLocalDemoData();
    state.cart = [];
    state.editingOrderId = null;
    el.orderForm.reset();
    renderCart();
    renderOrdersList();
    renderStats();
    resetOrderEditControls();
    hydrateDateInputs();
  } finally {
    endBusy();
  }
}

async function deleteOrder(orderId) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order || !window.confirm(`Bạn có chắc muốn xóa note của "${order.customerName}" không?`)) return;

  const wasRemote = state.ordersFromSheets;
  let deletedRemotely = false;
  await beginBusy('Đang xóa note bán hàng...');
  try {
    if (wasRemote) {
      const result = await callSheetAction('deleteOrder', { orderId });
      if (!result.data || !result.data.deleted) {
        throw new Error('Google Sheets không tìm thấy note cần xóa.');
      }
      deletedRemotely = true;
      await fetchOrdersPage(state.ordersPage);
    } else {
      state.orders = state.orders.filter((entry) => entry.id !== orderId);
      persistLocalDemoData();
      renderOrdersList();
    }

    showToast('Đã xóa note bán hàng.');
  } catch (error) {
    console.error(error);
    if (deletedRemotely) {
      state.orders = state.orders.filter((entry) => entry.id !== orderId);
      state.ordersTotal = Math.max(0, state.ordersTotal - 1);
      renderOrdersList();
      showToast('Đã xóa note nhưng chưa tải lại trang. Hãy bấm Đồng bộ dữ liệu.');
    } else {
      showToast('Không thể xóa note trên Google Sheets. Note vẫn được giữ lại.');
    }
  } finally {
    endBusy();
  }
}

function renderOrdersList() {
  el.ordersList.innerHTML = '';

  const filteredOrders = state.ordersFromSheets
    ? [...state.orders]
    : state.orders.filter((order) => (
      matchesPaymentFilter(order) &&
      matchesCustomerSearch(order) &&
      matchesOrderDate(order)
    ));
  const sortedOrders = filteredOrders.sort((left, right) => {
    const leftTime = Date.parse(left.orderedAt || '') || 0;
    const rightTime = Date.parse(right.orderedAt || '') || 0;
    return rightTime - leftTime || String(right.id).localeCompare(String(left.id));
  });
  const totalOrders = state.ordersFromSheets ? state.ordersTotal : sortedOrders.length;
  const pageCount = Math.max(1, Math.ceil(totalOrders / ORDERS_PER_PAGE));
  state.ordersPage = Math.min(Math.max(state.ordersPage, 1), pageCount);
  el.ordersPagination.hidden = totalOrders <= ORDERS_PER_PAGE;
  el.ordersPageInfo.textContent = `Trang ${state.ordersPage}/${pageCount} · ${totalOrders} note`;
  el.ordersPrev.disabled = state.ordersPage === 1;
  el.ordersNext.disabled = state.ordersPage === pageCount;

  if (sortedOrders.length === 0) {
    el.ordersList.innerHTML = '<p>Không có note phù hợp.</p>';
    return;
  }

  const pageStart = (state.ordersPage - 1) * ORDERS_PER_PAGE;
  const pageOrders = state.ordersFromSheets
    ? sortedOrders
    : sortedOrders.slice(pageStart, pageStart + ORDERS_PER_PAGE);
  pageOrders.forEach((order) => {
    const card = document.createElement('div');
    card.className = 'order-card';
    const pickupDate = order.pickupTime ? new Date(order.pickupTime) : null;
    const pickupDateText = pickupDate && !Number.isNaN(pickupDate.getTime())
      ? `Thời gian lấy: ${formatDisplayDate(pickupDate)}`
      : '';

    card.innerHTML = `
      <div class="order-top">
        <div>
          <strong>Khách: ${escapeHtml(order.customerName)}</strong>
          ${pickupDateText ? `<div><small>${escapeHtml(pickupDateText)}</small></div>` : ''}
        </div>
        <div>
          <strong>${moneyFormatter.format(getOrderTotal(order))}</strong>
        </div>
      </div>
      <div class="order-status ${isTransferPaid(order) ? 'paid' : 'unpaid'}">
        Chuyển khoản: ${isTransferPaid(order) ? 'Đã nhận' : 'Chưa nhận'}
      </div>
      ${order.notes ? `<p class="order-note"><strong>Ghi chú:</strong> ${escapeHtml(order.notes).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="order-items">
        ${order.items
          .map(
            (item) => `
              <div class="order-item-line">
                <span><strong>${escapeHtml(item.name)}</strong> x${item.quantity}</span>
                <span>${moneyFormatter.format(item.quantity * item.sellingPrice)}</span>
              </div>
            `
          )
          .join('')}
      </div>
      <div class="order-item-line" style="margin-top: 12px;">
        <span>Phí ship</span>
        <span>${moneyFormatter.format(order.shippingFee || 0)}</span>
      </div>
      <div class="order-item-line" style="margin-top: 12px;">
        <span>Lợi nhuận</span>
        <strong>${moneyFormatter.format(order.profit)}</strong>
      </div>
      <div class="form-actions order-actions">
        <button class="bill-btn" type="button">Xem bill</button>
        <button class="edit-btn" type="button">Sửa note</button>
        <button class="delete-btn" type="button">Xóa note</button>
      </div>
    `;

    card.querySelector('.bill-btn').addEventListener('click', () => showBill(order.id));
    card.querySelector('.edit-btn').addEventListener('click', () => editOrder(order.id));
    card.querySelector('.delete-btn').addEventListener('click', () => deleteOrder(order.id));
    el.ordersList.appendChild(card);
  });
}

function changeOrdersPage(direction) {
  loadOrdersPage(state.ordersPage + direction);
}

function searchOrders() {
  state.customerSearchQuery = el.customerSearch.value.trim();
  state.ordersDateQuery = el.ordersDateFilter.value;
  state.ordersDateTimezoneOffset = getDateTimezoneOffset(state.ordersDateQuery);
  state.ordersPage = 1;
  if (state.ordersFromSheets) {
    loadOrdersPage(1);
  } else {
    renderOrdersList();
  }
}

function matchesPaymentFilter(order) {
  if (el.paymentFilter.value === 'paid') return isTransferPaid(order);
  if (el.paymentFilter.value === 'unpaid') return !isTransferPaid(order);
  return true;
}

function matchesCustomerSearch(order) {
  const search = state.customerSearchQuery.toLowerCase();
  return !search || String(order.customerName || '').toLowerCase().includes(search);
}

function matchesOrderDate(order) {
  if (!state.ordersDateQuery) return true;
  const date = new Date(order.pickupTime);
  if (Number.isNaN(date.getTime())) return false;
  return formatLocalDate(date) === state.ordersDateQuery;
}

function getDateTimezoneOffset(dateValue) {
  if (!dateValue) return 0;
  const datePart = /^\d{4}$/.test(dateValue)
    ? `${dateValue}-01-01`
    : /^\d{4}-\d{2}$/.test(dateValue)
      ? `${dateValue}-01`
      : dateValue;
  return new Date(`${datePart}T12:00:00`).getTimezoneOffset();
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getOrderTotal(order) {
  return Number(order.totalRevenue || 0) + Number(order.shippingFee || 0);
}

function showBill(orderId) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) return;
  state.activeBillId = order.id;

  const itemRows = order.items.map((item, index) => {
    const quantity = Number(item.quantity || 0);
    const amount = quantity * Number(item.sellingPrice || 0);
    return `
      <tr>
        <td>${index + 1}</td>
        <td class="bill-item-name">${escapeHtml(item.name)}<small>${moneyFormatter.format(item.sellingPrice)} / món</small></td>
        <td>${quantity}</td>
        <td class="bill-amount">${moneyFormatter.format(amount)}</td>
      </tr>
    `;
  }).join('');

  const pickupTime = order.pickupTime ? formatBillDate(order.pickupTime) : '';
  el.billPreview.innerHTML = `
    <header class="bill-header">
      <h1 id="bill-title">BẾP NHÀ MÍA</h1>
      <p>HÓA ĐƠN BÁN HÀNG</p>
    </header>
    <div class="bill-customer"><span>Khách hàng</span><strong>${escapeHtml(order.customerName)}</strong></div>
    ${pickupTime ? `<p class="bill-meta">Thời gian: ${pickupTime}</p>` : ''}
    ${order.notes ? `<p class="bill-note"><strong>Ghi chú:</strong> ${escapeHtml(order.notes).replace(/\n/g, '<br>')}</p>` : ''}
    <table class="bill-table">
      <thead>
        <tr><th>#</th><th>Món</th><th>SL</th><th>Thành tiền</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="bill-shipping"><span>Phí ship</span><strong>${moneyFormatter.format(order.shippingFee || 0)}</strong></div>
    <div class="bill-total"><span>Tổng cộng</span><strong>${moneyFormatter.format(getOrderTotal(order))}</strong></div>
    <div class="bill-qr">
      <p>Mã QR chuyển khoản</p>
      <img src="./bank.jpg" alt="Mã QR chuyển khoản Bếp Nhà Mía" />
      <p class="bill-image-error" hidden>Không tải được bank.jpg. Hãy đảm bảo file này đã được đưa lên website.</p>
    </div>
    <footer class="bill-thanks">
      <strong>Cảm ơn quý khách!</strong>
      <p>Bếp Nhà Mía rất vui được phục vụ quý khách.<br>Hẹn gặp lại lần sau ạ.</p>
    </footer>
  `;

  const qrImage = el.billPreview.querySelector('img');
  const showQrError = () => {
    el.billPreview.querySelector('.bill-image-error').hidden = false;
  };
  if (qrImage.complete) {
    if (qrImage.naturalWidth === 0) showQrError();
  } else {
    qrImage.addEventListener('error', showQrError, { once: true });
  }
  el.billModal.hidden = false;
  document.body.classList.add('bill-modal-open');
  el.closeBill.focus();
}

function closeBill() {
  el.billModal.hidden = true;
  document.body.classList.remove('bill-modal-open');
  state.activeBillId = null;
}

async function downloadBillImage() {
  const order = state.orders.find((entry) => entry.id === state.activeBillId);
  if (!order) return;

  await beginBusy('Đang tạo ảnh bill...');
  try {
    const qrImage = el.billPreview.querySelector('img');
    if (!qrImage || !qrImage.complete || qrImage.naturalWidth === 0) {
      throw new Error('QR_IMAGE_NOT_LOADED');
    }

    const canvas = createBillCanvas(order, qrImage);
    const imageBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!imageBlob) throw new Error('IMAGE_EXPORT_FAILED');

    const downloadUrl = URL.createObjectURL(imageBlob);
    const link = document.createElement('a');
    const safeCustomerName = String(order.customerName || 'khach')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .trim();
    link.href = downloadUrl;
    link.download = `bill-${safeCustomerName || 'khach'}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    showToast('Đã tải ảnh bill xuống máy.');
  } catch (error) {
    console.error(error);
    if (error.message === 'QR_IMAGE_NOT_LOADED') {
      showToast('Chưa tải được mã QR. Hãy đưa bank.jpg lên website rồi thử lại.');
    } else {
      showToast('Không thể tạo ảnh bill.');
    }
  } finally {
    endBusy();
  }
}

function createBillCanvas(order, qrImage) {
  const width = 900;
  const padding = 56;
  const contentWidth = width - padding * 2;
  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 1200;
  let context = canvas.getContext('2d');
  let y = padding;

  function ensureHeight(height) {
    if (height <= canvas.height) return;
    const expanded = document.createElement('canvas');
    expanded.width = width;
    expanded.height = Math.max(height, canvas.height * 2);
    expanded.getContext('2d').drawImage(canvas, 0, 0);
    canvas = expanded;
    context = canvas.getContext('2d');
  }

  function writeText(text, x, baseline, maxWidth, font, color = '#111827', align = 'left', lineHeight = 32) {
    context.font = font;
    const lines = wrapCanvasText(context, text, maxWidth);
    lines.forEach((line) => {
      ensureHeight(baseline + lineHeight);
      context.font = font;
      context.fillStyle = color;
      context.textAlign = align;
      context.fillText(line, x, baseline, maxWidth);
      baseline += lineHeight;
    });
    return baseline;
  }

  function drawRule() {
    ensureHeight(y + 12);
    context.strokeStyle = '#94a3b8';
    context.setLineDash([8, 6]);
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
    context.setLineDash([]);
    y += 22;
  }

  y = writeText('BẾP NHÀ MÍA', width / 2, y + 42, contentWidth, 'bold 42px Arial', '#111827', 'center', 48);
  y = writeText('HÓA ĐƠN BÁN HÀNG', width / 2, y + 4, contentWidth, 'bold 26px Arial', '#334155', 'center', 34);
  y += 12;
  drawRule();
  y = writeText('Khách hàng', padding, y, contentWidth, '22px Arial', '#475569', 'left', 30);
  y = writeText(order.customerName || '', padding, y + 2, contentWidth, 'bold 28px Arial', '#111827', 'left', 36);

  const pickupTime = order.pickupTime ? formatBillDate(order.pickupTime) : '';
  if (pickupTime) y = writeText(`Thời gian: ${pickupTime}`, padding, y + 4, contentWidth, '20px Arial', '#475569', 'left', 28);
  if (order.notes) {
    y = writeText('Ghi chú', padding, y + 4, contentWidth, 'bold 20px Arial', '#475569', 'left', 28);
    y = writeText(order.notes, padding, y, contentWidth, '20px Arial', '#111827', 'left', 28);
  }
  y += 8;
  drawRule();

  const indexX = padding;
  const nameX = padding + 54;
  const quantityX = width - padding - 188;
  const amountX = width - padding;
  const itemNameWidth = quantityX - nameX - 36;
  ensureHeight(y + 50);
  context.font = 'bold 20px Arial';
  context.fillStyle = '#334155';
  context.textAlign = 'left';
  context.fillText('Món', nameX, y);
  context.textAlign = 'center';
  context.fillText('SL', quantityX, y);
  context.textAlign = 'right';
  context.fillText('Thành tiền', amountX, y);
  y += 40;
  context.strokeStyle = '#e2e8f0';
  context.beginPath();
  context.moveTo(padding, y - 10);
  context.lineTo(width - padding, y - 10);
  context.stroke();

  order.items.forEach((item, index) => {
    const quantity = Number(item.quantity || 0);
    context.font = '24px Arial';
    const itemLines = wrapCanvasText(context, item.name, itemNameWidth);
    const rowHeight = Math.max(70, 30 * itemLines.length + 52);
    ensureHeight(y + rowHeight + 12);
    const rowStart = y;
    context.textAlign = 'left';
    context.fillStyle = '#111827';
    context.font = '20px Arial';
    context.fillText(String(index + 1), indexX, rowStart + 25);
    itemLines.forEach((line, lineIndex) => {
      context.fillText(line, nameX, rowStart + 25 + lineIndex * 30, itemNameWidth);
    });
    context.fillStyle = '#64748b';
    context.font = '16px Arial';
    context.fillText(`${moneyFormatter.format(item.sellingPrice)} / món`, nameX, rowStart + 25 + itemLines.length * 30);
    context.fillStyle = '#111827';
    context.font = '20px Arial';
    context.textAlign = 'center';
    context.fillText(String(quantity), quantityX, rowStart + 25);
    context.textAlign = 'right';
    context.fillText(moneyFormatter.format(quantity * Number(item.sellingPrice || 0)), amountX, rowStart + 25);
    y += rowHeight;
    context.strokeStyle = '#e2e8f0';
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
    y += 12;
  });

  y = writeText('Phí ship', padding, y + 20, contentWidth / 2, '22px Arial', '#475569', 'left', 30);
  context.textAlign = 'right';
  context.font = '22px Arial';
  context.fillStyle = '#111827';
  context.fillText(moneyFormatter.format(order.shippingFee || 0), amountX, y - 30);
  y = writeText('Tổng cộng', padding, y + 18, contentWidth / 2, 'bold 26px Arial', '#111827', 'left', 34);
  context.textAlign = 'right';
  context.font = 'bold 28px Arial';
  context.fillStyle = '#111827';
  context.fillText(moneyFormatter.format(getOrderTotal(order)), amountX, y - 34);
  y += 14;
  drawRule();
  y = writeText('Mã QR chuyển khoản', width / 2, y + 18, contentWidth, 'bold 24px Arial', '#111827', 'center', 32);

  const qrWidth = Math.min(460, contentWidth);
  const qrHeight = qrWidth * qrImage.naturalHeight / qrImage.naturalWidth;
  ensureHeight(y + qrHeight + 20);
  context.drawImage(qrImage, (width - qrWidth) / 2, y, qrWidth, qrHeight);
  y += qrHeight + 24;
  y = writeText('Cảm ơn quý khách!', width / 2, y, contentWidth, 'bold 28px Arial', '#111827', 'center', 36);
  writeText('Bếp Nhà Mía rất vui được phục vụ quý khách. Hẹn gặp lại lần sau ạ.', width / 2, y + 4, contentWidth, '20px Arial', '#475569', 'center', 28);

  const output = document.createElement('canvas');
  output.width = width;
  output.height = y + padding + 40;
  const outputContext = output.getContext('2d');
  outputContext.fillStyle = '#fff';
  outputContext.fillRect(0, 0, output.width, output.height);
  const contentHeight = Math.min(canvas.height, output.height);
  outputContext.drawImage(canvas, 0, 0, width, contentHeight, 0, 0, width, contentHeight);
  return output;
}

function wrapCanvasText(context, value, maxWidth) {
  const words = String(value || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function formatBillDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatDisplayDate(date);
}

function editOrder(orderId) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order) return;

  state.editingOrderId = order.id;
  state.cart = order.items.map((item) => ({ ...item }));
  el.pickupName.value = order.customerName;
  el.pickupTime.value = order.pickupTime ? toLocalDateTimeInputValue(new Date(order.pickupTime)) : '';
  el.transferPaid.value = String(isTransferPaid(order));
  el.shippingFee.value = Number(order.shippingFee || 0);
  el.orderNotes.value = order.notes || '';
  el.orderFormTitle.textContent = 'Chỉnh sửa note bán hàng';
  el.orderForm.querySelector('button[type="submit"]').textContent = 'Cập nhật note';
  el.cancelOrderEdit.hidden = false;
  renderCart();
  switchTab('orders-section');
  el.orderForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelOrderEdit() {
  state.editingOrderId = null;
  state.cart = [];
  el.orderForm.reset();
  resetOrderEditControls();
  renderCart();
  hydrateDateInputs();
}

function resetOrderEditControls() {
  el.orderFormTitle.textContent = 'Ghi note bán hàng';
  el.orderForm.querySelector('button[type="submit"]').textContent = 'Lưu note bán hàng';
  el.cancelOrderEdit.hidden = true;
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

async function renderStats() {
  const range = el.statsRange.value;
  const filterValue = el.statsDate.value;

  if (state.ordersFromSheets) {
    await beginBusy('Đang tải thống kê...');
    try {
      const response = await callSheetAction('getStats', {
        range,
        value: filterValue,
        dateTimezoneOffsetMinutes: getDateTimezoneOffset(filterValue)
      });
      renderStatsSummary(response.data || {});
    } catch (error) {
      console.error(error);
      showToast('Không thể tải thống kê từ Google Sheets.');
    } finally {
      endBusy();
    }
    return;
  }

  const filteredOrders = state.orders.filter((order) => matchesRange(order.pickupTime, range, filterValue));

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.totalRevenue || 0), 0);
  const totalCost = filteredOrders.reduce((sum, order) => sum + Number(order.totalCost || 0), 0);
  const totalProfit = filteredOrders.reduce((sum, order) => sum + Number(order.profit || 0), 0);

  renderStatsSummary({
    revenue: totalRevenue,
    cost: totalCost,
    profit: totalProfit,
    orders: filteredOrders.length,
    items: aggregateStats(filteredOrders, (order) => order.items.map((item) => ({
      name: item.name,
      value: Number(item.quantity || 0) * Number(item.sellingPrice || 0)
    }))),
    customers: aggregateStats(filteredOrders, (order) => [{
      name: order.customerName || 'Chưa rõ',
      value: Number(order.totalRevenue || 0)
    }])
  });
}

function renderStatsSummary(stats) {
  el.statRevenue.textContent = moneyFormatter.format(Number(stats.revenue || 0));
  el.statCost.textContent = moneyFormatter.format(Number(stats.cost || 0));
  el.statProfit.textContent = moneyFormatter.format(Number(stats.profit || 0));
  el.statOrders.textContent = String(Number(stats.orders || 0));
  renderBarChart(el.itemStatsChart, Array.isArray(stats.items) ? stats.items : []);
  renderBarChart(el.customerStatsChart, Array.isArray(stats.customers) ? stats.customers : []);
}

function aggregateStats(orders, getEntries) {
  const totals = new Map();
  orders.forEach((order) => {
    getEntries(order).forEach(({ name, value }) => {
      totals.set(name, (totals.get(name) || 0) + value);
    });
  });
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

function renderBarChart(container, entries) {
  container.innerHTML = '';
  if (entries.length === 0) {
    container.innerHTML = '<p>Chưa có dữ liệu trong khoảng thời gian này.</p>';
    return;
  }

  const maxValue = entries[0].value || 1;
  entries.forEach(({ name, value }) => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = name;
    const track = document.createElement('div');
    track.className = 'bar-track';
    const bar = document.createElement('div');
    bar.className = 'bar-fill';
    bar.style.width = `${Math.max((value / maxValue) * 100, 2)}%`;
    bar.setAttribute('aria-label', `${name}: ${moneyFormatter.format(value)}`);
    track.appendChild(bar);
    const amount = document.createElement('strong');
    amount.textContent = moneyFormatter.format(value);
    row.append(label, track, amount);
    container.appendChild(row);
  });
}

function isTransferPaid(order) {
  return order.transferPaid === true || order.transferPaid === 'true' || order.transferPaid === 'yes';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function matchesRange(dateValue, range, filterValue) {
  if (!dateValue) return true;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  if (!filterValue) return true;

  if (range === 'day') {
    return formatLocalDate(date) === filterValue;
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
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
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
