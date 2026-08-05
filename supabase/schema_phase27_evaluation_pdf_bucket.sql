insert into storage.buckets (id, name, public)
values ('evaluation-pdfs', 'evaluation-pdfs', true)
on conflict (id) do nothing;

create policy "Authenticated staff can upload evaluation pdfs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'evaluation-pdfs');

create policy "Authenticated staff can update evaluation pdfs"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'evaluation-pdfs');

create policy "Anyone can view evaluation pdfs"
  on storage.objects for select
  to public
  using (bucket_id = 'evaluation-pdfs');
