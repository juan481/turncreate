-- Trigger genérico para mantener updated_at al día en toda tabla del plan
-- ("Todas tienen id uuid, created_at y updated_at").
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
