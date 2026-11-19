import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";

const notice = document.querySelector("#catalog-notice-copy");

function setCatalogNotice(message) {
  notice.textContent = message;
}

function safeImageUrl(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value, window.location.href);
    const isRelative = !/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith("//");
    return url.protocol === "https:" || (isRelative && url.origin === window.location.origin)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function publishCatalog(productRows, categoryRows) {
  const categories = categoryRows.map((entry) => ({
    id: entry.id,
    name: entry.name,
    icon: "🛒",
    imageUrl: safeImageUrl(entry.image_url)
      || safeImageUrl(window.inderCategories?.find((category) => category.id === entry.id)?.imageUrl)
  })).filter((category) => typeof category.name === "string" && category.name.trim());
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const products = productRows.flatMap((entry) => {
    const category = categoryById.get(entry.category_id);
    const price = Number(entry.price);
    const mrp = Number(entry.mrp);
    const stockQuantity = Number(entry.stock_quantity);
    if (entry.status !== "active" || !category) return [];
    if (typeof entry.name !== "string" || !entry.name.trim()
      || !Number.isFinite(price) || price <= 0
      || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      console.error(`Skipped invalid active catalog product ${entry.id}.`);
      return [];
    }

    return [{
      id: entry.id,
      name: entry.name,
      category: category.id,
      categoryLabel: category.name,
      categoryIcon: category.icon,
      image: safeImageUrl(entry.image_url),
      price,
      originalPrice: Number.isFinite(mrp) && mrp > price ? mrp : null,
      discount: Number.isFinite(mrp) && mrp > price
        ? Math.round(((mrp - price) / mrp) * 100)
        : null,
      weight: typeof entry.weight === "string" ? entry.weight : "",
      brand: typeof entry.brand === "string" ? entry.brand : "",
      description: typeof entry.description === "string" ? entry.description : "",
      stockQuantity,
      featured: entry.featured === true,
      rating: null,
      popularity: null,
      newest: null
    }];
  });

  window.inderLiveCatalog = { products, categories };
  window.dispatchEvent(new CustomEvent("inder:catalog-update", {
    detail: window.inderLiveCatalog
  }));
  setCatalogNotice("LIVE STORE CATALOG: Prices and stock reflect the latest store catalog. Please confirm availability with the store.");
}

async function initializeCatalog() {
  if (!isSupabaseConfigured()) return;

  const client = await getSupabaseClient();
  let latestProducts = null;
  let latestCategories = null;

  async function loadCatalog() {
    const [productsResult, categoriesResult] = await Promise.all([
      client.from("products").select("*").eq("status", "active"),
      client.from("categories").select("*")
    ]);
    if (productsResult.error) throw productsResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    latestProducts = productsResult.data;
    latestCategories = categoriesResult.data;
    publishCatalog(latestProducts, latestCategories);
  }

  async function handleRealtimeChange() {
    try {
      await loadCatalog();
    } catch (error) {
      console.error("Could not refresh the customer catalog from Supabase.", error);
      if (!latestProducts || !latestCategories) {
        setCatalogNotice("Live catalog could not be loaded. Showing the clearly marked sample catalog instead.");
      } else {
        setCatalogNotice("Live catalog loaded, but Supabase reported a sync error. Some recent updates may not be shown.");
      }
    }
  }

  await loadCatalog();
  client.channel("customer-catalog")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, handleRealtimeChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, handleRealtimeChange)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(`Supabase catalog realtime subscription status: ${status}.`);
        if (latestProducts && latestCategories) {
          setCatalogNotice("Live catalog loaded, but realtime updates are unavailable. Refresh to check for changes.");
        }
      }
    });
  window.setInterval(() => {
    if (document.visibilityState === "visible") {
      loadCatalog().catch((error) => {
        console.error("Periodic Supabase catalog refresh failed.", error);
      });
    }
  }, 60000);
}

initializeCatalog().catch((error) => {
  console.error("Supabase customer catalog initialization failed.", error);
  setCatalogNotice("Live catalog could not be initialized. Showing the clearly marked sample catalog instead.");
});
