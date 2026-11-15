-- 미니폴라로이드 인쇄: 결과 시트 보관
-- Supabase SQL Editor 에 붙여 실행. 그리고 Auth > Providers > Anonymous sign-ins 를 켠다.

create table if not exists public.sheets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  preset       text not null,
  orientation  text not null check (orientation in ('portrait','landscape')),
  dpi          int  not null check (dpi in (300,600)),
  photo_count  int  not null default 0,
  storage_path text not null,
  created_at   timestamptz not null default now()
);
create index if not exists sheets_user_created on public.sheets (user_id, created_at desc);

alter table public.sheets enable row level security;

create policy "own rows select" on public.sheets for select using (auth.uid() = user_id);
create policy "own rows insert" on public.sheets for insert with check (auth.uid() = user_id);
create policy "own rows delete" on public.sheets for delete using (auth.uid() = user_id);

-- 비공개 버킷. 경로 규칙: {user_id}/{sheet_id}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sheets', 'sheets', false, 15728640, array['image/jpeg'])
on conflict (id) do nothing;

create policy "own folder read" on storage.objects for select
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder write" on storage.objects for insert
  with check (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder delete" on storage.objects for delete
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
