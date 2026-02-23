alter table if exists profiles add column if not exists avatar_url text;
alter table if exists profiles add column if not exists bio text;
alter table if exists profiles add column if not exists store_name text;
alter table if exists profiles add column if not exists store_verified boolean not null default false;

alter table if exists orders add column if not exists confirmed_at timestamptz;
alter table if exists orders add column if not exists shipped_at timestamptz;
alter table if exists orders add column if not exists delivered_at timestamptz;
alter table if exists orders add column if not exists cancelled_at timestamptz;

alter table if exists seller_applications add column if not exists contact_phone text;
alter table if exists seller_applications add column if not exists business_image_url text;
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_state') then
    create type payment_state as enum ('unpaid', 'pending', 'paid', 'waived');
  end if;
  if not exists (select 1 from pg_type where typname = 'ad_status') then
    create type ad_status as enum ('pending_payment', 'pending_review', 'approved', 'rejected', 'active', 'completed');
  end if;
end $$;
alter table if exists seller_applications add column if not exists application_fee_payment_state payment_state not null default 'unpaid';
alter table if exists seller_applications add column if not exists application_fee_payment_reference text;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='admins can update profiles'
  ) then
    create policy "admins can update profiles" on profiles
    for update to authenticated
    using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles are readable publicly'
  ) then
    create policy "profiles are readable publicly" on profiles
    for select to anon
    using (true);
  end if;
end $$;

update profiles
set store_name = 'Elysian Store'
where role = 'admin' and (store_name is null or length(trim(store_name)) = 0);

update profiles
set store_verified = true
where role in ('admin', 'seller');

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

alter table notifications enable row level security;
alter table ad_campaigns enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='users read own notifications'
  ) then
    create policy "users read own notifications" on notifications
    for select to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='users update own notifications'
  ) then
    create policy "users update own notifications" on notifications
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='ad_campaigns' and policyname='users create ad campaigns'
  ) then
    create policy "users create ad campaigns" on ad_campaigns
    for insert to authenticated
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='ad_campaigns' and policyname='users read own ad campaigns and admins read all'
  ) then
    create policy "users read own ad campaigns and admins read all" on ad_campaigns
    for select to authenticated
    using (
      auth.uid() = user_id
      or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='ad_campaigns' and policyname='users update own ad campaigns and admins review'
  ) then
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
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatar images are public read'
  ) then
    create policy "avatar images are public read" on storage.objects
    for select to public
    using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='authenticated users upload own avatar'
  ) then
    create policy "authenticated users upload own avatar" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='authenticated users update own avatar'
  ) then
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
  end if;
end $$;
