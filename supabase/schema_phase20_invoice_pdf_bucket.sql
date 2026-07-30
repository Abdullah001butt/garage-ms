insert into storage.buckets (id, name, public)
values ('invoice-pdfs', 'invoice-pdfs', true)
on conflict (id) do nothing;

create policy "Authenticated staff can upload invoice pdfs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'invoice-pdfs');

create policy "Authenticated staff can update invoice pdfs"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'invoice-pdfs');

create policy "Anyone can view invoice pdfs"
  on storage.objects for select
  to public
  using (bucket_id = 'invoice-pdfs');
