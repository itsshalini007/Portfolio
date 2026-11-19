import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { createSupabaseCompat } from "./supabase-compat.js";
import { supabaseConfig } from "./supabase-config.js";
const loginScreen = document.querySelector("#admin-login-screen");
const loginForm = document.querySelector("#admin-login-form");
const loginAlert = document.querySelector("#admin-login-alert");
const appShell = document.querySelector("#admin-shell");
const notice = document.querySelector("#admin-notice");
const setupBanner = document.querySelector("#admin-setup-banner");
const productForm = document.querySelector("#product-form");
const categoryForm = document.querySelector("#category-form");
const productTableBody = document.querySelector("#product-table-body");
const categoryList = document.querySelector("#category-list");
const ordersTableBody = document.querySelector("#orders-table-body");
const inventoryTableBody = document.querySelector("#inventory-table-body");
const customersTableBody = document.querySelector("#customers-table-body");
const confirmBackdrop = document.querySelector("#admin-confirm-backdrop");
const missingConfig = !isSupabaseConfigured();

let auth = null;
let db = null;
let storage = null;
let sdk = null;
let activeAdmin = null;
let products = [];
let categories = [];
let orders = [];
let customers = [];
let currentImagePreviewUrl = null;
let currentCategoryPreviewUrl = null;
let confirmResolver = null;
let alertTimer = null;

function renderDeliverySettings(data, isSaved) {
  document.querySelector("#store-name").value = data.storeName || "Inder General Store";
  document.querySelector("#store-address").value = data.address || "KH-1047, Kadipur, New Delhi, Delhi, 110036, India";
  document.querySelector("#store-phone").value = data.phone || "9289648518";
  document.querySelector("#store-alternate-phone").value = data.alternatePhone || "8882494580";
  document.querySelector("#store-email").value = data.email || "itsshalini007@gmail.com";
  document.querySelector("#store-opening-days").value = data.openingDays || "Monday to Sunday";
  document.querySelector("#store-opening-time").value = data.openingTime || "6:00 AM";
  document.querySelector("#store-closing-time").value = data.closingTime || "10:00 PM";
  document.querySelector("#store-delivery-area").value = data.deliveryArea || "Kadipur and nearby areas";
  document.querySelector("#store-delivery-schedule").value = data.deliverySchedule || "Same-day delivery";
  document.querySelector("#store-minimum-order").value = data.minimumOrder == null ? "" : String(data.minimumOrder);
  document.querySelector("#delivery-available").checked = data.deliveryAvailable !== false;
  const charge = Number(data.deliveryCharge);
  document.querySelector("#delivery-charge").value = data.deliveryCharge !== null
    && data.deliveryCharge !== undefined && Number.isFinite(charge) && charge >= 0
    ? String(charge)
    : "";
  document.querySelector("#delivery-settings-note").textContent = isSaved
    ? "Saved store settings are loaded from Supabase."
    : "No saved store settings. Confirmed store information is shown to customers until settings are saved.";
}

async function loadDeliverySettings() {
  if (!activeAdmin || !db) return;
  try {
    const snapshot = await sdk.getDoc(sdk.doc(db, "storeSettings", "delivery"));
    renderDeliverySettings(snapshot.exists() ? snapshot.data() : {
      deliveryAvailable: true,
      deliveryCharge: null
    }, snapshot.exists());
  } catch (error) {
    console.error("Could not load delivery settings.", error);
    document.querySelector("#delivery-settings-note").textContent = `Delivery settings could not be loaded. ${formatError(error)}`;
    showNotice(`Delivery settings could not be loaded. ${formatError(error)}`, "error", 0);
  }
}

async function saveDeliverySettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!activeAdmin || !db || !sdk) {
    showNotice("Sign in as an authorized administrator before saving delivery settings.", "error");
    return;
  }
  if (!form.reportValidity()) return;

  const chargeInput = document.querySelector("#delivery-charge");
  const deliveryCharge = chargeInput.value.trim() === "" ? null : Number(chargeInput.value);
  if (deliveryCharge !== null && (!Number.isFinite(deliveryCharge) || deliveryCharge < 0)) {
    showNotice("Enter a valid non-negative delivery charge or leave it blank until confirmed.", "error");
    return;
  }
  const minimumOrderInput = document.querySelector("#store-minimum-order");
  const minimumOrder = minimumOrderInput.value.trim() === "" ? null : Number(minimumOrderInput.value);
  if (minimumOrder !== null && (!Number.isFinite(minimumOrder) || minimumOrder < 0)) {
    showNotice("Enter a valid minimum order amount or leave it blank.", "error");
    return;
  }

  const button = document.querySelector("#save-delivery-settings");
  setBusy(button, true, "Saving settings...");
  try {
    await sdk.setDoc(sdk.doc(db, "storeSettings", "delivery"), {
      storeName: document.querySelector("#store-name").value.trim(),
      address: document.querySelector("#store-address").value.trim(),
      phone: document.querySelector("#store-phone").value.trim(),
      alternatePhone: document.querySelector("#store-alternate-phone").value.trim(),
      email: document.querySelector("#store-email").value.trim(),
      openingDays: document.querySelector("#store-opening-days").value.trim(),
      openingTime: document.querySelector("#store-opening-time").value.trim(),
      closingTime: document.querySelector("#store-closing-time").value.trim(),
      deliveryArea: document.querySelector("#store-delivery-area").value.trim(),
      deliverySchedule: document.querySelector("#store-delivery-schedule").value.trim(),
      minimumOrder,
      deliveryAvailable: document.querySelector("#delivery-available").checked,
      deliveryCharge,
      updatedAt: sdk.serverTimestamp()
    });
    document.querySelector("#delivery-settings-note").textContent = "Store settings saved. The customer pages will update from Supabase.";
    showNotice("Delivery settings saved.", "success");
  } catch (error) {
    console.error("Could not save delivery settings.", error);
    showNotice(`Delivery settings could not be saved. ${formatError(error)}`, "error", 0);
  } finally {
    setBusy(button, false);
  }
}

function showNotice(message, type = "success", timeout = 5000) {
  window.clearTimeout(alertTimer);
  notice.textContent = message;
  notice.className = `admin-notice is-${type}`;
  notice.hidden = false;
  if (timeout > 0) {
    alertTimer = window.setTimeout(() => {
      notice.hidden = true;
    }, timeout);
  }
}

function setLoginMessage(message, isError = false) {
  loginAlert.textContent = message;
  loginAlert.classList.toggle("is-error", isError);
  loginAlert.hidden = !message;
}

function setBusy(button, busy, busyText = "Please wait...") {
  if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.defaultText;
}

function formatError(error) {
  const knownErrors = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/too-many-requests": "Too many sign-in attempts. Wait a little and try again.",
    "auth/user-disabled": "This administrator account is disabled.",
    "permission-denied": "Supabase denied this operation. Confirm your Admin role and deployed Row Level Security policies.",
    "storage/unauthorized": "Supabase Storage denied this operation. Confirm your Admin role and Storage policies."
  };
  return knownErrors[error?.code] || error?.message || "The request could not be completed.";
}

function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : value instanceof Date ? value : null;
  return date && !Number.isNaN(date.valueOf())
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "—";
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—";
}

function statusClass(value) {
  return String(value || "pending").toLowerCase().replace(/[^a-z]+/g, "-");
}

function setStatusLabel(cell, value) {
  const status = makeElement("span", `admin-status admin-status--${statusClass(value)}`, String(value || "Pending").replace(/-/g, " "));
  cell.replaceChildren(status);
}

function categoryName(id) {
  return categories.find((category) => category.id === id)?.name || "Uncategorized";
}

function setView(name) {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("is-visible", panel.dataset.viewPanel === name);
  });
  document.querySelectorAll(".admin-nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === name);
  });
  const selected = document.querySelector(`[data-view-panel="${CSS.escape(name)}"]`);
  document.querySelector("#admin-page-title").textContent = selected
    ? ({ "add-product": document.querySelector("#product-id").value ? "Edit product" : "Add new product" }[name] || name.replace(/(^|-)(\w)/g, (_, separator, letter) => `${separator ? " " : ""}${letter.toUpperCase()}`))
    : "Dashboard";
  document.querySelector("#admin-sidebar").classList.remove("is-open");
  document.querySelector("#admin-menu-toggle").setAttribute("aria-expanded", "false");
}

function showConfirm(message, title = "Delete this item?") {
  document.querySelector("#confirm-title").textContent = title;
  document.querySelector("#confirm-message").textContent = message;
  confirmBackdrop.hidden = false;
  document.querySelector("#confirm-cancel").focus();
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirm(confirmed) {
  confirmBackdrop.hidden = true;
  if (confirmResolver) confirmResolver(confirmed);
  confirmResolver = null;
}

function validateImage(file) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image files must be 5 MB or smaller.");
}

function fileExtension(file) {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type];
}

async function uploadImage(file, folder, documentId) {
  validateImage(file);
  const path = `${folder}/${documentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExtension(file)}`;
  const imageRef = sdk.storageRef(storage, path);
  await sdk.uploadBytes(imageRef, file, { contentType: file.type });
  return { path, url: await sdk.getDownloadURL(imageRef) };
}

async function removeImage(path) {
  if (!path) return;
  await sdk.deleteObject(sdk.storageRef(storage, path));
}

function imageCell(url, name, placeholderClass = "admin-product-placeholder") {
  if (url) {
    const image = makeElement("img");
    image.src = url;
    image.alt = "";
    image.loading = "lazy";
    image.onerror = () => {
      image.replaceWith(makeElement("span", placeholderClass, "▧"));
    };
    return image;
  }
  return makeElement("span", placeholderClass, name.slice(0, 1).toUpperCase());
}

function filteredProducts() {
  const search = document.querySelector("#product-search").value.trim().toLocaleLowerCase();
  const categoryId = document.querySelector("#product-category-filter").value;
  const stockFilter = document.querySelector("#product-stock-filter").value;
  const threshold = Number(document.querySelector("#low-stock-threshold").value) || 0;
  return products.filter((product) => {
    const matchesText = !search || `${product.name} ${product.brand || ""}`.toLocaleLowerCase().includes(search);
    const matchesCategory = !categoryId || product.categoryId === categoryId;
    const stock = Number(product.stockQuantity) || 0;
    const matchesStock = !stockFilter
      || (stockFilter === "in" && stock > threshold)
      || (stockFilter === "low" && stock > 0 && stock <= threshold)
      || (stockFilter === "out" && stock === 0);
    return matchesText && matchesCategory && matchesStock;
  });
}

function renderProductRows() {
  productTableBody.replaceChildren();
  const matches = filteredProducts();
  for (const product of matches) {
    const row = document.createElement("tr");
    const productCell = makeElement("td");
    const productInfo = makeElement("div", "admin-product-cell");
    productInfo.append(imageCell(product.imageUrl, product.name));
    const productText = makeElement("span");
    productText.append(makeElement("strong", "", product.name), makeElement("small", "", product.brand || "No brand"));
    productInfo.append(productText);
    productCell.append(productInfo);
    const categoryCell = makeElement("td", "", categoryName(product.categoryId));
    const priceCell = makeElement("td", "", `${money(product.price)}${Number(product.mrp) > Number(product.price) ? ` · ${money(product.mrp)} MRP` : ""}`);
    const stockCell = makeElement("td");
    const stock = Number(product.stockQuantity) || 0;
    setStatusLabel(stockCell, stock === 0 ? "Out of stock" : stock <= (Number(document.querySelector("#low-stock-threshold").value) || 0) ? "Low stock" : "In stock");
    const productStatus = makeElement("td");
    setStatusLabel(productStatus, product.status);
    const actions = makeElement("td");
    const actionWrap = makeElement("div", "admin-row-actions");
    const edit = makeElement("button", "", "Edit");
    edit.type = "button";
    edit.dataset.editProduct = product.id;
    const toggle = makeElement("button", "", product.status === "active" ? "Deactivate" : "Activate");
    toggle.type = "button";
    toggle.dataset.toggleProduct = product.id;
    const remove = makeElement("button", "", "Delete");
    remove.type = "button";
    remove.dataset.deleteProduct = product.id;
    actionWrap.append(edit, toggle, remove);
    actions.append(actionWrap);
    row.append(productCell, categoryCell, priceCell, stockCell, productStatus, actions);
    productTableBody.append(row);
  }
  document.querySelector("#products-empty").hidden = matches.length > 0;
}

function renderCategoryRows() {
  categoryList.replaceChildren();
  for (const category of categories) {
    const row = makeElement("article", "admin-category-row");
    row.append(category.imageUrl
      ? imageCell(category.imageUrl, category.name, "admin-category-placeholder")
      : makeElement("span", "admin-category-placeholder", category.icon || category.name.slice(0, 1).toUpperCase()));
    const info = makeElement("div");
    const count = products.filter((product) => product.categoryId === category.id).length;
    info.append(makeElement("strong", "", category.name), makeElement("small", "", `${count} ${count === 1 ? "product" : "products"}`));
    const actions = makeElement("div", "admin-row-actions");
    const edit = makeElement("button", "", "Edit");
    edit.type = "button";
    edit.dataset.editCategory = category.id;
    const remove = makeElement("button", "", "Delete");
    remove.type = "button";
    remove.dataset.deleteCategory = category.id;
    actions.append(edit, remove);
    row.append(info, actions);
    categoryList.append(row);
  }
  document.querySelector("#categories-empty").hidden = categories.length > 0;
}

function itemSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return "Items unavailable";
  return items.slice(0, 3).map((item) => {
    const name = typeof item.name === "string" ? item.name : "Item";
    const quantity = Number(item.quantity);
    return `${name}${quantity > 0 ? ` × ${quantity}` : ""}`;
  }).join(", ") + (items.length > 3 ? ` +${items.length - 3} more` : "");
}

function orderCustomer(order) {
  return order.customerName || order.customer?.name || "Customer";
}

function orderPhone(order) {
  return order.mobileNumber || order.phoneNumber || order.customer?.phone || "—";
}

function orderAddress(order) {
  const address = order.deliveryAddress || order.address;
  if (typeof address === "string") return address;
  if (address && typeof address === "object") {
    return [address.address, address.city, address.pincode].filter(Boolean).join(", ") || "—";
  }
  return "—";
}

function createOrderStatusSelect(order) {
  const select = makeElement("select", "admin-inline-select");
  select.setAttribute("aria-label", `Update status for ${order.orderId || order.id}`);
  select.dataset.orderStatus = order.id;
  const statuses = ["Pending", "Accepted", "Processing", "Out for Delivery", "Delivered", "Cancelled"];
  const current = String(order.status || "Pending").toLowerCase();
  for (const status of statuses) {
    const option = makeElement("option", "", status);
    option.value = status.toLowerCase();
    option.selected = option.value === current;
    select.append(option);
  }
  return select;
}

function renderOrders() {
  ordersTableBody.replaceChildren();
  const query = document.querySelector("#order-search").value.trim().toLocaleLowerCase();
  const statusFilter = document.querySelector("#order-status-filter").value;
  const matches = orders.filter((order) => {
    const searchable = [
      order.orderId, order.id, orderCustomer(order), orderPhone(order),
      orderAddress(order), itemSummary(order.items), order.totalAmount, order.total
    ].join(" ").toLocaleLowerCase();
    return searchable.includes(query)
      && (!statusFilter || String(order.status || "pending").toLowerCase() === statusFilter);
  });
  for (const order of matches) {
    const row = document.createElement("tr");
    const id = order.orderId || order.id.slice(0, 10);
    row.append(makeElement("td", "", id));
    const customer = makeElement("td");
    customer.append(makeElement("strong", "", orderCustomer(order)), makeElement("small", "", orderPhone(order)));
    row.append(customer);
    row.append(makeElement("td", "", itemSummary(order.items)));
    row.append(makeElement("td", "", orderAddress(order)));
    row.append(makeElement("td", "", money(order.totalAmount ?? order.total)));
    row.append(makeElement("td", "", formatDate(order.createdAt)));
    const status = makeElement("td");
    status.append(createOrderStatusSelect(order));
    row.append(status);
    ordersTableBody.append(row);
  }
  const empty = document.querySelector("#orders-empty");
  empty.textContent = orders.length
    ? "No orders match the search and status filter."
    : "No persisted orders are available.";
  empty.hidden = matches.length > 0;
}

function renderInventory() {
  const threshold = Number(document.querySelector("#low-stock-threshold").value) || 0;
  const low = products.filter((product) => Number(product.stockQuantity) > 0 && Number(product.stockQuantity) <= threshold).length;
  const out = products.filter((product) => Number(product.stockQuantity) === 0).length;
  document.querySelector("#inventory-count").textContent = String(products.length);
  document.querySelector("#inventory-low").textContent = String(low);
  document.querySelector("#inventory-out").textContent = String(out);
  inventoryTableBody.replaceChildren();
  for (const product of [...products].sort((a, b) => (Number(a.stockQuantity) || 0) - (Number(b.stockQuantity) || 0))) {
    const row = document.createElement("tr");
    const item = makeElement("td");
    const info = makeElement("div", "admin-product-cell");
    info.append(imageCell(product.imageUrl, product.name));
    const text = makeElement("span");
    text.append(makeElement("strong", "", product.name), makeElement("small", "", product.brand || "No brand"));
    info.append(text);
    item.append(info);
    const stock = Number(product.stockQuantity) || 0;
    const status = makeElement("td");
    setStatusLabel(status, stock === 0 ? "Out of stock" : stock <= threshold ? "Low stock" : "In stock");
    const form = makeElement("form", "admin-stock-form");
    form.dataset.stockProduct = product.id;
    const input = makeElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "1000000";
    input.step = "1";
    input.value = String(stock);
    input.setAttribute("aria-label", `New stock quantity for ${product.name}`);
    const button = makeElement("button", "", "Update");
    button.type = "submit";
    form.append(input, button);
    row.append(item, makeElement("td", "", categoryName(product.categoryId)), status, makeElement("td", "", String(stock)), makeElement("td").appendChild(form).parentElement);
    inventoryTableBody.append(row);
  }
  document.querySelector("#inventory-empty").hidden = products.length > 0;
}

function renderCustomers() {
  const query = document.querySelector("#customer-search").value.trim().toLocaleLowerCase();
  const matches = customers.filter((customer) => `${customer.displayName || ""} ${customer.phoneNumber || ""} ${customer.id}`.toLocaleLowerCase().includes(query));
  customersTableBody.replaceChildren();
  for (const customer of matches) {
    const row = document.createElement("tr");
    row.append(makeElement("td", "", customer.displayName || "Name not provided"));
    row.append(makeElement("td", "", customer.phoneNumber || "—"));
    row.append(makeElement("td", "", formatDate(customer.updatedAt)));
    row.append(makeElement("td", "", customer.id));
    customersTableBody.append(row);
  }
  document.querySelector("#customers-empty").hidden = matches.length > 0;
}

function renderDashboard() {
  const active = products.filter((product) => product.status === "active").length;
  const outOfStock = products.filter((product) => Number(product.stockQuantity) === 0).length;
  const pending = orders.filter((order) => String(order.status || "pending").toLowerCase() === "pending").length;
  document.querySelector("#stat-products").textContent = String(products.length);
  document.querySelector("#stat-active").textContent = String(active);
  document.querySelector("#stat-out-stock").textContent = String(outOfStock);
  document.querySelector("#stat-orders").textContent = String(orders.length);
  document.querySelector("#stat-pending").textContent = String(pending);
  document.querySelector("#stat-customers").textContent = String(customers.length);

  const recent = [...orders].sort((first, second) => {
    const firstDate = first.createdAt?.toDate ? first.createdAt.toDate().valueOf() : 0;
    const secondDate = second.createdAt?.toDate ? second.createdAt.toDate().valueOf() : 0;
    return secondDate - firstDate;
  }).slice(0, 5);
  const body = document.querySelector("#dashboard-recent-orders");
  body.replaceChildren();
  for (const order of recent) {
    const row = document.createElement("tr");
    row.append(makeElement("td", "", order.orderId || order.id.slice(0, 10)));
    row.append(makeElement("td", "", orderCustomer(order)));
    row.append(makeElement("td", "", formatDate(order.createdAt)));
    const statusCell = makeElement("td");
    setStatusLabel(statusCell, order.status || "Pending");
    row.append(statusCell);
    body.append(row);
  }
  document.querySelector("#dashboard-orders-empty").hidden = recent.length > 0;
}

function renderCategoryOptions() {
  const categorySelects = [
    document.querySelector("#product-category"),
    document.querySelector("#product-category-filter")
  ];
  for (const select of categorySelects) {
    const selected = select.value;
    const first = select.options[0].cloneNode(true);
    select.replaceChildren(first);
    for (const category of categories) {
      const option = makeElement("option", "", category.name);
      option.value = category.id;
      select.append(option);
    }
    if (categories.some((category) => category.id === selected)) select.value = selected;
  }
}

function renderAll() {
  renderCategoryOptions();
  renderProductRows();
  renderCategoryRows();
  renderOrders();
  renderInventory();
  renderCustomers();
  renderDashboard();
}

async function refreshData() {
  if (!activeAdmin || !db) return;
  try {
    const [productSnapshot, categorySnapshot, orderSnapshot, customerSnapshot] = await Promise.all([
      sdk.getDocs(sdk.collection(db, "products")),
      sdk.getDocs(sdk.collection(db, "categories")),
      sdk.getDocs(sdk.collectionGroup(db, "orders")),
      sdk.getDocs(sdk.collection(db, "users"))
    ]);
    products = productSnapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
    categories = categorySnapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
    orders = orderSnapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id, ref: entry.ref }));
    customers = customerSnapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
    renderAll();
    document.querySelector("#admin-setup-banner").hidden = true;
    document.querySelector("#settings-project-id").textContent = new URL(supabaseConfig.url).host;
    showNotice("Dashboard data refreshed.", "success");
    await loadDeliverySettings();
  } catch (error) {
    console.error("Could not load admin dashboard data.", error);
    showNotice(`Dashboard data could not be loaded. ${formatError(error)}`, "error", 0);
  }
}

function resetProductForm() {
  productForm.reset();
  document.querySelector("#product-id").value = "";
  document.querySelector("#product-form-title").textContent = "Add a new product";
  const preview = document.querySelector("#product-image-preview");
  preview.hidden = true;
  preview.removeAttribute("src");
  if (currentImagePreviewUrl) URL.revokeObjectURL(currentImagePreviewUrl);
  currentImagePreviewUrl = null;
  setView("add-product");
}

function updateDiscountField() {
  const mrp = Number(productForm.elements.namedItem("mrp").value);
  const price = Number(productForm.elements.namedItem("price").value);
  productForm.elements.namedItem("discount").value = Number.isFinite(mrp) && mrp > 0
    && Number.isFinite(price) && price > 0 && price <= mrp
    ? String(Math.round(((mrp - price) / mrp) * 100))
    : "0";
}

function editProduct(product) {
  document.querySelector("#product-image").value = "";
  if (currentImagePreviewUrl) URL.revokeObjectURL(currentImagePreviewUrl);
  currentImagePreviewUrl = null;
  productForm.elements.namedItem("name").value = product.name || "";
  productForm.elements.namedItem("categoryId").value = product.categoryId || "";
  productForm.elements.namedItem("brand").value = product.brand || "";
  productForm.elements.namedItem("description").value = product.description || "";
  productForm.elements.namedItem("mrp").value = String(product.mrp ?? "");
  productForm.elements.namedItem("price").value = String(product.price ?? "");
  productForm.elements.namedItem("discount").value = String(product.discount ?? 0);
  productForm.elements.namedItem("weight").value = product.weight || "";
  productForm.elements.namedItem("stockQuantity").value = String(product.stockQuantity ?? 0);
  productForm.elements.namedItem("status").value = product.status || "active";
  productForm.elements.namedItem("featured").checked = product.featured === true;
  document.querySelector("#product-id").value = product.id;
  document.querySelector("#product-form-title").textContent = "Edit product";
  const preview = document.querySelector("#product-image-preview");
  preview.hidden = !product.imageUrl;
  if (product.imageUrl) preview.src = product.imageUrl;
  setView("add-product");
}

async function saveProduct(event) {
  event.preventDefault();
  if (!activeAdmin) return;
  const submitButton = productForm.querySelector('button[type="submit"]');
  const formData = new FormData(productForm);
  const name = String(formData.get("name") || "").trim();
  const categoryId = String(formData.get("categoryId") || "");
  const mrp = Number(formData.get("mrp"));
  const price = Number(formData.get("price"));
  const stockQuantity = Number(formData.get("stockQuantity"));
  const weight = String(formData.get("weight") || "").trim();
  const status = String(formData.get("status"));
  const existingId = document.querySelector("#product-id").value;
  const existing = products.find((product) => product.id === existingId);
  const file = document.querySelector("#product-image").files[0] || null;

  if (!categories.some((category) => category.id === categoryId)) {
    showNotice("Choose a category that exists in the category list.", "error");
    return;
  }
  if (!Number.isFinite(mrp) || !Number.isFinite(price) || mrp <= 0 || price <= 0 || price > mrp) {
    showNotice("Enter valid prices; the selling price must not exceed the MRP.", "error");
    return;
  }
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 1000000) {
    showNotice("Stock must be a whole number between 0 and 1,000,000.", "error");
    return;
  }
  if (!weight || !["active", "inactive"].includes(status)) {
    showNotice("Enter the product quantity and choose a valid status.", "error");
    return;
  }
  if (!file && !existing?.imageUrl) {
    showNotice("Upload a product image before saving.", "error");
    return;
  }

  setBusy(submitButton, true, "Saving...");
  let uploadedPath = "";
  try {
    const reference = existing
      ? sdk.doc(db, "products", existing.id)
      : sdk.doc(sdk.collection(db, "products"));
    let imageUrl = existing?.imageUrl || "";
    let imagePath = existing?.imagePath || "";
    if (file) {
      const uploaded = await uploadImage(file, "products", reference.id);
      imageUrl = uploaded.url;
      imagePath = uploaded.path;
      uploadedPath = uploaded.path;
    }
    const data = {
      name,
      categoryId,
      brand: String(formData.get("brand") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      mrp,
      price,
      discount: Math.round(((mrp - price) / mrp) * 100),
      weight,
      stockQuantity,
      status,
      featured: formData.get("featured") === "on",
      imageUrl,
      imagePath,
      updatedAt: sdk.serverTimestamp()
    };
    if (existing) {
      await sdk.updateDoc(reference, data);
    } else {
      await sdk.setDoc(reference, { ...data, createdAt: sdk.serverTimestamp() });
    }
    uploadedPath = "";
    if (file && existing?.imagePath && existing.imagePath !== imagePath) {
      try {
        await removeImage(existing.imagePath);
      } catch (error) {
        console.error("Product saved, but its previous image could not be removed.", error);
        showNotice("Product saved, but the previous image could not be removed from Storage.", "error", 0);
      }
    }
    resetProductForm();
    await refreshData();
    showNotice(existing ? "Product updated." : "Product added.");
    setView("products");
  } catch (error) {
    if (uploadedPath) {
      try {
        await removeImage(uploadedPath);
      } catch (cleanupError) {
        console.error("Could not remove an image uploaded for a failed product save.", cleanupError);
      }
    }
    console.error("Could not save product.", error);
    showNotice(`Product could not be saved. ${formatError(error)}`, "error", 0);
  } finally {
    setBusy(submitButton, false);
  }
}

async function deleteProduct(product) {
  const confirmed = await showConfirm(`Delete “${product.name}”? This removes the catalog record.`, "Delete product?");
  if (!confirmed) return;
  try {
    await sdk.deleteDoc(sdk.doc(db, "products", product.id));
    let warning = "";
    try {
      await removeImage(product.imagePath);
    } catch (error) {
      if (product.imagePath) {
        console.error("Product record was deleted, but its Storage image could not be removed.", error);
        warning = " The image file could not be removed from Storage.";
      }
    }
    await refreshData();
    showNotice(`Product deleted.${warning}`, warning ? "error" : "success", warning ? 0 : 5000);
  } catch (error) {
    console.error("Could not delete product.", error);
    showNotice(`Product could not be deleted. ${formatError(error)}`, "error", 0);
  }
}

async function toggleProduct(product) {
  const nextStatus = product.status === "active" ? "inactive" : "active";
  try {
    await sdk.updateDoc(sdk.doc(db, "products", product.id), {
      status: nextStatus,
      updatedAt: sdk.serverTimestamp()
    });
    await refreshData();
    showNotice(`${product.name} is now ${nextStatus}.`);
  } catch (error) {
    console.error("Could not change product status.", error);
    showNotice(`Product status could not be changed. ${formatError(error)}`, "error", 0);
  }
}

function normalizeCategoryName(name) {
  return name.trim().normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase();
}

async function saveCategory(event) {
  event.preventDefault();
  if (!activeAdmin) return;
  const button = categoryForm.querySelector('button[type="submit"]');
  const name = String(new FormData(categoryForm).get("name") || "").trim().replace(/\s+/g, " ");
  const editingId = document.querySelector("#category-id").value;
  const existing = categories.find((category) => category.id === editingId);
  const file = document.querySelector("#category-image").files[0] || null;
  if (categories.some((category) => category.id !== editingId && normalizeCategoryName(category.name) === normalizeCategoryName(name))) {
    showNotice("A category with that name already exists.", "error");
    return;
  }
  setBusy(button, true, "Saving...");
  let uploadedPath = "";
  try {
    const categoryId = existing?.id || normalizeCategoryName(name).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    if (!categoryId) throw new Error("Enter a category name containing letters or numbers.");
    const reference = sdk.doc(db, "categories", categoryId);
    let imageUrl = existing?.imageUrl || "";
    let imagePath = existing?.imagePath || "";
    if (file) {
      const uploaded = await uploadImage(file, "categories", categoryId);
      imageUrl = uploaded.url;
      imagePath = uploaded.path;
      uploadedPath = uploaded.path;
    }
    const data = {
      name,
      slug: normalizeCategoryName(name).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""),
      imageUrl,
      imagePath,
      updatedAt: sdk.serverTimestamp()
    };
    if (existing) await sdk.updateDoc(reference, data);
    else await sdk.setDoc(reference, { ...data, createdAt: sdk.serverTimestamp() });
    uploadedPath = "";
    if (file && existing?.imagePath && existing.imagePath !== imagePath) {
      try {
        await removeImage(existing.imagePath);
      } catch (error) {
        console.error("Category saved, but its previous image could not be removed.", error);
        showNotice("Category saved, but the previous image could not be removed from Storage.", "error", 0);
      }
    }
    resetCategoryForm();
    await refreshData();
    showNotice(existing ? "Category updated." : "Category added.");
  } catch (error) {
    if (uploadedPath) {
      try {
        await removeImage(uploadedPath);
      } catch (cleanupError) {
        console.error("Could not remove an image uploaded for a failed category save.", cleanupError);
      }
    }
    console.error("Could not save category.", error);
    showNotice(`Category could not be saved. ${formatError(error)}`, "error", 0);
  } finally {
    setBusy(button, false);
  }
}

function resetCategoryForm() {
  categoryForm.reset();
  document.querySelector("#category-id").value = "";
  document.querySelector("#category-form-title").textContent = "Add category";
  const preview = document.querySelector("#category-image-preview");
  preview.hidden = true;
  preview.removeAttribute("src");
  if (currentCategoryPreviewUrl) URL.revokeObjectURL(currentCategoryPreviewUrl);
  currentCategoryPreviewUrl = null;
}

function editCategory(category) {
  document.querySelector("#category-image").value = "";
  if (currentCategoryPreviewUrl) URL.revokeObjectURL(currentCategoryPreviewUrl);
  currentCategoryPreviewUrl = null;
  categoryForm.elements.namedItem("name").value = category.name;
  document.querySelector("#category-id").value = category.id;
  document.querySelector("#category-form-title").textContent = "Edit category";
  const preview = document.querySelector("#category-image-preview");
  preview.hidden = !category.imageUrl;
  if (category.imageUrl) preview.src = category.imageUrl;
  document.querySelector('#category-form input[name="name"]').focus();
}

async function deleteCategory(category) {
  try {
    const linkedProducts = await sdk.getDocs(sdk.query(
      sdk.collection(db, "products"),
      sdk.where("categoryId", "==", category.id)
    ));
    if (!linkedProducts.empty) {
      showNotice(`“${category.name}” is used by ${linkedProducts.size} product(s). Move those products before deleting this category.`, "error", 0);
      return;
    }
    const confirmed = await showConfirm(`Delete “${category.name}”?`, "Delete category?");
    if (!confirmed) return;
    await sdk.deleteDoc(sdk.doc(db, "categories", category.id));
    let warning = "";
    try {
      await removeImage(category.imagePath);
    } catch (error) {
      if (category.imagePath) {
        console.error("Category record was deleted, but its Storage image could not be removed.", error);
        warning = " The image file could not be removed from Storage.";
      }
    }
    await refreshData();
    showNotice(`Category deleted.${warning}`, warning ? "error" : "success", warning ? 0 : 5000);
  } catch (error) {
    console.error("Could not delete category.", error);
    showNotice(`Category could not be deleted. ${formatError(error)}`, "error", 0);
  }
}

async function importExistingCategories(button) {
  if (!activeAdmin || !db) return;
  const existingCategories = window.inderCategories;
  if (!Array.isArray(existingCategories) || existingCategories.length === 0) {
    showNotice("The existing category list could not be loaded from products.js.", "error");
    return;
  }
  const missingCategories = existingCategories.filter((candidate) => (
    !categories.some((category) => category.id === candidate.id
      || normalizeCategoryName(category.name) === normalizeCategoryName(candidate.name))
  ));
  if (missingCategories.length === 0) {
    showNotice("All current categories already exist. No duplicates were added.");
    return;
  }
  setBusy(button, true, "Importing...");
  try {
    const batch = sdk.writeBatch(db);
    for (const category of missingCategories) {
      batch.set(sdk.doc(db, "categories", category.id), {
        name: category.name,
        slug: category.id,
        imageUrl: category.imageUrl || "",
        imagePath: "",
        createdAt: sdk.serverTimestamp(),
        updatedAt: sdk.serverTimestamp()
      });
    }
    await batch.commit();
    await refreshData();
    showNotice(`${missingCategories.length} existing ${missingCategories.length === 1 ? "category was" : "categories were"} imported. No products or stock were added.`);
  } catch (error) {
    console.error("Could not import existing categories.", error);
    showNotice(`Existing categories could not be imported. ${formatError(error)}`, "error", 0);
  } finally {
    setBusy(button, false);
  }
}

async function updateOrderStatus(order, status) {
  try {
    await sdk.updateDoc(order.ref, {
      status,
      updatedAt: sdk.serverTimestamp()
    });
    await refreshData();
    showNotice(`Order ${order.orderId || order.id.slice(0, 10)} updated to ${status.replace(/-/g, " ")}.`);
  } catch (error) {
    console.error("Could not update order status.", error);
    showNotice(`Order status could not be updated. ${formatError(error)}`, "error", 0);
    renderOrders();
  }
}

async function updateStock(form) {
  const product = products.find((entry) => entry.id === form.dataset.stockProduct);
  const input = form.querySelector("input");
  const quantity = Number(input.value);
  if (!product || !Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) {
    showNotice("Enter a whole stock quantity between 0 and 1,000,000.", "error");
    return;
  }
  const button = form.querySelector("button");
  setBusy(button, true, "Saving");
  try {
    await sdk.updateDoc(sdk.doc(db, "products", product.id), {
      stockQuantity: quantity,
      updatedAt: sdk.serverTimestamp()
    });
    await refreshData();
    showNotice(`${product.name} stock updated to ${quantity}.`);
  } catch (error) {
    console.error("Could not update product stock.", error);
    showNotice(`Stock could not be updated. ${formatError(error)}`, "error", 0);
  } finally {
    setBusy(button, false);
  }
}

function previewFile(input, preview, kind) {
  const file = input.files[0];
  if (!file) return;
  try {
    validateImage(file);
  } catch (error) {
    input.value = "";
    showNotice(error.message, "error");
    return;
  }
  const previousUrl = kind === "product" ? currentImagePreviewUrl : currentCategoryPreviewUrl;
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  const objectUrl = URL.createObjectURL(file);
  if (kind === "product") currentImagePreviewUrl = objectUrl;
  else currentCategoryPreviewUrl = objectUrl;
  preview.src = objectUrl;
  preview.hidden = false;
}

async function authorizeAdmin(user) {
  const token = await user.getIdTokenResult(true);
  if (token.claims.admin !== true) {
    await sdk.signOut(auth);
    loginScreen.hidden = false;
    appShell.hidden = true;
    setLoginMessage("This account is not authorized for the admin dashboard.", true);
    return false;
  }
  activeAdmin = user;
  document.querySelector("#admin-user-email").textContent = user.email || "Authorized administrator";
  document.querySelector("#settings-admin-email").textContent = user.email || "Not available";
  document.querySelector("#settings-admin-claim").textContent = "Verified";
  loginScreen.hidden = true;
  appShell.hidden = false;
  await refreshData();
  return true;
}

function configureNavigation() {
  document.querySelectorAll(".admin-nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view === "add-product" && !document.querySelector("#product-id").value) resetProductForm();
      setView(button.dataset.view);
    });
  });
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.go === "add-product") resetProductForm();
      setView(button.dataset.go);
    });
  });
  document.querySelectorAll("[data-refresh]").forEach((button) => button.addEventListener("click", refreshData));
  document.querySelector("#admin-menu-toggle").addEventListener("click", (event) => {
    const sidebar = document.querySelector("#admin-sidebar");
    const open = sidebar.classList.toggle("is-open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });
  document.querySelector("#admin-logout").addEventListener("click", async () => {
    try {
      await sdk.signOut(auth);
      activeAdmin = null;
      products = [];
      categories = [];
      orders = [];
      customers = [];
      appShell.hidden = true;
      loginScreen.hidden = false;
      loginForm.reset();
      setLoginMessage("You have been securely signed out.");
    } catch (error) {
      console.error("Could not sign out administrator.", error);
      showNotice(`Sign out failed. ${formatError(error)}`, "error", 0);
    }
  });
}

function configureActions() {
  document.querySelector("#delivery-settings-form").addEventListener("submit", saveDeliverySettings);
  productForm.addEventListener("submit", saveProduct);
  productForm.addEventListener("reset", () => window.setTimeout(() => {
    document.querySelector("#product-id").value = "";
    document.querySelector("#product-form-title").textContent = "Add a new product";
    document.querySelector("#product-image-preview").hidden = true;
  }, 0));
  document.querySelector("#product-form-reset").addEventListener("click", resetProductForm);
  categoryForm.addEventListener("submit", saveCategory);
  categoryForm.addEventListener("reset", () => window.setTimeout(() => {
    document.querySelector("#category-id").value = "";
    document.querySelector("#category-form-title").textContent = "Add category";
    document.querySelector("#category-image-preview").hidden = true;
  }, 0));
  document.querySelector("#category-form-reset").addEventListener("click", resetCategoryForm);
  document.querySelector("#import-existing-categories").addEventListener("click", (event) => {
    importExistingCategories(event.currentTarget);
  });
  document.querySelector("#product-image").addEventListener("change", (event) => previewFile(event.currentTarget, document.querySelector("#product-image-preview"), "product"));
  document.querySelector("#category-image").addEventListener("change", (event) => previewFile(event.currentTarget, document.querySelector("#category-image-preview"), "category"));

  productTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const product = products.find((entry) => entry.id === (button.dataset.editProduct || button.dataset.toggleProduct || button.dataset.deleteProduct));
    if (!product) return;
    if (button.dataset.editProduct) editProduct(product);
    if (button.dataset.toggleProduct) await toggleProduct(product);
    if (button.dataset.deleteProduct) await deleteProduct(product);
  });
  categoryList.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const category = categories.find((entry) => entry.id === (button.dataset.editCategory || button.dataset.deleteCategory));
    if (!category) return;
    if (button.dataset.editCategory) editCategory(category);
    if (button.dataset.deleteCategory) await deleteCategory(category);
  });
  ordersTableBody.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-order-status]");
    if (!select) return;
    const order = orders.find((entry) => entry.id === select.dataset.orderStatus);
    if (order) await updateOrderStatus(order, select.value);
  });
  inventoryTableBody.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-stock-product]");
    if (!form) return;
    event.preventDefault();
    await updateStock(form);
  });

  for (const id of ["product-search", "product-category-filter", "product-stock-filter"]) {
    document.querySelector(`#${id}`).addEventListener(id === "product-search" ? "input" : "change", renderProductRows);
  }
  document.querySelector("#order-search").addEventListener("input", renderOrders);
  document.querySelector("#order-status-filter").addEventListener("change", renderOrders);
  for (const id of ["product-mrp", "product-price"]) {
    const input = document.querySelector(`#${id}`);
    if (input) input.addEventListener("input", updateDiscountField);
  }
  document.querySelector("#low-stock-threshold").addEventListener("input", () => {
    renderInventory();
    renderProductRows();
  });
  document.querySelector("#customer-search").addEventListener("input", renderCustomers);
  document.querySelector("#confirm-cancel").addEventListener("click", () => closeConfirm(false));
  document.querySelector("#confirm-delete").addEventListener("click", () => closeConfirm(true));
  confirmBackdrop.addEventListener("click", (event) => {
    if (event.target === confirmBackdrop) closeConfirm(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !confirmBackdrop.hidden) closeConfirm(false);
  });
}

async function initializeAdmin() {
  configureNavigation();
  configureActions();
  if (missingConfig) {
    loginForm.querySelectorAll("input, button").forEach((control) => {
      control.disabled = true;
    });
    const setupLink = makeElement("a", "", "SUPABASE_SETUP.md");
    setupLink.href = "SUPABASE_SETUP.md";
    setupBanner.replaceChildren(
      document.createTextNode("Supabase is not configured. Add your project URL and publishable key to supabase-config.js, then follow "),
      setupLink,
      document.createTextNode(". Run the database schema and assign the Admin role. Admin sign-in and dashboard data remain unavailable until setup is complete.")
    );
    setupBanner.hidden = false;
    setLoginMessage("This secure admin panel does not support offline or password-only fallback access.", true);
    return;
  }
  try {
    const client = await getSupabaseClient();
    const compat = createSupabaseCompat(client);
    auth = compat.auth;
    db = compat.db;
    storage = compat.storage;
    sdk = compat.sdk;
    document.querySelector("#settings-project-id").textContent = new URL(supabaseConfig.url).host;
    sdk.onAuthStateChanged(auth, async (user) => {
      if (!user) {
        activeAdmin = null;
        appShell.hidden = true;
        loginScreen.hidden = false;
        document.querySelector("#settings-admin-claim").textContent = "Not verified";
        return;
      }
      try {
        await authorizeAdmin(user);
      } catch (error) {
        console.error("Could not verify administrator authorization.", error);
        await sdk.signOut(auth);
        activeAdmin = null;
        loginScreen.hidden = false;
        appShell.hidden = true;
        setLoginMessage(`Admin access could not be verified. ${formatError(error)}`, true);
      }
    });
  } catch (error) {
    console.error("Supabase admin initialization failed.", error);
    setLoginMessage(`Supabase could not be initialized. ${formatError(error)}`, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth || !sdk) {
    setLoginMessage("Supabase is not ready. Complete the setup guide before signing in.", true);
    return;
  }
  const button = document.querySelector("#admin-login-submit");
  const email = loginForm.elements.namedItem("email").value.trim();
  const password = loginForm.elements.namedItem("password").value;
  setBusy(button, true, "Verifying access...");
  setLoginMessage();
  try {
    await sdk.setPersistence(auth, sdk.browserSessionPersistence);
    await sdk.signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Admin sign-in failed.", error);
    setLoginMessage(formatError(error), true);
  } finally {
    setBusy(button, false);
  }
});

initializeAdmin();
