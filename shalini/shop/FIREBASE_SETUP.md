# Firebase customer authentication and admin setup

The customer storefront remains usable without signing in. Customer accounts use Firebase Phone Authentication and Cloud Firestore. The separate `admin.html` dashboard uses Firebase email/password sign-in, Firebase custom claims, Firestore, and Cloud Storage. No admin signup or localStorage-based authorization is provided.

## Configure Firebase

1. Create a Firebase project and register a **Web app** in Firebase Console.
2. In **Project settings → General → Your apps**, copy the web app's `apiKey`, `authDomain`, `projectId`, `storageBucket`, and `appId` into `firebase-config.js`. These web configuration values are public; do not put service-account keys or other private credentials in this website.
3. In **Authentication → Sign-in method**, enable **Phone** and **Email/Password**. Phone sign-in sends real SMS codes. Email/password accounts are linked to a phone-verified customer and their email must be verified before password sign-in is allowed. Review the SMS region policy and allow the countries your customers use. Firebase may require a billing plan for production SMS.
4. In **Authentication → Settings → Authorized domains**, add the production website domain. For local testing, use a local HTTP server and authorize its hostname if required. Do not open the site as a `file://` URL: Firebase phone authentication requires a web origin and reCAPTCHA.
5. Create a Cloud Firestore database and publish `firestore.rules`. Public users can read products, categories, and the delivery settings document; only users whose verified Firebase ID token has the `admin: true` custom claim can change catalog or delivery settings. Customer accounts can manage only their own addresses and preferences. Admins can read and update order statuses, but only a trusted order service can create or delete orders.
6. Serve the site over HTTPS in production. The Firebase SDK is loaded from Google's `gstatic` CDN, so the website needs an internet connection and a content-security policy that permits Firebase's documented Auth/reCAPTCHA endpoints.
7. In **Authentication → Templates**, review the email verification and password reset messages and their authorized continue URLs. The recovery link uses Firebase's secure hosted password-reset flow; the customer sets and confirms a new password on that page.
8. Create a Firebase Storage bucket and publish `storage.rules`. The rules allow public reads of product/category images and restrict uploads, replacements, and deletion to admins. Images are limited to JPEG, PNG, or WebP and 5 MB. Storage billing requirements depend on the Firebase project plan.

## Provision an administrator

There is deliberately no admin signup in the website. Create an administrator's email/password account using Firebase Console → Authentication → Users, then assign the `admin` custom claim from a trusted environment using the Firebase Admin SDK. Never put Admin SDK credentials or claim-setting code in this website.

For example, in a trusted, access-controlled server script after initializing the Firebase Admin SDK:

```js
await getAuth().setCustomUserClaims(firebaseUid, { admin: true });
```

Only run this for specifically approved administrator UIDs. The administrator must sign in again (or refresh the ID token) after the claim is assigned. Removing admin access means removing the claim through the Admin SDK and revoking their refresh tokens as appropriate. The dashboard checks the claim, and both Firestore and Storage rules independently enforce it on every protected operation.

This static project does not yet include Firebase CLI project metadata. From the project directory, initialize Firestore and Storage and select the existing rule files when prompted:

```text
firebase init firestore storage
```

Then deploy the rules:

```text
firebase deploy --only firestore:rules,storage
```

## Account data

- Firebase Authentication stores the verified phone number and optional display name.
- `products/{productId}` stores admin-managed catalog details, prices, image URLs/paths, active status, featured flag, and explicitly entered stock quantity. No product or stock values are seeded by the admin dashboard.
- `categories/{categoryId}` stores admin-managed category names and optional uploaded images. A category cannot be deleted while products still reference it.
- `storeSettings/delivery` stores the admin-controlled home-delivery availability and optional confirmed fixed delivery charge. Public access is read-only; only admins can create or update this document. If no charge is configured, the customer page states that a fixed delivery charge applies and the amount must be confirmed with the store.
- `users/{uid}` stores the verified customer's name, phone number, and profile timestamps when they sign in. Admin users can list these limited profiles; customer addresses are not exposed to the admin client.
- `users/{uid}/orders/{orderId}` is the order collection read by the dashboard. Admin users can update only its status and update timestamp.
- Customers may optionally link a password to an email with Firebase Email/Password; email verification is required before that password can be used to sign in.
- Password recovery is sent to the registered email through Firebase's secure reset link. Phone-only accounts sign in with OTP and have no password to reset.
- `users/{uid}/addresses/{addressId}` stores customer-managed saved delivery addresses.
- `users/{uid}/settings/preferences` stores the recommendation preference.
- `users/{uid}/orders/{orderId}` is read-only in the client. A trusted order-processing backend must create order records and validate the user's identity before writing them.
- Wishlist items remain in this browser's existing local wishlist storage.

The current checkout creates an unconfirmed WhatsApp order request, not a store order. Consequently, it does not appear in the admin Orders view or customer Order History. Do not enable client-side Firestore writes for orders; add a trusted backend before implementing confirmed online order placement. Existing categories can be imported from the Categories screen using its explicit “Import current category list” action; it skips categories already present and creates no products or stock values. Existing sample product rows in `products.js` are not copied into Firestore or treated as live inventory by this dashboard.

The admin dashboard's product/category CRUD, image uploads, inventory changes, order-status changes, and customer listing require a configured Firebase project, deployed security rules, and a valid `admin: true` custom claim. The customer storefront subscribes to the same Firestore product and category collections and updates its live catalog, prices, images, filters, and stock states in real time. If Firebase is unconfigured or unavailable, it retains its clearly labeled sample catalog. Live Firebase operations cannot be tested against real data until those owner-controlled setup steps are complete. See [ADMIN_SETUP.md](./ADMIN_SETUP.md) for the full admin and shared-catalog setup.

Firebase provides phone OTP and email/password authentication, but it does not provide username/password or phone-number/password sign-in as a built-in provider. This site therefore offers email/password only for password sign-in. A secure custom backend would be required to support usernames or mobile numbers as password identifiers, or to reset passwords through SMS OTP.

## Development

Use Firebase's configured test phone numbers only in a non-production development project. They bypass real SMS delivery and must not be used to represent production OTP verification. Production customer sign-in uses Firebase's real phone verification and reCAPTCHA flow.
