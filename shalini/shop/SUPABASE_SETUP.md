# Supabase migration setup

The Supabase integration is being added alongside the existing Firebase implementation. Do not remove or disable Firebase files until the Supabase version has been configured and tested.

## What this project expects

- Supabase Postgres stores profiles, categories, products, store settings, orders, and order items.
- Supabase Auth handles customer phone OTP and administrator email/password sessions.
- The `product-images` Storage bucket stores product and category images.
- Row Level Security (RLS) is enabled on every application table. Customers may read the public catalog and only their own profile and orders. Admin assignments are maintained outside normal client writes.
- `supabase/schema.sql` creates the tables, indexes, policies, storage bucket, atomic server-priced order function, and realtime publication entries.
- `supabase-config.js` accepts only the project URL and publishable (formerly `anon`) key. Never put a `service_role` or secret key in browser code.

## Manual setup steps

1. Create a Supabase project. Select a region close to the store's customers. Save the database password in a password manager; do not put it in this repository or share it in chat.
2. In **Project Settings → API**, copy the **Project URL** and **publishable key** (or legacy `anon` key) into `supabase-config.js`. Do not copy the `service_role` key.
3. In **SQL Editor**, run the contents of `supabase/schema.sql` once. The migration enables RLS, restricts writes, and creates the public `product-images` bucket with a 5 MB image limit. Review the SQL before running it in any project with existing data.
4. In **Authentication → Providers**, enable **Phone** for customer OTP and **Email** for Admin password sign-in. Production SMS OTP requires configuring an external SMS provider in Supabase Auth. Provider account credentials are entered only in the Supabase dashboard, never in the website.
5. In **Authentication → URL Configuration**, set the site's allowed redirect URLs. Use an HTTPS production origin and the exact local development origin while testing; do not use `file://`.
6. Create the first approved Admin through **Authentication → Users** and copy that user's UUID. In SQL Editor, grant the Admin role using:

   ```sql
   insert into public.admin_users (user_id)
   values ('PASTE_THE_APPROVED_AUTH_USER_UUID_HERE');
   ```

   Run this only for an explicitly approved user. Do not grant roles based on user-editable metadata. The `admin_users` table has no client write permission; SQL Editor/project-owner access is required to provision or revoke Admins. Do not disable customer sign-up if customers are expected to use phone OTP.
7. Test using a non-production account: customer OTP, public read-only catalog, customer profile/order ownership, Admin-only catalog/settings/image writes, and order placement. The order RPC locks product rows, checks live stock/prices, decrements stock, and creates order snapshots atomically. The current storefront checkout still creates an unconfirmed WhatsApp request; it is not connected to this order RPC.

## Important limitations

- Supabase Phone OTP requires a configured SMS provider; SMS delivery and cost depend on that provider. Until it is configured, phone login is not live.
- Customer product browsing and cart use do not require login. WhatsApp checkout remains an unconfirmed request and does not create a Supabase order.
- The database order RPC is prepared but not yet used by the customer checkout, so verified order placement and order history require a deliberate checkout-flow integration before production.
- Admin role provisioning is manual through SQL Editor; there is no public Admin signup.
- The existing Firebase customer account, Firestore, Storage, and rules are deliberately retained until Supabase configuration and end-to-end testing are complete.
- This project currently has no backend server. The Supabase browser client must use RLS and the publishable key only. Service-role credentials must never be embedded in the site.
