-- Replace USER_ID with the UUID from auth.users for your first admin.
update profiles
set role = 'admin'
where id = 'USER_ID';
