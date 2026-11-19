import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";
import { createSupabaseCompat } from "./supabase-compat.js";
const accountButton = document.querySelector("#account-button");
const accountButtonLabel = document.querySelector("#account-button-label");
const accountDialog = document.querySelector("#account-dialog");
const accountLogin = document.querySelector("#account-login");
const accountHome = document.querySelector("#account-home");
const accountSubpage = document.querySelector("#account-subpage");
const accountMessage = document.querySelector("#account-message");
const phoneLoginForm = document.querySelector("#phone-login-form");
const loginOtpForm = document.querySelector("#login-otp-form");
const loginLayout = document.querySelector(".account-login-layout");
const signupFlow = document.querySelector("#signup-flow");
const passwordRecovery = document.querySelector("#password-recovery");
const signupForm = document.querySelector("#signup-form");
const signupOtpForm = document.querySelector("#signup-otp-form");
const loginPhone = document.querySelector("#login-phone");
const loginOtp = document.querySelector("#login-otp");
const loginOtpHint = document.querySelector("#login-otp-hint");
const addressForm = document.querySelector("#address-form");
const savedAddressList = document.querySelector("#saved-address-list");
const changeMobileForm = document.querySelector("#change-mobile-form");
const changeMobileOtpForm = document.querySelector("#change-mobile-otp-form");
const firestoreUserPath = (uid, collectionName) => ["users", uid, collectionName];
async function syncCustomerProfile(user) {
  if (!user.phoneNumber || !db || !window.Firebase) return false;
  const pendingSync = customerProfileSyncs.get(user.uid);
  if (pendingSync) return pendingSync;
  const sync = (async () => {
    try {
      const profileRef = window.Firebase.doc(db, "users", user.uid);
      const profileSnapshot = await window.Firebase.getDoc(profileRef);
      const profile = {
        displayName: user.displayName || "",
        phoneNumber: user.phoneNumber,
        updatedAt: window.Firebase.serverTimestamp()
      };
      if (!profileSnapshot.exists()) profile.createdAt = window.Firebase.serverTimestamp();
      await window.Firebase.setDoc(profileRef, profile, { merge: true });
      return true;
    } catch (error) {
      console.error(`Customer profile could not be synced (${error?.code ?? "unknown error"}).`);
      return false;
    }
  })();
  customerProfileSyncs.set(user.uid, sync);
  try {
    return await sync;
  } finally {
    customerProfileSyncs.delete(user.uid);
  }
}
const setupComplete = isSupabaseConfigured();

let auth = null;
let db = null;
let currentUser = null;
let confirmationResult = null;
let newMobileVerificationId = null;
let editingAddressId = null;
let authReady = false;
let confirmationFlow = null;
let resendTimer = null;
const customerProfileSyncs = new Map();

function setMessage(message = "", isError = false) {
  accountMessage.textContent = message;
  accountMessage.hidden = !message;
  accountMessage.classList.toggle("is-error", isError);
  accountMessage.classList.toggle("is-success", Boolean(message) && !isError);
}

function clearResendCountdown() {
  if (resendTimer) window.clearInterval(resendTimer);
  resendTimer = null;
  document.querySelectorAll(".account-countdown").forEach((label) => {
    label.textContent = "";
  });
  document.querySelectorAll("#resend-login-code, #resend-signup-code").forEach((button) => {
    const flow = button.id === "resend-login-code" ? "login" : "signup";
    button.disabled = !authReady || confirmationFlow !== flow;
  });
}

function startResendCountdown(buttonId, labelId, seconds = 30) {
  clearResendCountdown();
  const button = document.querySelector(buttonId);
  const label = document.querySelector(labelId);
  let remaining = seconds;
  button.disabled = true;
  const update = () => {
    label.textContent = remaining > 0 ? `Resend available in ${remaining}s` : "Didn't receive a code?";
    if (remaining <= 0) {
      button.disabled = false;
      window.clearInterval(resendTimer);
      resendTimer = null;
    }
    remaining -= 1;
  };
  update();
  resendTimer = window.setInterval(update, 1000);
}

function setBusy(button, busy, busyText = "Please wait...") {
  if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button.dataset.defaultText;
}

function formatAuthError(error) {
  const messages = {
    "auth/invalid-phone-number": "Enter a valid mobile number with its country code.",
    "auth/missing-phone-number": "Enter your mobile number first.",
    "auth/invalid-verification-code": "That code is incorrect. Check the SMS and try again.",
    "auth/code-expired": "That code has expired. Request a new OTP.",
    "auth/session-expired": "That verification session expired. Request a new OTP.",
    "auth/too-many-requests": "Too many attempts. Please wait before trying again.",
    "auth/quota-exceeded": "SMS verification is temporarily unavailable. Please try again later.",
    "auth/captcha-check-failed": "The security check did not pass. Refresh the verification challenge and try again.",
    "auth/operation-not-allowed": "Phone sign-in is not enabled for this Supabase project.",
    "auth/credential-already-in-use": "That mobile number is already linked to another account.",
    "auth/requires-recent-login": "For your security, sign out and verify your current number again before changing it.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/email-already-in-use": "That email is already linked to another account. Sign in with it or use a different email.",
    "auth/weak-password": "Choose a stronger password with at least 8 characters.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/network-request-failed": "Network connection failed. Check your connection and try again."
  };
  return messages[error?.code] ?? "We couldn't complete that request. Please try again or contact the store.";
}

function reportError(context, error) {
  console.error(`${context} (${error?.code ?? "unknown error"}).`);
  setMessage(formatAuthError(error), true);
}

function normalizePhoneNumber(value) {
  const compact = value.trim().replace(/[()\s-]/g, "");
  const indianMobile = compact.replace(/^0(?=[6-9]\d{9}$)/, "");
  const e164 = /^[6-9]\d{9}$/.test(indianMobile) ? `+91${indianMobile}` : indianMobile;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    throw Object.assign(new Error("Enter a valid mobile number in international format."), {
      code: "auth/invalid-phone-number"
    });
  }
  return e164;
}

function showLogin() {
  accountLogin.hidden = false;
  accountHome.hidden = true;
  accountSubpage.hidden = true;
  loginLayout.hidden = false;
  signupFlow.hidden = true;
  passwordRecovery.hidden = true;
  setMessage();
}

function showAccountHome() {
  accountLogin.hidden = true;
  accountHome.hidden = false;
  accountSubpage.hidden = true;
  if (currentUser) renderProfile();
  setMessage();
}

function showAccountSection(sectionName) {
  if (!currentUser) {
    showLogin();
    return;
  }
  accountHome.hidden = true;
  accountLogin.hidden = true;
  accountSubpage.hidden = false;
  document.querySelectorAll("[data-account-section]").forEach((section) => {
    section.hidden = section.id !== `account-section-${sectionName}`;
  });
  setMessage();

  if (sectionName === "profile") renderProfile();
  if (sectionName === "edit-profile") {
    document.querySelector("#edit-profile-name").value = currentUser.displayName ?? "";
  }
  if (sectionName === "addresses") loadAddresses();
  if (sectionName === "orders") loadOrders("active");
  if (sectionName === "history") loadOrders("history");
  if (sectionName === "wishlist") renderWishlist();
  if (sectionName === "settings") loadSettings();
  if (sectionName === "change-mobile") {
    changeMobileForm.reset();
    changeMobileOtpForm.reset();
    changeMobileOtpForm.hidden = true;
    newMobileVerificationId = null;
  }
}

function renderProfile() {
  document.querySelector("#account-customer-name").textContent = currentUser.displayName || "Add your name";
  document.querySelector("#account-customer-phone").textContent = currentUser.phoneNumber ?? "";
  document.querySelector("#profile-name").textContent = currentUser.displayName || "Not set";
  document.querySelector("#profile-phone").textContent = currentUser.phoneNumber ?? "Not available";
}

function createAccountListMessage(container, message) {
  const paragraph = document.createElement("p");
  paragraph.className = "account-empty";
  paragraph.textContent = message;
  container.replaceChildren(paragraph);
}

function makeAddressCard(address, id) {
  const card = document.createElement("article");
  card.className = "account-list-card";
  const title = document.createElement("h4");
  title.textContent = address.label;
  const details = document.createElement("p");
  details.textContent = `${address.recipientName} · ${address.phone}\n${address.address}, ${address.city} ${address.pincode}`;
  const actions = document.createElement("div");
  actions.className = "account-form__actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "account-text-button";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => {
    editingAddressId = id;
    for (const [key, value] of Object.entries(address)) {
      const input = addressForm.elements.namedItem(key);
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        input.value = String(value ?? "");
      }
    }
    document.querySelector("#address-form-heading").textContent = "Edit address";
    addressForm.querySelector('button[type="submit"]').textContent = "Save Changes";
    document.querySelector("#cancel-address-edit").hidden = false;
    addressForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "account-text-button account-text-button--danger";
  remove.textContent = "Remove";
  remove.addEventListener("click", async () => {
    if (!window.confirm("Remove this saved address?")) return;
    try {
      await window.Firebase.deleteDoc(window.Firebase.doc(db, ...firestoreUserPath(currentUser.uid, "addresses"), id));
      await loadAddresses();
      setMessage("Saved address removed.");
    } catch (error) {
      reportError("Could not remove saved address", error);
    }
  });
  actions.append(edit, remove);
  card.append(title, details, actions);
  return card;
}

async function loadAddresses() {
  savedAddressList.setAttribute("aria-busy", "true");
  try {
    const addressDocs = await window.Firebase.getDocs(
      window.Firebase.collection(db, ...firestoreUserPath(currentUser.uid, "addresses"))
    );
    const cards = addressDocs.docs.map((addressDoc) => (
      makeAddressCard(addressDoc.data(), addressDoc.id)
    ));
    if (cards.length) savedAddressList.replaceChildren(...cards);
    else createAccountListMessage(savedAddressList, "No saved addresses yet. Add one below.");
  } catch (error) {
    reportError("Could not load saved addresses", error);
    createAccountListMessage(savedAddressList, "Saved addresses could not be loaded. Please try again.");
  } finally {
    savedAddressList.removeAttribute("aria-busy");
  }
}

function makeOrderCard(orderDoc) {
  const order = orderDoc.data();
  const card = document.createElement("article");
  card.className = "account-list-card";
  const heading = document.createElement("h4");
  heading.textContent = order.orderId || `Order ${orderDoc.id.slice(0, 8)}`;
  const status = document.createElement("p");
  const createdAt = order.createdAt?.toDate?.();
  const date = createdAt instanceof Date && !Number.isNaN(createdAt.valueOf())
    ? createdAt.toLocaleDateString()
    : "Date unavailable";
  const statusLabel = typeof order.status === "string" ? order.status : "Status unavailable";
  status.textContent = `${statusLabel} · ${date}`;
  const details = document.createElement("p");
  const items = Array.isArray(order.items)
    ? order.items.filter((item) => item && typeof item.name === "string").map((item) => item.name).slice(0, 5)
    : [];
  details.textContent = items.length ? items.join(", ") : "Order details are not available.";
  card.append(heading, status, details);
  return {
    card,
    status: statusLabel.toLowerCase(),
    timestamp: createdAt instanceof Date && !Number.isNaN(createdAt.valueOf()) ? createdAt.valueOf() : 0
  };
}

async function loadOrders(listType) {
  const container = document.querySelector(listType === "active" ? "#active-order-list" : "#order-history-list");
  container.setAttribute("aria-busy", "true");
  try {
    const orderDocs = await window.Firebase.getDocs(
      window.Firebase.collection(db, ...firestoreUserPath(currentUser.uid, "orders"))
    );
    const completedStatuses = new Set(["completed", "delivered", "cancelled", "canceled"]);
    const matchingOrders = orderDocs.docs
      .map(makeOrderCard)
      .filter(({ status }) => (listType === "history") === completedStatuses.has(status))
      .sort((first, second) => second.timestamp - first.timestamp);
    if (matchingOrders.length) {
      container.replaceChildren(...matchingOrders.map(({ card }) => card));
    } else {
      createAccountListMessage(
        container,
        listType === "active" ? "You don't have any active orders." : "No completed orders are recorded yet."
      );
    }
  } catch (error) {
    reportError("Could not load order history", error);
    createAccountListMessage(container, "Order history could not be loaded. Please try again.");
  } finally {
    container.removeAttribute("aria-busy");
  }
}

function renderWishlist() {
  const container = document.querySelector("#account-wishlist-list");
  try {
    const savedIds = JSON.parse(localStorage.getItem("inder-store-wishlist-v1") ?? "[]");
    if (!Array.isArray(savedIds)) throw new TypeError("Wishlist storage has an invalid shape.");
    const savedProducts = savedIds
      .filter((id) => typeof id === "string")
      .map((id) => window.inderProducts.find((product) => product.id === id))
      .filter(Boolean);
    if (!savedProducts.length) {
      createAccountListMessage(container, "Your wishlist is empty. Save products with the heart button while browsing.");
      return;
    }
    const cards = savedProducts.map((product) => {
      const card = document.createElement("article");
      card.className = "account-list-card account-list-card--row";
      const name = document.createElement("strong");
      name.textContent = product.name;
      const category = document.createElement("span");
      category.textContent = product.categoryLabel;
      card.append(name, category);
      return card;
    });
    container.replaceChildren(...cards);
  } catch (error) {
    console.error("Could not read the saved wishlist.");
    createAccountListMessage(container, "Your wishlist could not be loaded in this browser.");
  }
}

async function loadSettings() {
  const checkbox = document.querySelector("#recommendation-setting");
  try {
    const preference = await window.Firebase.getDoc(
      window.Firebase.doc(db, "users", currentUser.uid, "settings", "preferences")
    );
    checkbox.checked = preference.exists() && preference.data().personalizedRecommendations === true;
  } catch (error) {
    reportError("Could not load account settings", error);
  }
}

accountButton.addEventListener("click", () => {
  setMessage();
  if (currentUser) showAccountHome();
  else showLogin();
  accountDialog.showModal();
});

document.querySelector("#close-account").addEventListener("click", () => accountDialog.close());
accountDialog.addEventListener("click", (event) => {
  if (event.target === accountDialog) accountDialog.close();
});
document.querySelector("#account-back").addEventListener("click", showAccountHome);
document.querySelectorAll("[data-account-view]").forEach((button) => {
  button.addEventListener("click", () => showAccountSection(button.dataset.accountView));
});

function setLoginTab(activeTab) {
  document.querySelectorAll("[data-login-tab]").forEach((tab) => {
    const active = tab.dataset.loginTab === activeTab;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelector("#phone-login-panel").hidden = activeTab !== "phone";
  document.querySelector("#password-login-panel").hidden = activeTab !== "password";
  document.querySelector("#login-panel-title").textContent = activeTab === "phone" ? "Welcome back" : "Sign in with email";
  document.querySelector("#login-panel-description").textContent = activeTab === "phone"
    ? "Sign in to pick up where you left off."
    : "Use the email and password linked to your verified account.";
  setMessage();
}

document.querySelectorAll("[data-login-tab]").forEach((tab) => {
  tab.addEventListener("click", () => setLoginTab(tab.dataset.loginTab));
});

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";
    button.setAttribute("aria-pressed", String(shouldShow));
    button.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
  });
});

document.querySelector("#open-signup").addEventListener("click", () => {
  clearResendCountdown();
  loginLayout.hidden = true;
  passwordRecovery.hidden = true;
  signupFlow.hidden = false;
  signupForm.hidden = false;
  signupOtpForm.hidden = true;
  setMessage();
  document.querySelector("#signup-name").focus();
});

document.querySelectorAll("[data-return-login]").forEach((button) => {
  button.addEventListener("click", () => {
    confirmationResult = null;
    confirmationFlow = null;
    clearResendCountdown();
    showLogin();
  });
});

document.querySelector("#open-password-recovery").addEventListener("click", () => {
  loginLayout.hidden = true;
  signupFlow.hidden = true;
  passwordRecovery.hidden = false;
  document.querySelector("#recovery-email").value = document.querySelector("#password-login-email").value;
  setMessage();
  document.querySelector("#recovery-email").focus();
});

document.querySelector("#email-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authReady) {
    setMessage("Email/password sign-in is unavailable until Supabase is configured.", true);
    return;
  }
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const email = form.elements.namedItem("email").value.trim();
  const password = form.elements.namedItem("password").value;
  const remember = document.querySelector("#remember-account").checked;
  setBusy(button, true, "Signing in...");
  try {
    await window.Firebase.setPersistence(auth, remember
      ? window.Firebase.browserLocalPersistence
      : window.Firebase.browserSessionPersistence);
    const result = await window.Firebase.signInWithEmailAndPassword(auth, email, password);
    if (!result.user.emailVerified) {
      await window.Firebase.signOut(auth);
      setMessage("Verify your email using the link we sent before signing in. Check your inbox or spam folder.", true);
      return;
    }
    accountDialog.close();
  } catch (error) {
    reportError("Could not sign in with email and password", error);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector("#password-recovery-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authReady) {
    setMessage("Password recovery is unavailable until Supabase is configured.", true);
    return;
  }
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const email = form.elements.namedItem("email").value.trim();
  setBusy(button, true, "Sending link...");
  try {
    await window.Firebase.sendPasswordResetEmail(auth, email);
    setMessage("If an account exists for that email, a secure password reset link has been sent.");
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      setMessage("If an account exists for that email, a secure password reset link has been sent.");
    } else {
      reportError("Could not send password recovery email", error);
    }
  } finally {
    setBusy(button, false);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = signupForm.elements.namedItem("email").value.trim();
  const password = signupForm.elements.namedItem("password").value;
  const confirmPassword = signupForm.elements.namedItem("confirmPassword").value;
  if (Boolean(email) !== Boolean(password)) {
    setMessage("To enable password sign-in, enter both an email address and a password. For phone-only sign-in, leave both password fields and email empty.", true);
    return;
  }
  if (password !== confirmPassword) {
    setMessage("The passwords do not match.", true);
    document.querySelector("#signup-confirm-password").focus();
    return;
  }
  if (password && password.length < 8) {
    setMessage("Choose a password with at least 8 characters.", true);
    return;
  }
  if (!authReady) {
    setMessage("Phone sign-up is unavailable until Supabase is configured.", true);
    return;
  }
  const button = document.querySelector("#send-signup-code");
  setBusy(button, true, "Sending verification...");
  try {
    const phoneNumber = normalizePhoneNumber(document.querySelector("#signup-phone").value);
    confirmationResult = await window.Firebase.signInWithPhoneNumber(
      auth,
      phoneNumber
    );
    confirmationFlow = "signup";
    document.querySelector("#signup-otp-hint").textContent = `Enter the code sent to ${phoneNumber}.`;
    signupForm.hidden = true;
    signupOtpForm.hidden = false;
    startResendCountdown("#resend-signup-code", "#signup-resend-countdown");
    document.querySelector("#signup-otp").focus();
    setMessage("Verification code sent. Check your SMS messages.");
  } catch (error) {
    reportError("Could not send sign-up verification code", error);
  } finally {
    setBusy(button, false);
    if (resendTimer) button.disabled = true;
  }
});

document.querySelector("#resend-signup-code").addEventListener("click", async () => {
  if (!authReady || confirmationFlow !== "signup") return;
  const button = document.querySelector("#resend-signup-code");
  setBusy(button, true, "Sending...");
  try {
    const phoneNumber = normalizePhoneNumber(document.querySelector("#signup-phone").value);
    confirmationResult = await window.Firebase.signInWithPhoneNumber(
      auth,
      phoneNumber
    );
    startResendCountdown("#resend-signup-code", "#signup-resend-countdown");
    setMessage("A new verification code was sent.");
  } catch (error) {
    reportError("Could not resend sign-up verification code", error);
  } finally {
    setBusy(button, false);
    if (resendTimer) button.disabled = true;
  }
});

document.querySelector("#edit-signup-details").addEventListener("click", () => {
  confirmationResult = null;
  confirmationFlow = null;
  clearResendCountdown();
  signupOtpForm.hidden = true;
  signupForm.hidden = false;
  setMessage();
});

signupOtpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!confirmationResult || confirmationFlow !== "signup") {
    setMessage("Request a new verification code before creating your account.", true);
    return;
  }
  const button = signupOtpForm.querySelector('button[type="submit"]');
  setBusy(button, true, "Verifying...");
  try {
    const result = await confirmationResult.confirm(document.querySelector("#signup-otp").value.trim());
    const name = document.querySelector("#signup-name").value.trim();
    const email = document.querySelector("#signup-email").value.trim();
    const password = document.querySelector("#signup-password").value;
    if (name && !result.user.displayName) {
      await window.Firebase.updateProfile(result.user, { displayName: name });
    }
    const profileSynced = await syncCustomerProfile(result.user);
    if (email && password && !result.user.providerData.some((provider) => provider.providerId === "password")) {
      const credential = window.Firebase.EmailAuthProvider.credential(email, password);
      await window.Firebase.linkWithCredential(result.user, credential);
    }
    updateAccountButton(result.user);
    confirmationResult = null;
    confirmationFlow = null;
    clearResendCountdown();
    signupFlow.hidden = true;
    showAccountHome();
    setMessage(!profileSynced
      ? "Your account is ready, but your customer profile could not be synced to the store records."
      : email && password && !result.user.emailVerified
        ? "Your mobile number is verified and your account is ready. Verify your email before using password sign-in."
        : "Your mobile number is verified and your account is ready.");
  } catch (error) {
    reportError("Could not verify sign-up code or finish account setup", error);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector("#resend-login-code").addEventListener("click", async () => {
  if (!authReady || confirmationFlow !== "login") return;
  const button = document.querySelector("#resend-login-code");
  setBusy(button, true, "Sending...");
  try {
    const phoneNumber = normalizePhoneNumber(loginPhone.value);
    confirmationResult = await window.Firebase.signInWithPhoneNumber(auth, phoneNumber);
    loginOtpHint.textContent = `Enter the code sent to ${phoneNumber}.`;
    startResendCountdown("#resend-login-code", "#otp-resend-countdown");
    setMessage("A new verification code was sent.");
  } catch (error) {
    reportError("Could not resend phone verification code", error);
  } finally {
    setBusy(button, false);
    if (resendTimer) button.disabled = true;
  }
});

document.querySelector("#change-login-number").addEventListener("click", () => {
  confirmationResult = null;
  confirmationFlow = null;
  clearResendCountdown();
  loginOtpForm.hidden = true;
  phoneLoginForm.hidden = false;
  loginOtp.value = "";
  setMessage();
});

phoneLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authReady) {
    setMessage("Phone login is not configured yet. Ask the site administrator to finish the Supabase setup.", true);
    return;
  }
  const button = document.querySelector("#send-login-code");
  setBusy(button, true, "Sending OTP...");
  try {
    await window.Firebase.setPersistence(auth, document.querySelector("#remember-account").checked
      ? window.Firebase.browserLocalPersistence
      : window.Firebase.browserSessionPersistence);
    const phoneNumber = normalizePhoneNumber(loginPhone.value);
    confirmationResult = await window.Firebase.signInWithPhoneNumber(auth, phoneNumber);
    confirmationFlow = "login";
    loginOtpHint.textContent = `Enter the code sent to ${phoneNumber}.`;
    phoneLoginForm.hidden = true;
    loginOtpForm.hidden = false;
    startResendCountdown("#resend-login-code", "#otp-resend-countdown");
    loginOtp.focus();
    setMessage("Verification code sent. Check your SMS messages.");
  } catch (error) {
    reportError("Could not send phone verification code", error);
  } finally {
    setBusy(button, false);
    if (resendTimer) button.disabled = true;
  }
});

loginOtpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!confirmationResult || confirmationFlow !== "login") {
    setMessage("Request a new verification code before continuing.", true);
    return;
  }
  const button = loginOtpForm.querySelector('button[type="submit"]');
  setBusy(button, true, "Verifying...");
  try {
    const result = await confirmationResult.confirm(loginOtp.value.trim());
    const name = document.querySelector("#login-name").value.trim();
    let profileNameSaved = true;
    if (!result.user.displayName && name) {
      try {
        await window.Firebase.updateProfile(result.user, { displayName: name });
      } catch (error) {
        profileNameSaved = false;
        console.error(`Sign-in succeeded, but the profile name could not be saved (${error?.code ?? "unknown error"}).`);
      }
    }
    const profileSynced = await syncCustomerProfile(result.user);
    updateAccountButton(result.user);
    confirmationResult = null;
    confirmationFlow = null;
    clearResendCountdown();
    if (accountDialog.open) {
      showAccountHome();
      setMessage(!profileSynced
        ? "Your mobile number is verified, but your profile could not be synced to the store records."
        : profileNameSaved
          ? "Your mobile number is verified."
          : "Your mobile number is verified. You can add your name from Edit Profile.");
    }
  } catch (error) {
    reportError("Could not verify phone sign-in code", error);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector("#edit-profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const displayName = form.elements.namedItem("name").value.trim();
  if (!displayName) {
    setMessage("Enter your name before saving.", true);
    return;
  }
  setBusy(button, true, "Saving...");
  try {
    await window.Firebase.updateProfile(currentUser, { displayName });
    const profileSynced = await syncCustomerProfile(currentUser);
    renderProfile();
    showAccountHome();
    setMessage(profileSynced
      ? "Profile updated."
      : "Profile updated, but the customer record could not be synced to the store.");
  } catch (error) {
    reportError("Could not update profile", error);
  } finally {
    setBusy(button, false);
  }
});

function resetAddressForm() {
  editingAddressId = null;
  addressForm.reset();
  document.querySelector("#address-form-heading").textContent = "Add an address";
  addressForm.querySelector('button[type="submit"]').textContent = "Save Address";
  document.querySelector("#cancel-address-edit").hidden = true;
}

document.querySelector("#cancel-address-edit").addEventListener("click", resetAddressForm);
addressForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  let phone;
  try {
    phone = normalizePhoneNumber(String(formData.get("phone") ?? ""));
  } catch (error) {
    setMessage(formatAuthError(error), true);
    return;
  }
  const pincode = String(formData.get("pincode") ?? "").trim();
  if (!/^\d{6}$/.test(pincode)) {
    setMessage("Enter a valid 6-digit PIN code.", true);
    return;
  }
  const address = {
    label: String(formData.get("label") ?? "").trim(),
    recipientName: String(formData.get("recipientName") ?? "").trim(),
    phone,
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    pincode
  };
  const button = form.querySelector('button[type="submit"]');
  setBusy(button, true, "Saving...");
  try {
    const addresses = window.Firebase.collection(db, ...firestoreUserPath(currentUser.uid, "addresses"));
    if (editingAddressId) {
      await window.Firebase.setDoc(window.Firebase.doc(addresses, editingAddressId), address, { merge: true });
    } else {
      await window.Firebase.addDoc(addresses, { ...address, createdAt: window.Firebase.serverTimestamp() });
    }
    resetAddressForm();
    await loadAddresses();
    setMessage("Saved address updated.");
  } catch (error) {
    reportError("Could not save address", error);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector("#save-settings").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  setBusy(button, true, "Saving...");
  try {
    await window.Firebase.setDoc(
      window.Firebase.doc(db, "users", currentUser.uid, "settings", "preferences"),
      { personalizedRecommendations: document.querySelector("#recommendation-setting").checked }
    );
    setMessage("Account settings saved.");
  } catch (error) {
    reportError("Could not save account settings", error);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector("#browse-wishlist").addEventListener("click", () => {
  accountDialog.close();
  document.querySelector("#show-wishlist").click();
  document.querySelector("#shop").scrollIntoView({ behavior: "smooth" });
});

changeMobileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authReady || !currentUser) return;
  const button = document.querySelector("#send-mobile-code");
  setBusy(button, true, "Sending code...");
  try {
    const phoneNumber = normalizePhoneNumber(document.querySelector("#new-mobile-number").value);
    if (phoneNumber === currentUser.phoneNumber) {
      setMessage("That is already the mobile number on your account.", true);
      return;
    }
    const phoneProvider = new window.Firebase.PhoneAuthProvider(auth);
    newMobileVerificationId = await phoneProvider.verifyPhoneNumber(phoneNumber);
    changeMobileOtpForm.hidden = false;
    document.querySelector("#change-mobile-otp").focus();
    setMessage(`Verification code sent to ${phoneNumber}.`);
  } catch (error) {
    reportError("Could not send new mobile number verification", error);
  } finally {
    setBusy(button, false);
  }
});

changeMobileOtpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!newMobileVerificationId) {
    setMessage("Request a verification code for the new mobile number first.", true);
    return;
  }
  const button = changeMobileOtpForm.querySelector('button[type="submit"]');
  setBusy(button, true, "Verifying...");
  try {
    const credential = window.Firebase.PhoneAuthProvider.credential(
      newMobileVerificationId,
      document.querySelector("#change-mobile-otp").value.trim()
    );
    await window.Firebase.updatePhoneNumber(currentUser, credential);
    currentUser = auth.currentUser;
    newMobileVerificationId = null;
    const profileSynced = await syncCustomerProfile(currentUser);
    updateAccountButton(currentUser);
    renderProfile();
    showAccountHome();
    setMessage(profileSynced
      ? "Your verified mobile number has been updated."
      : "Your verified mobile number has been updated, but the customer record could not be synced.");
  } catch (error) {
    reportError("Could not update verified mobile number", error);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector("#account-logout").addEventListener("click", async () => {
  try {
    await window.Firebase.signOut(auth);
    accountDialog.close();
    setMessage("You have been logged out.");
  } catch (error) {
    reportError("Could not sign out", error);
  }
});

function updateAccountButton(user) {
  const signedIn = Boolean(user);
  accountButtonLabel.textContent = signedIn
    ? (user.displayName || user.phoneNumber || "My Account")
    : "Login";
  accountButton.setAttribute("aria-label", signedIn ? "Open My Account" : "Login or sign up");
}

async function initializeSupabase() {
  if (!setupComplete) {
    document.querySelector("#send-login-code").disabled = true;
    document.querySelector("#resend-login-code").disabled = true;
    document.querySelector("#resend-signup-code").disabled = true;
    const notice = document.createElement("p");
    notice.className = "account-setup-note";
    notice.textContent = "Customer sign-in is not configured yet. Connect this website to Supabase and enable phone authentication before customers can receive real OTPs.";
    accountLogin.prepend(notice);
    updateAccountButton(null);
    return;
  }

  try {
    const client = await getSupabaseClient();
    const compat = createSupabaseCompat(client);
    auth = compat.auth;
    db = compat.db;
    window.Firebase = compat.sdk;
    compat.sdk.onAuthStateChanged(auth, (user) => {
      currentUser = user;
      updateAccountButton(user);
      if (user) {
        syncCustomerProfile(user).then((saved) => {
          if (!saved && accountDialog.open) {
            setMessage("You are signed in, but your profile could not be synced for store records. Check the Supabase setup.", true);
          }
        });
      }
      if (accountDialog.open) {
        if (user) showAccountHome();
        else showLogin();
      }
    });
    authReady = true;
    document.querySelector("#send-login-code").disabled = false;
  } catch (error) {
    console.error(`Supabase initialization failed (${error?.code ?? "network or configuration error"}).`);
    document.querySelector("#send-login-code").disabled = true;
    document.querySelector("#resend-login-code").disabled = true;
    document.querySelector("#resend-signup-code").disabled = true;
    const notice = document.createElement("p");
    notice.className = "account-setup-note account-setup-note--error";
    notice.textContent = "Supabase could not be initialized. Check the project URL, publishable key, and network connection.";
    accountLogin.prepend(notice);
  }
}

initializeSupabase();
