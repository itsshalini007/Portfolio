import { supabaseConfig } from "./supabase-config.js";

let selectedAuthStorage = null;

const authStorage = {
  getItem(key) {
    const localValue = window.localStorage.getItem(key);
    const sessionValue = window.sessionStorage.getItem(key);
    if (selectedAuthStorage) {
      const selectedValue = selectedAuthStorage.getItem(key);
      if (selectedValue !== null) return selectedValue;
      const otherStorage = selectedAuthStorage === window.localStorage
        ? window.sessionStorage
        : window.localStorage;
      const otherValue = otherStorage.getItem(key);
      if (otherValue !== null) {
        selectedAuthStorage.setItem(key, otherValue);
        otherStorage.removeItem(key);
      }
      return otherValue;
    }

    if (localValue !== null) {
      selectedAuthStorage = window.localStorage;
      return localValue;
    }
    if (sessionValue !== null) {
      selectedAuthStorage = window.sessionStorage;
      return sessionValue;
    }
    selectedAuthStorage = window.localStorage;
    return null;
  },
  setItem(key, value) {
    const target = selectedAuthStorage || window.localStorage;
    target.setItem(key, value);
    (target === window.localStorage ? window.sessionStorage : window.localStorage).removeItem(key);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

const configured = typeof supabaseConfig.url === "string"
  && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseConfig.url.trim())
  && typeof supabaseConfig.publishableKey === "string"
  && supabaseConfig.publishableKey.trim().length > 0;

let clientPromise = null;

export function isSupabaseConfigured() {
  return configured;
}

export function setSupabasePersistence(persistence) {
  if (persistence === "local") selectedAuthStorage = window.localStorage;
  else if (persistence === "session") selectedAuthStorage = window.sessionStorage;
  else throw new Error(`Unsupported Supabase session persistence: ${persistence}`);
}

export function getSupabaseClient() {
  if (!configured) {
    throw new Error("Supabase is not configured. Add the project URL and publishable key in supabase-config.js.");
  }
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => (
      createClient(supabaseConfig.url.trim(), supabaseConfig.publishableKey.trim(), {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
          storage: authStorage
        },
        realtime: { params: { eventsPerSecond: 5 } }
      })
    ));
  }
  return clientPromise;
}
