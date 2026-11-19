# Inder General Store admin and live catalog setup

The admin panel and live customer catalog are implemented, but this project currently has no Firebase project configuration. Until the owner completes the setup below, the admin login and Firebase data operations remain unavailable, and the customer site continues to show its clearly labeled sample catalog.

## 1. Configure Firebase

1. Create a Firebase project and register a Web app. Copy its public `apiKey`, `authDomain`, `projectId`, `storageBucket`, and `appId` into `firebase-config.js`. Never add a service-account key or Admin SDK credential to this website.
2. In Firebase Authentication, enable **Email/Password** for admin access and **Phone** for customer sign-in. Add the deployed site domain under Authentication's authorized domains. Real phone OTP uses Firebase's SMS and reCAPTCHA flow.
3. Create a Cloud Firestore database and a Storage bucket.
4. Publish this project's `firestore.rules` and `storage.rules`. From a machine with Firebase CLI access, initialize or select the project's Firestore and Storage configuration, then deploy:

   ```text
   firebase init firestore storage
   firebase deploy --only firestore:rules,storage
   ```

5. Host the site on HTTPS (or use an authorized local HTTP development origin). Firebase's browser SDK is imported from Google's `gstatic` CDN, so the site also needs an internet connection.

## 2. Provision admin access

There is no public admin signup. Create an email/password user in Firebase Console → Authentication → Users. Then, from a trusted and access-controlled server environment using the Firebase Admin SDK, grant the approved user the `admin: true` custom claim:

```js
await getAuth().setCustomUserClaims(firebaseUid, { admin: true });
```

Only run this for explicitly approved administrator UIDs. Never put this code or Admin SDK credentials in the browser. The admin must sign in again or refresh their ID token after the claim is granted. Firestore and Storage rules also enforce the claim on protected operations.

## 3. Add categories and real products

1. Sign in at `admin.html` with the provisioned Firebase administrator.
2. In **Categories**, use **Import current category list** to add the existing 24 category names. Existing same-name categories are skipped; this creates categories only, not products or stock.
3. Add products with verified name, category, image, price, weight, and stock. Discount is calculated from MRP and selling price. Product images are uploaded to Firebase Storage.
4. Mark products **Active** to show them on the customer site. Inactive records are hidden. Active records with stock set to zero appear with an **Out of Stock** label and cannot be added to cart. Products, category images, prices, and stock are read from Firestore; changes update the customer catalog in real time.
5. Set **Featured product** to include the product in the storefront's featured strip. Filters and search use the current active catalog.

The sample rows in `products.js` are demonstration data only. They are never uploaded to Firebase and must not be treated as store inventory. If Firebase is not configured or the live catalog cannot be loaded, the storefront visibly labels the fallback as a sample catalog rather than presenting it as live stock.

## 4. Orders and limitations

The current checkout creates an unconfirmed WhatsApp order request; it does not persist a customer order. Therefore, the Admin Orders list and customer order history cannot show or confirm these requests. A trusted order-processing backend must validate the customer, calculate authoritative totals, create `users/{uid}/orders/{orderId}`, and handle order acceptance before those functions can be live. The website intentionally has no client-side order-create permission. Admin search/status filters and status updates work for records written by that trusted backend.

Customer records appear only after a customer signs in with Firebase Phone Authentication and their verified profile is saved to Firestore. This site does not provide customer account enumeration or admin access to saved addresses.

## Firestore data and security

- `categories/{categoryId}`: category name, slug, optional Storage image URL/path, timestamps.
- `products/{productId}`: product/category details, image URL/path, MRP, selling price, derived discount, weight, stock quantity, active/inactive status, featured flag, timestamps.
- `storeSettings/delivery`: admin-controlled delivery availability and an optional confirmed fixed delivery charge. Public customers can read this single document; only admins can create or update it. An unset charge is not treated as zero.
- `users/{uid}`: verified customer's display name and phone number.
- `users/{uid}/addresses/{addressId}` and `users/{uid}/settings/preferences`: customer-owned account data.
- `users/{uid}/orders/{orderId}`: trusted-backend order records; client-side order creation is denied. Admins may update status.

Firestore permits public read access only to catalog products/categories. Admin writes, customer profile access, and order status updates are governed by the included Firestore rules. Storage permits public image reads and limits uploads to admin users and JPEG/PNG/WebP files up to 5 MB.

## What remains owner-dependent

- Firebase project values, services, authorized domains, deployed rules, and the Storage bucket.
- Admin-user creation and the `admin: true` claim.
- Real category and product entries, uploaded images, and verified stock.
- A trusted order backend before confirmed/persisted orders can be managed.

No Firebase credentials were available in this repository, so live sign-in, Storage uploads, Firestore CRUD, rule enforcement, and real-time updates must be tested after these owner-controlled steps.
