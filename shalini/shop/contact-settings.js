import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";

function renderStoreSettings(settings) {
  const storeFields = {
    store_name: settings.store_name,
    address: settings.address,
    phone: settings.phone,
    alternate_phone: settings.alternate_phone,
    email: settings.email,
    opening_days: settings.opening_days,
    opening_time: settings.opening_time,
    closing_time: settings.closing_time,
    delivery_area: settings.delivery_area,
    delivery_schedule: settings.delivery_schedule
  };
  for (const [field, value] of Object.entries(storeFields)) {
    if (typeof value !== "string" || !value.trim()) continue;
    document.querySelectorAll(`[data-store-field="${field}"]`).forEach((element) => {
      element.textContent = value;
    });
  }
  for (const element of document.querySelectorAll("[data-store-link]")) {
    const field = element.dataset.storeLink;
    const value = storeFields[field];
    if (typeof value !== "string" || !value.trim()) continue;
    element.href = field === "email" ? `mailto:${value}` : `tel:${value.replace(/[^\d+]/g, "")}`;
  }
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(settings.address)}`;
  document.querySelectorAll("[data-store-directions]").forEach((element) => {
    element.href = directionsUrl;
  });
  const whatsappNumber = String(settings.phone || "").replace(/\D/g, "");
  if (whatsappNumber) {
    const internationalNumber = whatsappNumber.startsWith("91") ? whatsappNumber : `91${whatsappNumber}`;
    document.querySelectorAll("[data-store-whatsapp]").forEach((element) => {
      element.href = `https://wa.me/${internationalNumber}?text=${encodeURIComponent("Hello Inder General Store, I have a question.")}`;
    });
  }
  document.querySelectorAll("[data-store-hours]").forEach((element) => {
    element.textContent = `${settings.opening_time} – ${settings.closing_time}`;
  });
  document.querySelectorAll("[data-store-minimum-order]").forEach((element) => {
    element.textContent = settings.minimum_order == null
      ? "No minimum order"
      : `Minimum order: ₹${Number(settings.minimum_order).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  });

  const isAvailable = settings.delivery_available !== false;
  document.querySelectorAll("[data-delivery-availability]").forEach((element) => {
    element.textContent = isAvailable ? "Home Delivery Available" : "Home Delivery Unavailable";
  });

  const charge = Number(settings.delivery_charge);
  const hasCharge = settings.delivery_charge !== null
    && settings.delivery_charge !== undefined
    && Number.isFinite(charge)
    && charge >= 0;
  const chargeLabel = hasCharge
    ? `Fixed delivery charge: ₹${charge.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : "Fixed delivery charge applies; amount to be confirmed.";
  document.querySelectorAll("[data-delivery-charge]").forEach((element) => {
    element.textContent = chargeLabel;
  });

  document.querySelectorAll("[data-delivery-note]").forEach((element) => {
    element.textContent = isAvailable
      ? "Contact the store to confirm delivery details for your order."
      : "Home delivery is currently unavailable. Please contact the store for assistance.";
  });
}

function showSettingsError(error) {
  console.error("Could not load current store settings from Supabase.", error);
  document.querySelectorAll("[data-delivery-availability]").forEach((element) => {
    element.textContent = "Contact the store to confirm availability";
  });
  document.querySelectorAll("[data-delivery-charge]").forEach((element) => {
    element.textContent = "Contact the store to confirm delivery charges.";
  });
  document.querySelectorAll("[data-delivery-note]").forEach((element) => {
    element.textContent = "Current delivery updates could not be loaded. Please call the store to confirm.";
  });
}

async function initializeStoreSettings() {
  if (!isSupabaseConfigured()) return;

  try {
    const client = await getSupabaseClient();
    const loadSettings = async () => {
      const { data, error } = await client
        .from("store_settings")
        .select("*")
        .eq("id", "store")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("The store settings record has not been initialized.");
      renderStoreSettings(data);
    };

    await loadSettings();
    client.channel("customer-store-settings")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "store_settings",
        filter: "id=eq.store"
      }, () => loadSettings().catch(showSettingsError))
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`Supabase store settings realtime subscription status: ${status}.`);
        }
      });
  } catch (error) {
    showSettingsError(error);
  }
}

initializeStoreSettings();
