let products = window.inderProducts;
let categories = window.inderCategories;
let liveCatalogEnabled = false;
const homepageCategories = window.inderHomepageCategories;
const trendingSearches = window.inderTrendingSearches;
const popularSearches = window.inderPopularSearches;
const excludedCustomerCategoryTerms = /\b(?:pet care|electronics?|mobile(?: phones?| accessories)?|phones?|smartphones?|laptops?|computers?|gadgets?|toys?|fashion|pharmacy|medicines?|cigarettes?|hukka|meat|fish)\b/i;
function isRelevantCustomerCategory(category) {
  return !excludedCustomerCategoryTerms.test(category.name);
}

categories = categories.filter(isRelevantCustomerCategory);
products = products.filter((product) => categories.some((category) => category.id === product.category));

// Paste the store's Instagram profile URL here when available; leave blank to hide its links.
const shopInstagramUrl = "";
const cartStorageKey = "inder-store-cart-v1";
const wishlistStorageKey = "inder-store-wishlist-v1";
let storageWarning = false;
function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : JSON.parse(stored);
  } catch (error) {
    storageWarning = true;
    console.error(`Could not read ${key} from localStorage.`, error);
    return fallback;
  }
}

function canAddToCart(product, quantity) {
  if (!liveCatalogEnabled) return true;
  const stock = Number(product.stockQuantity);
  if (stock <= 0 || (cart.get(product.id) ?? 0) + quantity > stock) {
    showToast(stock <= 0 ? `${product.name} is out of stock` : `Only ${stock} ${product.name} available`);
    return false;
  }
  return true;
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    storageWarning = true;
    console.error(`Could not save ${key} to localStorage.`, error);
  }
}

const storedCart = readStorage(cartStorageKey, []);
const hasLegacyCartItems = Array.isArray(storedCart)
  && storedCart.some((entry) => Array.isArray(entry) && typeof entry[0] === "string" && !products.some((product) => product.id === entry[0]));
const cart = new Map(
  Array.isArray(storedCart)
    ? storedCart.filter((entry) => Array.isArray(entry) && products.some((product) => product.id === entry[0]) && Number.isInteger(entry[1]) && entry[1] > 0 && entry[1] <= 99)
    : []
);
const storedWishlist = readStorage(wishlistStorageKey, []);
const hasLegacyWishlistItems = Array.isArray(storedWishlist)
  && storedWishlist.some((id) => typeof id === "string" && !products.some((product) => product.id === id));
const wishlist = new Set(
  Array.isArray(storedWishlist)
    ? storedWishlist.filter((id) => products.some((product) => product.id === id))
    : []
);
const recentlyViewed = [];
let showWishlistOnly = false;
let activeCategoryId = null;
let activeCategoryGroup = null;
const homepageCategoryGroups = new Map();
const productGrid = document.querySelector("#product-grid");
const emptyState = document.querySelector("#empty-state");
const primaryProductCards = [];
const categoryGrid = document.querySelector("#category-grid");
const productHeading = document.querySelector("#product-heading");
productGrid.replaceChildren(emptyState);
const productMarquee = document.querySelector("#product-marquee");
const productTrack = document.createElement("div");
const primaryProductGroup = document.createElement("div");
const duplicateProductGroup = document.createElement("div");
const cartOverlay = document.querySelector("#cart-overlay");
const cartDrawer = document.querySelector("#cart-drawer");
const cartItems = document.querySelector("#cart-items");
const cartEmpty = document.querySelector("#cart-empty");
const cartFooter = document.querySelector("#cart-footer");
const cartCount = document.querySelector("#cart-count");
const drawerCount = document.querySelector("#drawer-count");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#product-search");
const checkoutForm = document.querySelector("#checkout-form");
const orderPreview = document.querySelector("#order-preview");
const orderMessagePreview = document.querySelector("#order-message-preview");
const whatsappConfirmLink = document.querySelector("#whatsapp-confirm-link");
const filterPanel = document.querySelector("#product-filters");
const filterBackdrop = document.querySelector("#filter-backdrop");
const filterOpenButton = document.querySelector("#open-filters");
const filterCount = document.querySelector("#filter-count");
const sortSelect = document.querySelector("#sort-products");
const quickViewDialog = document.querySelector("#quick-view-dialog");
const quickViewContent = document.querySelector("#quick-view-content");
let previousFocus = null;
let previousFilterFocus = null;
let toastTimer;
let currentOrderDraft = null;
let appliedFilters = null;
let activeTrendingTab = Object.keys(trendingSearches)[0];
let activePopularTab = Object.keys(popularSearches)[0];

productMarquee.className = "product-marquee";
productMarquee.id = "product-marquee";
productTrack.className = "product-track";
productTrack.id = "product-track";
primaryProductGroup.className = "product-track__group";
primaryProductGroup.setAttribute("aria-label", "Grocery categories");
duplicateProductGroup.className = "product-track__group product-track__group--copy";
duplicateProductGroup.setAttribute("aria-label", "More grocery categories");
duplicateProductGroup.setAttribute("aria-hidden", "true");
duplicateProductGroup.inert = true;
function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function makeImagePlaceholder(className) {
  const placeholder = makeElement("span", className);
  placeholder.innerHTML = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 19h28l-2.5 20h-23L10 19Z"/><path d="M17 19v-5a7 7 0 0 1 14 0v5M17 27c2 2.4 4.3 3.6 7 3.6s5-1.2 7-3.6"/></svg>';
  return placeholder;
}

function createProductCard(product) {
  const card = makeElement("article", "product-card");
  card.dataset.product = product.id;
  card.dataset.name = product.name.toLocaleLowerCase();
  card.dataset.brand = product.brand;
  card.dataset.price = String(product.price);
  card.dataset.weight = product.weight;
  card.dataset.rating = product.rating ?? "";
  card.dataset.popularity = product.popularity ?? "";
  card.dataset.newest = product.newest ?? "";

  const imageWrap = makeElement("div", `product-card__image product-card__image--${product.category}`);
  const outOfStock = liveCatalogEnabled && Number(product.stockQuantity) <= 0;
  imageWrap.append(makeElement("span", `product-card__tag${outOfStock ? " product-card__tag--out" : ""}`,
    outOfStock ? "OUT OF STOCK" : liveCatalogEnabled ? "IN STORE" : "DEMO PRICE"));
  if (product.image) {
    const image = document.createElement("img");
    image.src = product.image;
    image.alt = liveCatalogEnabled ? product.name : `Illustrative ${product.categoryLabel.toLocaleLowerCase()} photo, not a photograph of ${product.name} or its branded package`;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.replaceWith(makeImagePlaceholder("product-card__placeholder"));
    }, { once: true });
    imageWrap.append(image);
  } else {
    imageWrap.append(makeImagePlaceholder("product-card__placeholder"));
  }

  const wishlistButton = document.createElement("button");
  wishlistButton.className = "wishlist-button";
  wishlistButton.type = "button";
  wishlistButton.dataset.wishlist = product.id;
  wishlistButton.setAttribute("aria-label", `Add ${product.name} to wishlist`);
  wishlistButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.6c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.8 2.2Z"/></svg>';
  imageWrap.append(wishlistButton);

  const body = makeElement("div", "product-card__body");
  const quickViewButton = makeElement("button", "quick-view-button", "Quick view");
  quickViewButton.type = "button";
  quickViewButton.dataset.quickView = product.id;
  body.append(quickViewButton);
  body.append(makeElement("p", "product-card__category", product.categoryLabel.toLocaleUpperCase()));
  body.append(makeElement("h3", "", product.name));
  body.append(makeElement("p", "product-card__brand", product.brand));
  body.append(makeElement("p", "product-card__details", product.weight));

  const price = makeElement("div", "product-card__price", liveCatalogEnabled ? `₹${product.price}` : `₹${product.price} DEMO`);
  if (product.originalPrice !== null) {
    price.append(makeElement("span", "product-card__original-price", liveCatalogEnabled ? `₹${product.originalPrice}` : `₹${product.originalPrice} DEMO`));
  }
  if (product.discount !== null) {
    price.append(makeElement("span", "product-card__discount", liveCatalogEnabled ? `${product.discount}% off` : `${product.discount}% off (DEMO)`));
  }
  body.append(price);

  if (product.rating !== null) {
    body.append(makeElement("p", "product-rating", `★ ${product.rating}`));
  }

  const controls = makeElement("div", "product-card__controls");
  const quantityLabel = makeElement("label", "quantity-control");
  quantityLabel.append(makeElement("span", "sr-only", `Quantity of ${product.name}`));
  const decrease = makeElement("button", "", "−");
  decrease.type = "button";
  decrease.dataset.quantity = "-1";
  decrease.setAttribute("aria-label", `Decrease ${product.name} quantity`);
  const quantity = document.createElement("input");
  quantity.type = "number";
  quantity.min = "1";
  quantity.max = liveCatalogEnabled ? String(Math.min(99, Number(product.stockQuantity) || 0)) : "99";
  quantity.value = "1";
  quantity.inputMode = "numeric";
  quantity.setAttribute("aria-label", `${product.name} quantity`);
  const increase = makeElement("button", "", "+");
  increase.type = "button";
  increase.dataset.quantity = "1";
  increase.setAttribute("aria-label", `Increase ${product.name} quantity`);
  if (outOfStock) {
    decrease.disabled = true;
    increase.disabled = true;
    quantity.disabled = true;
  }
  quantityLabel.append(decrease, quantity, increase);

  const addButton = document.createElement("button");
  addButton.className = "add-button";
  addButton.type = "button";
  addButton.dataset.add = product.id;
  addButton.setAttribute("aria-label", `Add ${product.name} to cart`);
  addButton.disabled = outOfStock;
  addButton.append(makeElement("span", "", outOfStock ? "Out of Stock" : "Add to cart"));
  addButton.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg>');
  const buyNowButton = makeElement("button", "buy-now-button", "Buy now");
  buyNowButton.type = "button";
  buyNowButton.dataset.buyNow = product.id;
  buyNowButton.disabled = outOfStock;
  if (outOfStock) buyNowButton.textContent = "Out of Stock";
  controls.append(quantityLabel, addButton, buyNowButton);
  body.append(controls);
  card.append(imageWrap, body);
  return card;
}

function productCountForCategories(categoryIds) {
  if (categoryIds === null) return products.length;
  return products.filter((product) => categoryIds.includes(product.category)).length;
}

function createCategoryImage(imageUrl, alt, className) {
  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = alt;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.replaceWith(makeImagePlaceholder(`${className}__placeholder`));
  }, { once: true });
  return image;
}

function createHomeCategoryCard(category, index) {
  const button = makeElement("button", "category-card category-card--browse");
  button.type = "button";
  button.dataset.homeGroup = category.id;
  button.setAttribute("aria-label", `Show ${category.name} products`);
  button.append(makeElement("span", "category-card__number", String(index).padStart(2, "0")));

  const art = makeElement("span", "category-card__art");
  art.append(createCategoryImage(category.imageUrl, `${category.name} category`, "category-card__art"));
  button.append(art);

  const bottom = makeElement("span", "category-card__bottom");
  bottom.append(makeElement("strong", "", category.name));
  const count = productCountForCategories(category.categoryIds);
  const countLabel = count === 0
    ? "No products listed yet"
    : `${count} ${liveCatalogEnabled ? (count === 1 ? "product" : "products") : (count === 1 ? "example" : "examples")}`;
  bottom.append(makeElement("span", "", countLabel));
  button.append(bottom);
  return button;
}

function renderSearchCollection(tabs, list, collection, activeTab, onSelect) {
  tabs.replaceChildren();
  for (const name of Object.keys(collection)) {
    const button = makeElement("button", `discovery-tab${name === activeTab ? " is-active" : ""}`, name);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.id = `${tabs.id}-${name.toLocaleLowerCase().replaceAll(" ", "-")}`;
    button.setAttribute("aria-controls", list.id);
    button.setAttribute("aria-selected", String(name === activeTab));
    button.tabIndex = name === activeTab ? 0 : -1;
    button.addEventListener("click", () => onSelect(name));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...tabs.querySelectorAll('[role="tab"]')];
      const currentIndex = buttons.indexOf(button);
      const nextIndex = (currentIndex + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length;
      buttons[nextIndex].focus();
      buttons[nextIndex].click();
    });
    tabs.append(button);
  }

  const activeTabButton = tabs.querySelector('[aria-selected="true"]');
  list.setAttribute("aria-labelledby", activeTabButton?.id ?? "");
  list.replaceChildren();
  for (const term of collection[activeTab] ?? []) {
    const button = makeElement("button", "search-chip", term);
    button.type = "button";
    button.dataset.searchTerm = term;
    list.append(button);
  }
}

function renderHomepageCategories() {
  homepageCategoryGroups.clear();
  const mainGroups = [
    { id: "all", name: "All Products", imageUrl: "assets/categories/other-daily-essentials.jpg", categoryIds: null },
    ...homepageCategories.map((category) => ({ ...category, categoryIds: [...category.categoryIds] }))
  ];
  const assignedCategoryIds = new Set([
    ...mainGroups.flatMap((category) => category.categoryIds ?? [])
  ]);
  const catalogCategoryGroups = [];
  for (const category of categories) {
    if (assignedCategoryIds.has(category.id)) continue;
    const categoryName = normalizeSearchValue(category.name);
    const matchingGroup = mainGroups.find((group) => (
      Array.isArray(group.categoryIds) && normalizeSearchValue(group.name) === categoryName
    ));
    if (matchingGroup) {
      matchingGroup.categoryIds.push(category.id);
      assignedCategoryIds.add(category.id);
      continue;
    }
    catalogCategoryGroups.push({
      id: `catalog:${category.id}`,
      name: category.name,
      imageUrl: category.imageUrl || "assets/categories/other-daily-essentials.jpg",
      categoryIds: [category.id]
    });
  }
  for (const category of mainGroups) homepageCategoryGroups.set(category.id, category);
  for (const category of catalogCategoryGroups) homepageCategoryGroups.set(category.id, category);

  if (activeCategoryGroup) {
    activeCategoryGroup = homepageCategoryGroups.get(activeCategoryGroup.id) ?? null;
  }
  const cards = [
    ...mainGroups.map(createHomeCategoryCard),
    ...catalogCategoryGroups.map((category, index) => createHomeCategoryCard(category, mainGroups.length + index + 1))
  ];
  categoryGrid.replaceChildren(...cards);
  updateCategorySelection();
}

function renderTrendingSearches() {
  renderSearchCollection(
    document.querySelector("#trending-search-tabs"),
    document.querySelector("#trending-search-list"),
    trendingSearches,
    activeTrendingTab,
    (name) => {
      activeTrendingTab = name;
      renderTrendingSearches();
    }
  );
}

function renderPopularSearches() {
  renderSearchCollection(
    document.querySelector("#popular-search-tabs"),
    document.querySelector("#popular-search-list"),
    popularSearches,
    activePopularTab,
    (name) => {
      activePopularTab = name;
      renderPopularSearches();
    }
  );
}

function renderSearchDiscoveries() {
  renderTrendingSearches();
  renderPopularSearches();
}

function updateCategorySelection() {
  const allSelected = (!activeCategoryGroup && !activeCategoryId && captureFilterControls().categories.length === 0)
    || activeCategoryGroup?.id === "all";
  categoryGrid.querySelectorAll("[data-home-group]").forEach((button) => {
    const selected = activeCategoryGroup?.id === button.dataset.homeGroup
      || (button.dataset.homeGroup === "all" && allSelected);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderCatalog() {
  const previousFilters = captureFilterControls();
  if (activeCategoryId && !categories.some((category) => category.id === activeCategoryId)) {
    activeCategoryId = null;
  }
  renderHomepageCategories();

  primaryProductCards.length = 0;
  primaryProductGroup.replaceChildren();
  duplicateProductGroup.replaceChildren();
  productGrid.replaceChildren(emptyState);
  const featuredProducts = liveCatalogEnabled
    ? products.filter((product) => product.featured)
    : categories.map((category) => products.find((product) => product.category === category.id)).filter(Boolean);
  for (const product of products) {
    const card = createProductCard(product);
    primaryProductCards.push(card);
    productGrid.append(card);
    if (featuredProducts.includes(product)) {
      primaryProductGroup.append(card.cloneNode(true));
      const duplicate = card.cloneNode(true);
      duplicate.inert = true;
      duplicateProductGroup.append(duplicate);
    }
  }
  productTrack.replaceChildren(primaryProductGroup, duplicateProductGroup);
  productTrack.style.animationDuration = "45s";
  if (!productTrack.parentElement) productMarquee.append(productTrack);
  productGrid.append(emptyState);
  productGrid.hidden = false;
  renderBrandFilters();
  renderCategoryFilters();
  renderWeightFilters();
  restoreFilterControls(previousFilters);
  updateCategorySelection();
  updateWishlist();
  updateCart();
  appliedFilters = captureFilterControls();
  applyFilters();
  renderRecentlyViewed();
}

renderCatalog();
renderSearchDiscoveries();

document.querySelector("#current-year").textContent = new Date().getFullYear();

function configureInstagramLinks() {
  let profileUrl;
  try {
    profileUrl = new URL(shopInstagramUrl);
  } catch {
    return;
  }
  if (profileUrl.protocol !== "https:" || !/(^|\.)instagram\.com$/i.test(profileUrl.hostname)) return;

  document.querySelectorAll("[data-instagram-link]").forEach((link) => {
    link.href = profileUrl.href;
    link.hidden = false;
  });
}

configureInstagramLinks();

function renderBrandFilters() {
  const brands = [...new Set(products.map((product) => product.brand).filter(Boolean))].sort();
  const container = document.querySelector("#brand-filter-options");
  container.replaceChildren();
  if (brands.length === 0) {
    const note = document.createElement("span");
    note.className = "filter-unavailable";
    note.textContent = "No confirmed brands yet";
    container.append(note);
    return;
  }
  for (const brand of brands) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "brand-filter";
    input.value = brand;
    label.append(input, document.createTextNode(` ${brand}`));
    container.append(label);
    input.addEventListener("input", updateFilterCount);
  }
}

function renderCategoryFilters() {
  const container = document.querySelector("#category-filter-options");
  container.replaceChildren();
  for (const category of categories) {
    const count = products.filter((product) => product.category === category.id).length;
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "category-filter";
    input.value = category.id;
    label.append(input, document.createTextNode(` ${category.name} (${count})`));
    container.append(label);
    input.addEventListener("input", updateFilterCount);
  }
}

function renderWeightFilters() {
  const container = document.querySelector('input[name="weight-filter"]').closest("fieldset");
  const legend = container.querySelector("legend");
  const weights = [...new Set([
    "50g", "100g", "200g", "500g", "1kg", "2kg", "5kg",
    ...products.map((product) => product.weight)
  ])];
  const priority = ["50g", "100g", "200g", "500g", "1kg", "2kg", "5kg"];
  weights.sort((first, second) => {
    const firstPriority = priority.indexOf(first);
    const secondPriority = priority.indexOf(second);
    if (firstPriority !== -1 || secondPriority !== -1) {
      if (firstPriority === -1) return 1;
      if (secondPriority === -1) return -1;
      return firstPriority - secondPriority;
    }
    return first.localeCompare(second, undefined, { numeric: true });
  });
  container.replaceChildren(legend);
  for (const weight of weights) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "weight-filter";
    input.value = weight;
    label.append(input, document.createTextNode(` ${weight}`));
    container.append(label);
  }
}

renderBrandFilters();
renderCategoryFilters();
renderWeightFilters();

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function getQuantityInput(button) {
  return button.closest(".product-card__controls").querySelector('input[type="number"]');
}

function normalizeQuantity(input) {
  const parsed = Number.parseInt(input.value, 10);
  const quantity = Number.isFinite(parsed) ? Math.min(99, Math.max(1, parsed)) : 1;
  input.value = String(quantity);
  return quantity;
}

function updateCart() {
  let totalItems = 0;
  for (const quantity of cart.values()) totalItems += quantity;

  writeStorage(cartStorageKey, [...cart]);
  cartCount.textContent = String(totalItems);
  drawerCount.textContent = `(${totalItems})`;
  document.querySelector("#open-cart").setAttribute("aria-label", `Open cart, ${totalItems} ${totalItems === 1 ? "item" : "items"}`);
  cartItems.replaceChildren();
  invalidateOrderPreview();

  for (const [id, quantity] of cart) {
    const product = products.find((item) => item.id === id);
    const row = document.createElement("div");
    row.className = "cart-item";
    row.dataset.product = id;
    row.innerHTML = `
      <div class="cart-item__info">
        <strong></strong>
        <span></span>
      </div>
      <div class="cart-item__actions">
        <button type="button" data-cart-change="-1">−</button>
        <span>${quantity}</span>
        <button type="button" data-cart-change="1">+</button>
        <button class="cart-item__remove" type="button" data-cart-remove>×</button>
      </div>
    `;
    const name = product?.name || "Unavailable catalog item";
    row.querySelector(".cart-item__info strong").textContent = name;
    row.querySelector(".cart-item__info span").textContent = product
      ? liveCatalogEnabled
        ? `₹${product.price} each${product.stockQuantity < quantity ? ` · only ${product.stockQuantity} in stock` : ""}`
        : `₹${product.price} DEMO each · not a store price`
      : "This item is no longer available. Remove it before checkout.";
    row.querySelector('[data-cart-change="-1"]').setAttribute("aria-label", `Decrease quantity of ${name}`);
    const increase = row.querySelector('[data-cart-change="1"]');
    increase.setAttribute("aria-label", `Increase quantity of ${name}`);
    increase.disabled = !product || (liveCatalogEnabled && quantity >= product.stockQuantity);
    row.querySelector("[data-cart-remove]").setAttribute("aria-label", `Remove ${name} from cart`);
    if (!product) {
      row.querySelector('[data-cart-change="-1"]').hidden = true;
      row.querySelector('[data-cart-change="1"]').hidden = true;
      row.querySelector(".cart-item__actions span").hidden = true;
    }
    cartItems.append(row);
  }

  const isEmpty = totalItems === 0;
  cartEmpty.hidden = !isEmpty;
  cartFooter.hidden = isEmpty;
  cartItems.hidden = isEmpty;
}

function updateWishlist() {
  writeStorage(wishlistStorageKey, [...wishlist]);
  document.querySelector("#wishlist-count").textContent = String(wishlist.size);
  document.querySelector("#show-wishlist").setAttribute("aria-pressed", String(showWishlistOnly));
  document.querySelectorAll("[data-wishlist]").forEach((button) => {
    const saved = wishlist.has(button.dataset.wishlist);
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", `${saved ? "Remove" : "Add"} ${products.find((item) => item.id === button.dataset.wishlist).name} ${saved ? "from" : "to"} wishlist`);
  });
}

function captureFilterControls() {
  const selectedPrice = document.querySelector('input[name="price-filter"]:checked')?.value ?? "";
  const customMinimum = document.querySelector("#price-min").value;
  const customMaximum = document.querySelector("#price-max").value;
  const categories = getSelectedValues("category-filter");
  const weights = getSelectedValues("weight-filter");
  const rating = document.querySelector('input[name="rating-filter"]:checked')?.value ?? "";
  const brands = getSelectedValues("brand-filter");
  return {
    selectedPrice,
    minimum: customMinimum === "" ? null : Number(customMinimum),
    maximum: customMaximum === "" ? null : Number(customMaximum),
    categories,
    weights,
    rating: rating === "" ? null : Number(rating),
    brands
  };
}

function updateFilterCount() {
  const filters = captureFilterControls();
  const activeCount = Number(Boolean(filters.selectedPrice || filters.minimum !== null || filters.maximum !== null))
    + filters.categories.length + filters.weights.length + Number(filters.rating !== null) + filters.brands.length;
  filterCount.textContent = String(activeCount);
  filterCount.hidden = activeCount === 0;
}

function renderSelectedFilterChips(filters) {
  const container = document.querySelector("#selected-filter-chips");
  const chips = [];
  if (filters.selectedPrice) {
    const labels = { "under-50": "Under ₹50", "50-100": "₹50–₹100", "100-200": "₹100–₹200", "200-500": "₹200–₹500" };
    chips.push({ type: "price", label: labels[filters.selectedPrice] });
  }
  if (filters.minimum !== null || filters.maximum !== null) {
    chips.push({ type: "custom-price", label: `₹${filters.minimum ?? 0} – ₹${filters.maximum ?? "∞"}` });
  }
  for (const weight of filters.weights) chips.push({ type: "weight", value: weight, label: weight });
  if (filters.rating !== null) chips.push({ type: "rating", label: `${filters.rating}+ stars` });
  for (const category of filters.categories) {
    const categoryDetails = categories.find((item) => item.id === category);
    chips.push({ type: "category", value: category, label: categoryDetails?.name ?? category });
  }
  for (const brand of filters.brands) chips.push({ type: "brand", value: brand, label: brand });

  container.replaceChildren();
  container.hidden = chips.length === 0;
  for (const chip of chips) {
    const button = document.createElement("button");
    button.className = "selected-filter-chip";
    button.type = "button";
    button.dataset.filterType = chip.type;
    if (chip.value) button.dataset.filterValue = chip.value;
    button.setAttribute("aria-label", `Remove ${chip.label} filter`);
    button.append(document.createTextNode(chip.label));
    const remove = document.createElement("span");
    remove.setAttribute("aria-hidden", "true");
    remove.textContent = "×";
    button.append(remove);
    container.append(button);
  }
}

function renderRecentlyViewed() {
  const section = document.querySelector("#recently-viewed-section");
  const list = document.querySelector("#recently-viewed-list");
  list.replaceChildren();
  section.hidden = recentlyViewed.length === 0;
  for (const id of recentlyViewed) {
    const product = products.find((item) => item.id === id);
    const card = primaryProductCards.find((item) => item.dataset.product === id);
    if (!product || !card) continue;
    const button = document.createElement("button");
    button.className = "recently-viewed__item";
    button.type = "button";
    button.dataset.recentProduct = id;
    const image = card.querySelector("img").cloneNode();
    image.loading = "lazy";
    const name = document.createElement("span");
    name.textContent = product.name;
    button.append(image, name);
    list.append(button);
  }
}

function openQuickView(id) {
  const product = products.find((item) => item.id === id);
  const card = primaryProductCards.find((item) => item.dataset.product === id);
  if (!product || !card) return;

  const previousIndex = recentlyViewed.indexOf(id);
  if (previousIndex !== -1) recentlyViewed.splice(previousIndex, 1);
  recentlyViewed.unshift(id);
  recentlyViewed.length = Math.min(recentlyViewed.length, 5);
  renderRecentlyViewed();
  quickViewContent.replaceChildren();

  const cardImage = card.querySelector("img");
  const image = cardImage
    ? cardImage.cloneNode()
    : makeImagePlaceholder("quick-view__image product-card__placeholder");
  if (cardImage) image.loading = "eager";
  image.className = "quick-view__image";
  const details = document.createElement("div");
  details.className = "quick-view__details";
  const category = document.createElement("p");
  category.className = "product-card__category";
  category.textContent = product.categoryLabel.toLocaleUpperCase();
  const heading = document.createElement("h2");
  heading.id = "quick-view-title";
  heading.textContent = product.name;
  const brand = document.createElement("p");
  brand.textContent = product.brand;
  const weight = document.createElement("p");
  weight.textContent = product.weight;
  const price = document.createElement("p");
  price.className = "product-card__price";
  price.textContent = liveCatalogEnabled ? `₹${product.price}` : `₹${product.price} DEMO`;
  const actions = document.createElement("div");
  actions.className = "quick-view__actions";
  const addButton = document.createElement("button");
  addButton.className = "button button--primary";
  addButton.type = "button";
  addButton.dataset.quickAdd = id;
  addButton.textContent = liveCatalogEnabled && product.stockQuantity <= 0 ? "Out of Stock" : "Add to cart";
  addButton.disabled = liveCatalogEnabled && product.stockQuantity <= 0;
  const favoriteButton = document.createElement("button");
  favoriteButton.className = "button button--outline";
  favoriteButton.type = "button";
  favoriteButton.dataset.quickWishlist = id;
  favoriteButton.textContent = wishlist.has(id) ? "Remove from wishlist" : "Add to wishlist";
  actions.append(addButton, favoriteButton);
  details.append(category, heading, brand, weight, price);
  if (product.rating !== null) {
    const rating = makeElement("p", "product-rating", `★ ${product.rating}`);
    details.append(rating);
  }
  details.append(actions);
  quickViewContent.append(image, details);
  previousFocus = document.activeElement;
  quickViewDialog.showModal();
}

function invalidateOrderPreview() {
  currentOrderDraft = null;
  orderPreview.hidden = true;
  checkoutForm.hidden = false;
}

function openCart() {
  previousFocus = document.activeElement;
  cartOverlay.hidden = false;
  document.body.classList.add("cart-open");
  document.querySelector("#close-cart").focus();
}

function closeCart() {
  if (cartOverlay.hidden) return;
  cartOverlay.hidden = true;
  document.body.classList.remove("cart-open");
  if (previousFocus instanceof HTMLElement) previousFocus.focus();
}

function getSelectedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function matchesPrice(price, selectedRange) {
  if (!selectedRange) return true;
  if (price === null) return false;
  if (selectedRange === "under-50") return price < 50;
  const [minimum, maximum] = selectedRange.split("-").map(Number);
  return price >= minimum && (maximum === 500 ? price <= maximum : price < maximum);
}

function normalizeSearchValue(value) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeSearchWord(value) {
  const word = normalizeSearchValue(value);
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss")
    ? word.slice(0, -1)
    : word;
}

function applyFilters() {
  const query = normalizeSearchValue(searchInput.value.trim());
  const queryWords = searchInput.value.trim().toLocaleLowerCase().split(/\s+/)
    .filter((word) => word && !["and", "or", "the"].includes(word))
    .map(normalizeSearchWord);
  const filters = appliedFilters ?? captureFilterControls();
  const filteredProducts = products.filter((product) => {
    const card = primaryProductCards.find((item) => item.dataset.product === product.id);
    const imageAlt = card.querySelector("img")?.alt ?? product.categoryLabel;
    const searchableText = normalizeSearchValue(`${product.name} ${product.brand ?? ""} ${product.category} ${imageAlt}`);
    const matchesSearch = queryWords.every((word) => searchableText.includes(word));
    const matchesHomeCategory = !activeCategoryGroup || activeCategoryGroup.id === "all"
      || activeCategoryGroup.categoryIds.includes(product.category);
    const matchesCategory = matchesHomeCategory && (!activeCategoryId || product.category === activeCategoryId)
      && (filters.categories.length === 0 || filters.categories.includes(product.category));
    const matchesPriceRange = matchesPrice(product.price, filters.selectedPrice)
      && (filters.minimum === null || (product.price !== null && product.price >= filters.minimum))
      && (filters.maximum === null || (product.price !== null && product.price <= filters.maximum));
    const matchesWeight = filters.weights.length === 0 || filters.weights.includes(product.weight.toLowerCase());
    const matchesRating = filters.rating === null || (product.rating !== null && product.rating >= filters.rating);
    const matchesBrand = filters.brands.length === 0 || (product.brand !== null
      && filters.brands.some((brand) => product.brand.toLocaleLowerCase() === brand.toLocaleLowerCase()));
    const matchesWishlist = !showWishlistOnly || wishlist.has(product.id);
    return matchesSearch && matchesCategory && matchesPriceRange && matchesWeight && matchesRating && matchesBrand && matchesWishlist;
  });

  const sortBy = sortSelect.value;
  const originalOrder = new Map(products.map((product, index) => [product.id, index]));
  filteredProducts.sort((first, second) => {
    let difference = 0;
    if (sortBy === "price-low" && first.price !== null && second.price !== null) difference = first.price - second.price;
    if (sortBy === "price-high" && first.price !== null && second.price !== null) difference = second.price - first.price;
    if (sortBy === "rating" && first.rating !== null && second.rating !== null) difference = second.rating - first.rating;
    if (sortBy === "popular" && first.popularity !== null && second.popularity !== null) difference = second.popularity - first.popularity;
    if (sortBy === "newest" && first.newest !== null && second.newest !== null) difference = second.newest - first.newest;
    if (difference) return difference;
    if (sortBy === "price-low" || sortBy === "price-high") {
      if (first.price === null && second.price !== null) return 1;
      if (second.price === null && first.price !== null) return -1;
    }
    return originalOrder.get(first.id) - originalOrder.get(second.id);
  });

  for (const card of primaryProductCards) card.hidden = true;
  for (const product of filteredProducts) {
    const card = primaryProductCards.find((item) => item.dataset.product === product.id);
    card.hidden = false;
    productGrid.insertBefore(card, emptyState);
  }
  for (const card of duplicateProductGroup.querySelectorAll(".product-card")) {
    card.hidden = !filteredProducts.some((product) => product.id === card.dataset.product);
  }

  const hasActiveFilters = filters.selectedPrice || filters.minimum !== null || filters.maximum !== null
    || filters.categories.length > 0 || filters.weights.length > 0 || filters.rating !== null || filters.brands.length > 0;
  const isHomeCategoryFiltered = activeCategoryGroup && activeCategoryGroup.id !== "all";
  const isFiltered = Boolean(query || hasActiveFilters || activeCategoryId || isHomeCategoryFiltered || showWishlistOnly || sortSelect.value !== "popular");
  const activeCategory = categories.find((category) => category.id === activeCategoryId);
  const activeCategoryName = activeCategoryGroup && activeCategoryGroup.id !== "all"
    ? activeCategoryGroup.name
    : activeCategory?.name;
  productHeading.textContent = activeCategoryGroup?.id === "all"
    ? "All Products"
    : activeCategoryName ?? "All Products";
  searchInput.placeholder = activeCategoryName
    ? `Search ${activeCategoryName.toLocaleLowerCase()}...`
    : "Search products or brands...";
  searchInput.setAttribute("aria-label", activeCategoryName
    ? `Search products in ${activeCategoryName}`
    : "Search grocery products");
  updateCategorySelection();
  productGrid.classList.toggle("is-filtered", isFiltered);
  productMarquee.closest(".catalog-showcase").hidden = isFiltered
    || (liveCatalogEnabled && !products.some((product) => product.featured));
  emptyState.hidden = filteredProducts.length > 0;
  emptyState.textContent = showWishlistOnly && wishlist.size === 0
    ? "Your wishlist is empty. Save a product with the heart button to see it here."
    : activeCategoryGroup && activeCategoryGroup.id !== "all"
      && !products.some((product) => activeCategoryGroup.categoryIds.includes(product.category))
      ? `No products are listed in ${activeCategoryGroup.name} yet. Add them through the product catalog.`
    : activeCategory && !products.some((product) => product.category === activeCategoryId)
      ? `No products are listed in ${activeCategory.name} yet. Add them through the product catalog.`
      : `No ${liveCatalogEnabled ? "products" : "demo products"} match your search and filters. Try changing or clearing your filters.`;
  document.querySelector("#result-summary").textContent = `${filteredProducts.length} ${filteredProducts.length === 1 ? (liveCatalogEnabled ? "product" : "demo product") : (liveCatalogEnabled ? "products" : "demo products")} shown${isFiltered ? " with current search, filters, and sorting" : ""}.`;
  renderSelectedFilterChips(filters);
  updateFilterCount();
}

function selectHomepageCategory(groupId) {
  const group = homepageCategoryGroups.get(groupId);
  if (!group) return;
  activeCategoryGroup = group;
  activeCategoryId = null;
  searchInput.value = "";
  document.querySelectorAll('input[name="category-filter"]').forEach((input) => {
    input.checked = Array.isArray(group.categoryIds) && group.categoryIds.includes(input.value);
  });
  appliedFilters = captureFilterControls();
  applyFilters();
  document.querySelector("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function searchForTerm(term) {
  activeCategoryGroup = null;
  activeCategoryId = null;
  document.querySelectorAll('#product-filters input[type="checkbox"], #product-filters input[type="radio"]').forEach((input) => {
    input.checked = false;
  });
  document.querySelector("#price-min").value = "";
  document.querySelector("#price-max").value = "";
  sortSelect.value = "popular";
  showWishlistOnly = false;
  document.querySelector("#show-wishlist").classList.remove("is-selected");
  searchInput.value = term;
  appliedFilters = captureFilterControls();
  applyFilters();
  document.querySelector("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleProductCardClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.hasAttribute("data-quantity")) {
    const input = getQuantityInput(button);
    const change = Number(button.dataset.quantity);
    const product = products.find((item) => item.id === button.closest("[data-product]")?.dataset.product);
    const maximum = liveCatalogEnabled ? Math.min(99, Number(product?.stockQuantity) || 0) : 99;
    input.value = String(Math.min(maximum, Math.max(1, normalizeQuantity(input) + change)));
    return;
  }

  if (button.hasAttribute("data-add")) {
    const id = button.dataset.add;
    const quantity = normalizeQuantity(getQuantityInput(button));
    const product = products.find((item) => item.id === id);
    if (!product || !canAddToCart(product, quantity)) return;
    cart.set(id, Math.min(99, (cart.get(id) ?? 0) + quantity));
    updateCart();
    showToast(`${product.name} added to your ${liveCatalogEnabled ? "cart" : "demo cart"}`);
    return;
  }

  if (button.hasAttribute("data-buy-now")) {
    const id = button.dataset.buyNow;
    const quantity = normalizeQuantity(getQuantityInput(button));
    const product = products.find((item) => item.id === id);
    if (!product || !canAddToCart(product, quantity)) return;
    cart.set(id, Math.min(99, (cart.get(id) ?? 0) + quantity));
    updateCart();
    openCart();
    return;
  }

  if (button.hasAttribute("data-wishlist")) {
    const id = button.dataset.wishlist;
    if (wishlist.has(id)) wishlist.delete(id);
    else wishlist.add(id);
    updateWishlist();
    applyFilters();
    return;
  }

  if (button.hasAttribute("data-quick-view")) {
    openQuickView(button.dataset.quickView);
  }
}

productGrid.addEventListener("click", handleProductCardClick);
productMarquee.addEventListener("click", handleProductCardClick);

document.querySelector("#recently-viewed-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-recent-product]");
  if (button) openQuickView(button.dataset.recentProduct);
});

quickViewContent.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.quickAdd ?? button.dataset.quickWishlist;
  if (!id) return;

  if (button.hasAttribute("data-quick-wishlist")) {
    if (wishlist.has(id)) wishlist.delete(id);
    else wishlist.add(id);
    updateWishlist();
    button.textContent = wishlist.has(id) ? "Remove from wishlist" : "Add to wishlist";
    applyFilters();
    return;
  }

  const product = products.find((item) => item.id === id);
  if (!product || !canAddToCart(product, 1)) return;
  cart.set(id, Math.min(99, (cart.get(id) ?? 0) + 1));
  updateCart();
  showToast(`${product.name} added to your ${liveCatalogEnabled ? "cart" : "demo cart"}`);
});

document.querySelector("#close-quick-view").addEventListener("click", () => quickViewDialog.close());
quickViewDialog.addEventListener("click", (event) => {
  if (event.target === quickViewDialog) quickViewDialog.close();
});
quickViewDialog.addEventListener("close", () => {
  if (previousFocus instanceof HTMLElement) previousFocus.focus();
});

categoryGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-home-group]");
  if (button) selectHomepageCategory(button.dataset.homeGroup);
});
document.querySelector(".search-discovery").addEventListener("click", (event) => {
  const button = event.target.closest("[data-search-term]");
  if (button) searchForTerm(button.dataset.searchTerm);
});

searchInput.addEventListener("input", applyFilters);
sortSelect.addEventListener("change", applyFilters);
document.querySelectorAll("#product-filters input").forEach((input) => input.addEventListener("input", updateFilterCount));
document.querySelector("#show-wishlist").addEventListener("click", (event) => {
  showWishlistOnly = !showWishlistOnly;
  event.currentTarget.classList.toggle("is-selected", showWishlistOnly);
  applyFilters();
});
document.querySelector("#clear-filters").addEventListener("click", () => {
  document.querySelectorAll('#product-filters input[type="checkbox"], #product-filters input[type="radio"]').forEach((input) => {
    input.checked = false;
  });
  document.querySelector("#price-min").value = "";
  document.querySelector("#price-max").value = "";
  searchInput.value = "";
  sortSelect.value = "popular";
  showWishlistOnly = false;
  activeCategoryId = null;
  activeCategoryGroup = null;
  document.querySelector("#show-wishlist").classList.remove("is-selected");
  appliedFilters = captureFilterControls();
  closeFilters();
  applyFilters();
});

function openFilters() {
  previousFilterFocus = document.activeElement;
  filterPanel.classList.add("is-open");
  filterPanel.inert = false;
  filterBackdrop.hidden = false;
  filterOpenButton.setAttribute("aria-expanded", "true");
  document.body.classList.add("filters-open");
  document.querySelectorAll("#product-filters input").forEach((input) => input.removeAttribute("aria-invalid"));
  restoreFilterControls(appliedFilters ?? captureFilterControls());
  document.querySelector("#close-filters").focus();
}

function closeFilters() {
  if (!filterPanel.classList.contains("is-open")) return;
  filterPanel.classList.remove("is-open");
  filterPanel.inert = true;
  filterBackdrop.hidden = true;
  filterOpenButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("filters-open");
  restoreFilterControls(appliedFilters ?? captureFilterControls());
  updateFilterCount();
  if (previousFilterFocus instanceof HTMLElement) previousFilterFocus.focus();
}

function restoreFilterControls(filters) {
  if (!filters) return;
  document.querySelectorAll('input[name="price-filter"]').forEach((input) => {
    input.checked = input.value === filters.selectedPrice;
  });
  document.querySelector("#price-min").value = filters.minimum ?? "";
  document.querySelector("#price-max").value = filters.maximum ?? "";
  document.querySelectorAll('input[name="weight-filter"]').forEach((input) => {
    input.checked = filters.weights.includes(input.value);
  });
  document.querySelectorAll('input[name="rating-filter"]').forEach((input) => {
    input.checked = Number(input.value) === filters.rating;
  });
  document.querySelectorAll('input[name="category-filter"]').forEach((input) => {
    input.checked = filters.categories.includes(input.value);
  });
  document.querySelectorAll('input[name="brand-filter"]').forEach((input) => {
    input.checked = filters.brands.includes(input.value);
  });
  updateFilterCount();
}

filterOpenButton.addEventListener("click", openFilters);
document.querySelector("#close-filters").addEventListener("click", closeFilters);
filterBackdrop.addEventListener("click", closeFilters);
document.querySelector("#show-filter-results").addEventListener("click", () => {
  appliedFilters = captureFilterControls();
  activeCategoryId = appliedFilters.categories.length === 1 ? appliedFilters.categories[0] : null;
  activeCategoryGroup = null;
  closeFilters();
  applyFilters();
});
window.addEventListener("resize", () => {
  if (filterPanel.classList.contains("is-open")) closeFilters();
});
document.querySelector("#selected-filter-chips").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter-type]");
  if (!button) return;
  const { filterType, filterValue } = button.dataset;

  if (filterType === "price") document.querySelectorAll('input[name="price-filter"]').forEach((input) => { input.checked = false; });
  if (filterType === "custom-price") {
    document.querySelector("#price-min").value = "";
    document.querySelector("#price-max").value = "";
  }
  if (filterType === "weight") document.querySelector(`input[name="weight-filter"][value="${CSS.escape(filterValue)}"]`).checked = false;
  if (filterType === "rating") document.querySelectorAll('input[name="rating-filter"]').forEach((input) => { input.checked = false; });
  if (filterType === "category") document.querySelector(`input[name="category-filter"][value="${CSS.escape(filterValue)}"]`).checked = false;
  if (filterType === "brand") document.querySelector(`input[name="brand-filter"][value="${CSS.escape(filterValue)}"]`).checked = false;

  appliedFilters = captureFilterControls();
  activeCategoryId = appliedFilters.categories.length === 1 ? appliedFilters.categories[0] : null;
  activeCategoryGroup = null;
  applyFilters();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchInput.value = "";
    applyFilters();
    searchInput.blur();
  }
});

document.querySelector(".search-box").addEventListener("click", (event) => {
  if (window.matchMedia("(max-width: 580px)").matches && !event.currentTarget.classList.contains("is-open")) {
    event.currentTarget.classList.add("is-open");
    searchInput.focus();
  }
});

searchInput.addEventListener("blur", () => {
  if (!searchInput.value) document.querySelector(".search-box").classList.remove("is-open");
});

document.querySelector("#open-cart").addEventListener("click", openCart);
document.querySelector("#close-cart").addEventListener("click", closeCart);
document.querySelector(".cart-overlay__backdrop").addEventListener("click", closeCart);
document.querySelector("#continue-shopping").addEventListener("click", closeCart);

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const row = button.closest(".cart-item");
  const id = row.dataset.product;
  if (button.hasAttribute("data-cart-remove")) {
    cart.delete(id);
  } else {
    const quantity = (cart.get(id) ?? 0) + Number(button.dataset.cartChange);
    if (quantity <= 0) cart.delete(id);
    else {
      const product = products.find((item) => item.id === id);
      const change = Number(button.dataset.cartChange);
      if (!product || (change > 0 && !canAddToCart(product, change))) return;
      cart.set(id, Math.min(99, quantity));
    }
  }
  updateCart();
});

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (cart.size === 0) {
    showToast("Add a product to your cart before placing an order");
    return;
  }

  const unavailable = [...cart].find(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return !product || (liveCatalogEnabled && (product.stockQuantity <= 0 || quantity > product.stockQuantity));
  });
  if (unavailable) {
    showToast("Remove unavailable items or adjust quantities to current stock before checkout");
    return;
  }

  const formData = new FormData(checkoutForm);
  const orderId = `IGS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const itemLines = [...cart].map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return `- ${product.name} (${product.weight}) x ${quantity} — ₹${product.price}${liveCatalogEnabled ? " each" : " DEMO each; not the shop price"}`;
  });
  const liveTotal = [...cart].reduce((total, [id, quantity]) => (
    total + (products.find((item) => item.id === id).price * quantity)
  ), 0);
  const message = [
    "*New order request — Inder General Store*",
    `Order ID: ${orderId}`,
    `Customer name: ${formData.get("customerName").trim()}`,
    `Mobile number: ${formData.get("mobile").trim()}`,
    `Delivery address: ${formData.get("address").trim()}`,
    "",
    "Items:",
    ...itemLines,
    "",
    liveCatalogEnabled
      ? `Current catalog total: ₹${liveTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}. Store must confirm availability and final total.`
      : "Total amount: To be confirmed (the demo prices above are not shop prices)",
    "",
    liveCatalogEnabled
      ? "Please confirm the exact products, prices, availability, and delivery. This WhatsApp request is not a confirmed order until the store accepts it."
      : "Please confirm the exact products, prices, availability, and delivery. This order request is not confirmed until the customer sends this message."
  ].join("\n");

  currentOrderDraft = { orderId, message };
  orderMessagePreview.textContent = `Order request ${orderId} is ready. Review your details, then continue to WhatsApp to send it.`;
  whatsappConfirmLink.href = `https://wa.me/919289648518?text=${encodeURIComponent(message)}`;
  checkoutForm.hidden = true;
  orderPreview.hidden = false;
});

document.querySelector("#edit-order").addEventListener("click", () => {
  invalidateOrderPreview();
});

whatsappConfirmLink.addEventListener("click", (event) => {
  if (!currentOrderDraft) {
    event.preventDefault();
    showToast("Please enter your details and place the order again");
    return;
  }
  showToast("WhatsApp opened. Send the message there to submit your order request.");
});

productMarquee.addEventListener("pointerdown", () => {
  productMarquee.classList.add("is-touching");
});
for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
  productMarquee.addEventListener(eventName, () => {
    productMarquee.classList.remove("is-touching");
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    closeFilters();
  }

  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }

  if (event.key === "Tab" && !cartOverlay.hidden) {
    const focusable = [...cartDrawer.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled)')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (event.key === "Tab" && filterPanel.classList.contains("is-open")) {
    const focusable = [...filterPanel.querySelectorAll('button:not(:disabled), input:not(:disabled), summary, [href]')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

if (storageWarning) showToast("Browser storage is unavailable or invalid; cart and wishlist may not persist.");
appliedFilters = captureFilterControls();
updateWishlist();
applyFilters();
updateCart();
filterPanel.inert = true;
window.addEventListener("inder:catalog-update", (event) => {
  const { products: liveProducts, categories: liveCategories } = event.detail || {};
  if (!Array.isArray(liveProducts) || !Array.isArray(liveCategories)) {
    console.error("Firebase returned an invalid customer catalog update.");
    return;
  }
  categories = liveCategories.filter(isRelevantCustomerCategory);
  const relevantCategoryIds = new Set(categories.map((category) => category.id));
  products = liveProducts.filter((product) => relevantCategoryIds.has(product.category));
  liveCatalogEnabled = true;
  document.querySelector("#catalog-heading-note").textContent = "Browse the latest products, prices, and stock managed by the store.";
  document.querySelector("#product-marquee").setAttribute("aria-label", "Featured store products");
  document.querySelector("#cart-preview-note").textContent = "Catalog prices and availability may change. The store confirms your WhatsApp order request before it is accepted.";
  renderCatalog();
});
if (window.inderLiveCatalog) {
  window.dispatchEvent(new CustomEvent("inder:catalog-update", { detail: window.inderLiveCatalog }));
}
if (hasLegacyCartItems || hasLegacyWishlistItems) {
  showToast("Your previous category selections were removed from the demo cart and wishlist. Please choose products again.");
}
