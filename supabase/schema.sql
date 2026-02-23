create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('buyer', 'seller', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'seller_status') then
    create type seller_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method_type') then
    create type payment_method_type as enum ('stripe', 'mobile_money', 'cash_on_delivery');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_state') then
    create type payment_state as enum ('unpaid', 'pending', 'paid', 'waived');
  end if;
  if not exists (select 1 from pg_type where typname = 'ad_status') then
    create type ad_status as enum ('pending_payment', 'pending_review', 'approved', 'rejected', 'active', 'completed');
  end if;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  bio text,
  store_name text,
  store_verified boolean not null default false,
  role app_role not null default 'buyer',
  created_at timestamptz not null default now()
);

create table if not exists seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  store_name text not null,
  business_description text not null,
  contact_phone text,
  business_image_url text,
  application_fee_payment_state payment_state not null default 'unpaid',
  application_fee_payment_reference text,
  status seller_status not null default 'pending',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  title text not null,
  description text not null,
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists wishlists (
  user_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, product_id)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  status order_status not null default 'pending',
  payment_method payment_method_type not null,
  payment_reference text,
  shipping_address text not null,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid unique not null references order_items(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(buyer_id, seller_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  title text not null,
  body text not null,
  type text not null default 'general',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text not null,
  image_url text,
  target_url text,
  budget numeric(10,2) not null check (budget >= 0),
  payment_method payment_method_type not null default 'stripe',
  payment_state payment_state not null default 'unpaid',
  payment_reference text,
  status ad_status not null default 'pending_payment',
  approved_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table seller_applications enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table wishlists enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reviews enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table payouts enable row level security;
alter table notifications enable row level security;
alter table ad_campaigns enable row level security;

create policy "profiles are readable by all authenticated users" on profiles
for select to authenticated using (true);

create policy "profiles are readable publicly" on profiles
for select to anon using (true);

create policy "users can update own profile" on profiles
for update to authenticated using (auth.uid() = id);

create policy "admins can update profiles" on profiles
for update to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "users can insert own profile" on profiles
for insert to authenticated with check (auth.uid() = id);

create policy "categories are public" on categories
for select using (true);

create policy "products are public if active" on products
for select using (is_active = true or auth.uid() = seller_id);

create policy "approved sellers manage their products" on products
for all to authenticated
using (
  auth.uid() = seller_id
  and exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'seller'
  )
)
with check (
  auth.uid() = seller_id
  and exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'seller'
  )
);

create policy "users manage own wishlist" on wishlists
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "buyers and sellers can see their orders" on orders
for select to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "buyers create orders" on orders
for insert to authenticated
with check (auth.uid() = buyer_id);

create policy "sellers update their orders" on orders
for update to authenticated
using (auth.uid() = seller_id)
with check (auth.uid() = seller_id);

create policy "order items visible to order parties" on order_items
for select to authenticated
using (
  exists (
    select 1 from orders o
    where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
  )
);

create policy "buyers insert order items" on order_items
for insert to authenticated
with check (
  exists (
    select 1 from orders o where o.id = order_id and o.buyer_id = auth.uid()
  )
);

create policy "reviews readable by all" on reviews
for select using (true);

create policy "buyers create own reviews" on reviews
for insert to authenticated
with check (auth.uid() = buyer_id);

create policy "conversation parties can read" on conversations
for select to authenticated
using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "buyers can create conversations" on conversations
for insert to authenticated
with check (auth.uid() = buyer_id);

create policy "conversation parties can read messages" on messages
for select to authenticated
using (
  exists (
    select 1 from conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

create policy "conversation parties can send messages" on messages
for insert to authenticated
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  )
);

create policy "seller applications own records" on seller_applications
for select to authenticated
using (user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "users create own application" on seller_applications
for insert to authenticated
with check (auth.uid() = user_id);

create policy "admins review applications" on seller_applications
for update to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "users create ad campaigns" on ad_campaigns
for insert to authenticated
with check (auth.uid() = user_id);

create policy "users read own ad campaigns and admins read all" on ad_campaigns
for select to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "users update own ad campaigns and admins review" on ad_campaigns
for update to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  auth.uid() = user_id
  or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "users read own notifications" on notifications
for select to authenticated
using (auth.uid() = user_id);

create policy "users update own notifications" on notifications
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into categories(name)
values ('Fashion'), ('Electronics'), ('Home'), ('Beauty'), ('Sports')
on conflict(name) do nothing;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles(id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'buyer')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar images are public read" on storage.objects
for select to public
using (bucket_id = 'avatars');

create policy "authenticated users upload own avatar" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "authenticated users update own avatar" on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
