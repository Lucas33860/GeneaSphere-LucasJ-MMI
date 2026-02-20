-- ============================================================
-- GeneaSphere — Schéma initial
-- ============================================================

-- Extension UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE : profiles
-- Étend auth.users avec les rôles et l'approbation
-- ============================================================
create table public.profiles (
  id            uuid references auth.users on delete cascade primary key,
  email         text not null,
  full_name     text,
  is_admin      boolean not null default false,
  is_approved   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- TABLE : members
-- Nœuds de l'arbre généalogique
-- ============================================================
create table public.members (
  id            uuid primary key default uuid_generate_v4(),
  first_name    text not null,
  last_name     text not null,
  gender        text check (gender in ('male', 'female', 'other')),
  birth_date    date,
  death_date    date,
  birth_place   text,
  photo_url     text,
  bio           text,
  is_private    boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- TABLE : parentage
-- Relation parent/enfant
-- ============================================================
create table public.parentage (
  id          uuid primary key default uuid_generate_v4(),
  child_id    uuid not null references public.members(id) on delete cascade,
  father_id   uuid references public.members(id) on delete set null,
  mother_id   uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (child_id)  -- un enfant n'a qu'une seule entrée de parenté
);

-- ============================================================
-- TABLE : spouses
-- Relation conjoint/conjoint
-- ============================================================
create table public.spouses (
  id              uuid primary key default uuid_generate_v4(),
  member1_id      uuid not null references public.members(id) on delete cascade,
  member2_id      uuid not null references public.members(id) on delete cascade,
  union_date      date,
  separation_date date,
  created_at      timestamptz not null default now(),
  check (member1_id <> member2_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.members  enable row level security;
alter table public.parentage enable row level security;
alter table public.spouses  enable row level security;

-- profiles : lecture publique pour les utilisateurs authentifiés
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');

-- profiles : mise à jour uniquement par le propriétaire ou admin
create policy "profiles_update" on public.profiles
  for update using (
    auth.uid() = id or
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- members : membres publics lisibles par tous les authentifiés
create policy "members_select_public" on public.members
  for select using (
    auth.role() = 'authenticated' and (
      not is_private or
      created_by = auth.uid() or
      exists (select 1 from public.profiles where id = auth.uid() and is_admin)
    )
  );

-- members : insertion par les utilisateurs approuvés
create policy "members_insert" on public.members
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_approved = true
    )
  );

-- members : mise à jour par le créateur ou admin
create policy "members_update" on public.members
  for update using (
    created_by = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- members : suppression par le créateur ou admin
create policy "members_delete" on public.members
  for delete using (
    created_by = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- parentage : mêmes règles que members
create policy "parentage_select" on public.parentage
  for select using (auth.role() = 'authenticated');

create policy "parentage_insert" on public.parentage
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_approved)
  );

create policy "parentage_delete" on public.parentage
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- spouses : mêmes règles que members
create policy "spouses_select" on public.spouses
  for select using (auth.role() = 'authenticated');

create policy "spouses_insert" on public.spouses
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_approved)
  );

create policy "spouses_delete" on public.spouses
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

-- ============================================================
-- TRIGGER : création automatique de profil
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, is_admin, is_approved)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    -- Premier inscrit devient admin et est approuvé automatiquement
    (select count(*) = 0 from public.profiles),
    (select count(*) = 0 from public.profiles)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TRIGGER : mise à jour automatique de updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger members_updated_at
  before update on public.members
  for each row execute procedure public.handle_updated_at();
