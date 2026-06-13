-- ============================================================================
-- Storage bucket for attendance selfies. Public-read (URLs embedded in records),
-- authenticated-write into a folder named after the employee id.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', true)
on conflict (id) do nothing;

drop policy if exists attendance_photos_read on storage.objects;
create policy attendance_photos_read on storage.objects for select
  using (bucket_id = 'attendance-photos');

drop policy if exists attendance_photos_write on storage.objects;
create policy attendance_photos_write on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attendance-photos');

drop policy if exists attendance_photos_update on storage.objects;
create policy attendance_photos_update on storage.objects for update
  to authenticated
  using (bucket_id = 'attendance-photos');
