import { setSupabasePersistence } from "./supabase-client.js";

const tableNames = {
  categories: "categories",
  products: "products",
  delivery: "store_settings",
  users: "profiles",
  addresses: "addresses",
  preferences: "customer_preferences",
  orders: "orders"
};

const fieldNames = {
  categoryId: "category_id",
  stockQuantity: "stock_quantity",
  imageUrl: "image_url",
  imagePath: "image_path",
  createdAt: "created_at",
  updatedAt: "updated_at",
  displayName: "display_name",
  phoneNumber: "phone_number",
  recipientName: "recipient_name",
  personalizedRecommendations: "personalized_recommendations",
  customerName: "customer_name",
  mobileNumber: "mobile_number",
  deliveryAddress: "delivery_address",
  deliveryCharge: "delivery_charge",
  subtotal: "subtotal",
  total: "total",
  orderId: "id",
  userId: "user_id",
  productId: "product_id",
  unitPrice: "unit_price",
  orderItems: "order_items",
  deliveryAvailable: "delivery_available",
  storeName: "store_name",
  alternatePhone: "alternate_phone",
  openingDays: "opening_days",
  openingTime: "opening_time",
  closingTime: "closing_time",
  deliveryArea: "delivery_area",
  deliverySchedule: "delivery_schedule",
  minimumOrder: "minimum_order"
};

function toDatabase(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [
    fieldNames[key] || key,
    value instanceof Date ? value.toISOString() : value
  ]));
}

function toClient(data) {
  const mapped = Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [
    Object.entries(fieldNames).find(([, databaseName]) => databaseName === key)?.[0] || key,
    value
  ]));
  for (const key of ["createdAt", "updatedAt"]) {
    if (typeof mapped[key] === "string") {
      const date = new Date(mapped[key]);
      mapped[key] = { toDate: () => date };
    }
  }
  return mapped;
}

function makeDocument(row, idOverride) {
  const id = idOverride || row?.id || "";
  const ref = row?.user_id && row?.status
    ? { path: ["users", row.user_id, "orders", id] }
    : null;
  return {
    id,
    ref,
    exists: () => Boolean(row),
    data: () => toClient(row || {})
  };
}

function makeSnapshot(rows) {
  const docs = rows.map((row) => makeDocument(row));
  return { docs, size: docs.length, empty: docs.length === 0 };
}

function getPath(ref) {
  if (typeof ref === "string") return ref.split("/").filter(Boolean);
  return ref.path;
}

function tableForPath(path) {
  if (path[0] === "storeSettings" && path[1] === "delivery") {
    return { table: tableNames.delivery, id: "store", parentId: null };
  }
  if (path[0] === "users" && path.length === 2) {
    return { table: tableNames.users, id: path[1], parentId: path[1] };
  }
  if (path[0] === "users" && path[2] === "addresses") {
    return { table: tableNames.addresses, id: path[3] || null, parentId: path[1] };
  }
  if (path[0] === "users" && path[2] === "settings" && path[3] === "preferences") {
    return { table: tableNames.preferences, id: path[3], parentId: path[1] };
  }
  if (path[0] === "users" && path[2] === "orders") {
    return { table: tableNames.orders, id: path[3] || null, parentId: path[1] };
  }
  if (path[0] === "users" && path.length === 1) {
    return { table: tableNames.users, id: null, parentId: null };
  }
  if (path[0] === "products" || path[0] === "categories") {
    return { table: tableNames[path[0]], id: path[1] || null, parentId: null };
  }
  if (path[0] === "orders" && path.length === 1) {
    return { table: tableNames.orders, id: null, parentId: null };
  }
  throw new Error(`Unsupported Supabase compatibility path: ${path.join("/")}`);
}

function rowForPath(path, value) {
  const target = tableForPath(path);
  const row = toDatabase(value);
  if (target.table === "profiles") return { id: target.parentId, ...row };
  if (target.table === "addresses" || target.table === "orders") {
    return { user_id: target.parentId, ...row };
  }
  if (target.table === "customer_preferences") return { user_id: target.parentId, ...row };
  if (target.table === "store_settings") return { id: "store", ...row };
  if (target.id && target.table === "categories") return { id: target.id, ...row };
  if (target.id && target.table === "products") return { id: target.id, ...row };
  return row;
}

function makeAuthUser(client, user) {
  if (!user) return null;
  const providers = user.app_metadata?.providers || [];
  return {
    ...user,
    uid: user.id,
    phoneNumber: user.phone || null,
    displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || "",
    emailVerified: Boolean(user.email_confirmed_at),
    providerData: providers.map((providerId) => ({
      providerId: providerId === "email" ? "password" : providerId
    })),
    async getIdTokenResult() {
      const { data, error } = await client
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return { claims: { admin: Boolean(data) } };
    }
  };
}

export function createSupabaseCompat(client) {
  const addressIdByVerification = new Map();
  const auth = { _currentUser: null, client };
  Object.defineProperty(auth, "currentUser", {
    get() { return auth._currentUser; }
  });

  const sdk = {
    browserLocalPersistence: "local",
    browserSessionPersistence: "session",
    serverTimestamp: () => new Date().toISOString(),
    getAuth: () => auth,
    getFirestore: () => client,
    getStorage: () => client.storage,
    setPersistence: async (_auth, persistence) => {
      setSupabasePersistence(persistence);
    },
    onAuthStateChanged: (_auth, callback) => {
      client.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        const user = makeAuthUser(client, data.session?.user);
        auth._currentUser = user;
        callback(user);
      }).catch((error) => console.error("Could not read the Supabase session.", error));
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        auth._currentUser = makeAuthUser(client, session?.user);
        callback(auth._currentUser);
      });
      return { unsubscribe: () => data.subscription.unsubscribe() };
    },
    signInWithEmailAndPassword: async (_auth, email, password) => {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      auth._currentUser = makeAuthUser(client, data.user);
      return { user: auth._currentUser };
    },
    signOut: async () => {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      auth._currentUser = null;
    },
    sendPasswordResetEmail: async (_auth, email) => {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) throw error;
    },
    signInWithPhoneNumber: async (_auth, phone) => {
      const { error } = await client.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: true }
      });
      if (error) throw error;
      return {
        confirm: async (token) => {
          const { data, error: verifyError } = await client.auth.verifyOtp({
            phone,
            token,
            type: "sms"
          });
          if (verifyError) throw verifyError;
          auth._currentUser = makeAuthUser(client, data.user);
          return { user: auth._currentUser };
        }
      };
    },
    updateProfile: async (user, profile) => {
      const { data, error } = await client.auth.updateUser({
        data: { display_name: profile.displayName }
      });
      if (error) throw error;
      auth._currentUser = makeAuthUser(client, data.user);
      Object.assign(user, auth._currentUser);
    },
    EmailAuthProvider: {
      credential: (email, password) => ({ email, password })
    },
    linkWithCredential: async (_user, credential) => {
      const { data, error } = await client.auth.updateUser({
        email: credential.email,
        password: credential.password
      });
      if (error) throw error;
      auth._currentUser = makeAuthUser(client, data.user);
      return { user: auth._currentUser };
    },
    updatePhoneNumber: async (_user, credential) => {
      const phone = addressIdByVerification.get(credential.verificationId);
      if (!phone) throw new Error("Request a new phone verification code and try again.");
      const { data, error } = await client.auth.verifyOtp({
        phone,
        token: credential.verificationCode,
        type: "phone_change"
      });
      if (error) throw error;
      auth._currentUser = makeAuthUser(client, data.user);
    },
    PhoneAuthProvider: class {
      constructor() {}
      async verifyPhoneNumber(phone) {
        const { error } = await client.auth.updateUser({ phone });
        if (error) throw error;
        const verificationId = crypto.randomUUID();
        addressIdByVerification.set(verificationId, phone);
        return verificationId;
      }
      static credential(verificationId, verificationCode) {
        return { verificationId, verificationCode };
      }
    },
    doc: (...parts) => {
      const path = parts[0] === client
        ? parts.slice(1)
        : parts[0]?.path
          ? [...parts[0].path, ...parts.slice(1)]
          : parts;
      return { path };
    },
    collection: (...parts) => {
      const path = parts[0] === client
        ? parts.slice(1)
        : parts[0]?.path
          ? [...parts[0].path, ...parts.slice(1)]
          : parts;
      return { path };
    },
    collectionGroup: (_db, name) => ({ path: [name], collectionGroup: true }),
    where: (field, operator, value) => ({ field, operator, value }),
    query: (ref, ...constraints) => ({ ...ref, constraints }),
    async getDoc(ref) {
      const path = getPath(ref);
      const target = tableForPath(path);
      let request = client.from(target.table).select("*");
      if (target.table === "store_settings") request = request.eq("id", "store");
      else if (target.table === "profiles") request = request.eq("id", target.id);
      else if (target.table === "addresses" || target.table === "orders" || target.table === "customer_preferences") {
        if (target.table === "customer_preferences") request = request.eq("user_id", target.parentId);
        else request = request.eq("user_id", target.parentId).eq("id", target.id);
      } else request = request.eq("id", target.id);
      const { data, error } = await request.maybeSingle();
      if (error) throw error;
      if (target.table === "orders" && data) {
        const items = await client.from("order_items").select("*").eq("order_id", data.id);
        if (items.error) throw items.error;
        data.items = items.data.map((item) => ({
          name: item.product_name,
          productId: item.product_id,
          quantity: item.quantity,
          price: item.unit_price,
          weight: item.weight
        }));
      }
      return makeDocument(data);
    },
    async getDocs(ref) {
      const path = getPath(ref);
      const target = tableForPath(path);
      let request = client.from(target.table).select("*");
      if (target.table === "addresses" || target.table === "orders" || target.table === "customer_preferences") {
        if (target.parentId) request = request.eq("user_id", target.parentId);
      }
      if (target.table === "store_settings") request = request.eq("id", "store");
      if (ref.collectionGroup) {
        const { data: orders, error } = await request;
        if (error) throw error;
        const joined = await Promise.all(orders.map(async (order) => {
          const { data: items, error: itemsError } = await client.from("order_items").select("*").eq("order_id", order.id);
          if (itemsError) throw itemsError;
          return {
            ...order,
            items: items.map((item) => ({
              name: item.product_name,
              productId: item.product_id,
              quantity: item.quantity,
              price: item.unit_price,
              weight: item.weight
            }))
          };
        }));
        return makeSnapshot(joined);
      }
      for (const constraint of ref.constraints || []) {
        if (constraint.operator === "==") request = request.eq(fieldNames[constraint.field] || constraint.field, constraint.value);
        else throw new Error(`Unsupported query operator: ${constraint.operator}`);
      }
      const { data, error } = await request;
      if (error) throw error;
      if (target.table === "orders") {
        const joined = await Promise.all(data.map(async (order) => {
          const { data: items, error: itemsError } = await client.from("order_items").select("*").eq("order_id", order.id);
          if (itemsError) throw itemsError;
          return {
            ...order,
            items: items.map((item) => ({
              name: item.product_name,
              productId: item.product_id,
              quantity: item.quantity,
              price: item.unit_price,
              weight: item.weight
            }))
          };
        }));
        return makeSnapshot(joined);
      }
      return {
        docs: data.map((row) => ({
          ...makeDocument(row),
          ref: { path: [...path, row.id] }
        })),
        size: data.length,
        empty: data.length === 0
      };
    },
    async setDoc(ref, value, options = {}) {
      const path = getPath(ref);
      const target = tableForPath(path);
      const row = rowForPath(path, value);
      if (target.table === "profiles") {
        if (!row.display_name) return;
        const { data, error } = await client.from(target.table)
          .update({ display_name: row.display_name, updated_at: new Date().toISOString() })
          .eq("id", target.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("The customer profile could not be updated.");
        return;
      }
      if (target.table === "addresses") row.id = target.id;
      if (target.table === "customer_preferences") row.user_id = target.parentId;
      let request = client.from(target.table).upsert(row);
      if (options.merge) request = request.select();
      const { data, error } = await request.select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`No ${target.table} record was updated.`);
    },
    async addDoc(ref, value) {
      const path = getPath(ref);
      const target = tableForPath(path);
      const { data, error } = await client.from(target.table).insert(rowForPath(path, value)).select("id").single();
      if (error) throw error;
      return { id: data.id };
    },
    async updateDoc(ref, value) {
      const path = getPath(ref);
      const target = tableForPath(path);
      const row = toDatabase(value);
      let request = client.from(target.table).update(row);
      if (target.table === "products" || target.table === "categories") request = request.eq("id", target.id);
      else if (target.table === "store_settings") request = request.eq("id", "store");
      else if (target.table === "orders") request = request.eq("id", target.id).eq("user_id", target.parentId);
      else if (target.table === "profiles") request = request.eq("id", target.id);
      else if (target.table === "addresses") request = request.eq("id", target.id).eq("user_id", target.parentId);
      const { data, error } = await request.select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`No ${target.table} record was deleted.`);
    },
    async deleteDoc(ref) {
      const path = getPath(ref);
      const target = tableForPath(path);
      let request = client.from(target.table).delete();
      if (target.table === "products" || target.table === "categories") request = request.eq("id", target.id);
      else if (target.table === "addresses") request = request.eq("id", target.id).eq("user_id", target.parentId);
      const { error } = await request;
      if (error) throw error;
    },
    writeBatch() {
      const writes = [];
      return {
        set(ref, value) { writes.push([ref, value]); },
        async commit() {
          for (const [ref, value] of writes) await sdk.setDoc(ref, value);
        }
      };
    },
    storageRef: (_storage, path) => ({ path }),
    async uploadBytes(ref, file, options = {}) {
      const { error } = await client.storage.from("product-images").upload(ref.path, file, {
        contentType: options.contentType || file.type,
        upsert: true
      });
      if (error) throw error;
    },
    getDownloadURL: async (ref) => {
      const { data } = client.storage.from("product-images").getPublicUrl(ref.path);
      return data.publicUrl;
    },
    async deleteObject(ref) {
      const { error } = await client.storage.from("product-images").remove([ref.path]);
      if (error) throw error;
    }
  };

  const baseDoc = sdk.doc;
  sdk.doc = (...parts) => {
    const ref = baseDoc(...parts);
    if (ref.path[0] === "products" && ref.path.length === 1) {
      ref.path.push(crypto.randomUUID());
    }
    return ref;
  };

  return { auth, db: client, storage: client.storage, sdk };
}

export async function assertStoreAdmin(client, user) {
  if (!user) return false;
  const { data, error } = await client
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
