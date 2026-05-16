
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text not null default '',
  era text not null default '',
  accent text not null default '#d4af6e',
  user_context text not null default '',
  system_prompt text not null,
  greeting text not null,
  base_avatar_url text not null,
  reactions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.characters enable row level security;

-- Public read access (anyone can browse contacts)
create policy "Anyone can read characters"
  on public.characters for select
  using (true);

-- Storage bucket for sprites (public, served as static URLs)
insert into storage.buckets (id, name, public)
values ('character-sprites', 'character-sprites', true)
on conflict (id) do nothing;

create policy "Public read sprites"
  on storage.objects for select
  using (bucket_id = 'character-sprites');
