-- Item 11 da auditoria: logo e nome da empresa ficavam só no navegador (localStorage).
-- Trocar de computador ou limpar o navegador perdia tudo, e o PDF saía sem a logo.
-- Agora: nome do sistema e da empresa em profiles; imagem no Supabase Storage (bucket "logos").

alter table public.profiles add column if not exists system_name text;
-- company e logo_url já existem em profiles.

-- Bucket público para leitura (a logo aparece no PDF e no app); escrita só na pasta do próprio usuário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists logos_select_own on storage.objects;
drop policy if exists logos_insert_own on storage.objects;
drop policy if exists logos_update_own on storage.objects;
drop policy if exists logos_delete_own on storage.objects;

create policy logos_select_own on storage.objects for select to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy logos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy logos_update_own on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy logos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
