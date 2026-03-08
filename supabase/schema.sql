create table if not exists public.app_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  front text not null,
  front_note text not null default '',
  back text not null,
  back_note text not null default '',
  active boolean not null default true,
  tags text[] not null default '{}',
  memory jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.app_decks (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  card_ids bigint[] not null default '{}',
  sort_mode text not null default 'created-desc',
  primary key (user_id, id)
);

create table if not exists public.app_tags (
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default 'neutral',
  primary key (user_id, name)
);

create table if not exists public.app_meta (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value text not null default '',
  primary key (user_id, key)
);

create index if not exists app_cards_user_id_idx on public.app_cards (user_id);
create index if not exists app_decks_user_id_idx on public.app_decks (user_id);
create index if not exists app_tags_user_id_idx on public.app_tags (user_id);
create index if not exists app_meta_user_id_idx on public.app_meta (user_id);

alter table public.app_cards enable row level security;
alter table public.app_decks enable row level security;
alter table public.app_tags enable row level security;
alter table public.app_meta enable row level security;

drop policy if exists "app_cards_owner_only" on public.app_cards;
create policy "app_cards_owner_only"
on public.app_cards
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "app_decks_owner_only" on public.app_decks;
create policy "app_decks_owner_only"
on public.app_decks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "app_tags_owner_only" on public.app_tags;
create policy "app_tags_owner_only"
on public.app_tags
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "app_meta_owner_only" on public.app_meta;
create policy "app_meta_owner_only"
on public.app_meta
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
