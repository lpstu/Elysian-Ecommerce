# Elysian Commerce

Multi-vendor ecommerce platform with:

- Buyer accounts, wishlist, checkout, order history, and reviews
- Seller onboarding request flow with admin approval
- Seller product management and incoming order visibility
- On-site buyer/seller chat with Supabase Realtime
- Payments with Stripe, Orange/MTN-compatible mobile money (Flutterwave), and cash on delivery

## Stack

- Frontend + backend: Next.js 15 (App Router, Server Actions)
- Database/Auth/Realtime: Supabase (PostgreSQL + RLS + Auth)
- Card payments: Stripe Checkout
- Mobile money: Flutterwave (supports Orange/MTN rails by country)
- Free hosting: Vercel

## Why this hosting setup

- `Vercel` free tier hosts the Next.js app and API routes.
- `Supabase` free tier gives Postgres, Auth, and Realtime in one service.
- This is the fastest realistic free architecture for your required features.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Fill `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `FLUTTERWAVE_SECRET_KEY`

4. In Supabase SQL editor, run:

- `supabase/schema.sql`
- `supabase/bootstrap-admin.sql` (after replacing `USER_ID`)

5. Run dev server:

```bash
npm run dev
```

## Production deploy (free)

1. Push this repo to GitHub.
2. Import project in Vercel.
3. Add all env vars in Vercel project settings.
4. Set Stripe webhook endpoint:

`https://YOUR_DOMAIN/api/stripe/webhook`

5. Set Flutterwave webhook endpoint:

`https://YOUR_DOMAIN/api/payments/flutterwave/webhook`

6. Deploy.

## Roles and flows

- New users are created as `buyer`.
- Buyer submits seller request at `/seller/apply`.
- Admin reviews at `/admin/sellers`, approves/rejects.
- Approved seller gets `seller` role and can post products at `/seller/dashboard`.

## Current capabilities

- Auth: sign up/login/logout
- Product catalog with category filter and search
- Wishlist add/remove
- Checkout with 3 payment choices
- Order creation with stock reduction
- Seller dashboard (products/orders/chats)
- Admin approval queue
- Realtime messaging
- Reviews linked to purchased order items

## Important notes

- Product images currently use URL links; for large-scale media use Supabase Storage or Cloudinary.
- Mobile money implementation is wired to Flutterwave API if secret key is configured.
- For real payout disbursement to sellers, extend `payouts` workflows with scheduled settlement logic and payment provider disbursement APIs.
