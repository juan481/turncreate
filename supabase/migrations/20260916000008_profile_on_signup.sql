-- Crea el profile automáticamente cuando Supabase Auth crea el usuario
-- (login/registro real, sección E del plan de Fase 0). full_name sale de
-- options.data.full_name que manda signUp() en src/app/(auth)/actions.ts.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
