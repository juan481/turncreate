-- Cumple lo que ya documentaba el ADR 0002: "balance es una columna
-- mantenida por trigger (total - deposit_paid), aproximación hasta que
-- exista payments en la Fase 5 [...] El trigger se reemplaza ahí, no
-- antes." Ahora que payments existe, el saldo se calcula como dice la
-- sección 5.5: "total − pagos registrados = saldo, calculado desde
-- payments" -- ya no solo deposit_paid (que finalize_appointment nunca
-- toca; sin este fix, el turno quedaba con balance = total incluso
-- después de cobrado).
create or replace function set_appointment_balance()
returns trigger
language plpgsql
as $$
declare
  v_paid numeric(12, 2);
begin
  select coalesce(sum(amount), 0) into v_paid
  from payments
  where appointment_id = new.id and status = 'approved';

  new.balance = new.total - v_paid;
  return new;
end;
$$;

-- payments vive en su propia tabla: un insert/update/delete ahí no
-- dispara por sí solo el trigger BEFORE UPDATE de appointments. Este
-- trigger fuerza ese recálculo tocando la fila del turno; la lógica de
-- balance en sí vive en un solo lugar (set_appointment_balance).
create or replace function recalculate_balance_on_payment_change()
returns trigger
language plpgsql
as $$
declare
  v_appointment_id uuid;
begin
  v_appointment_id := coalesce(new.appointment_id, old.appointment_id);
  if v_appointment_id is not null then
    update appointments set updated_at = now() where id = v_appointment_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger recalculate_balance_on_payment_change
  after insert or update or delete on payments
  for each row execute function recalculate_balance_on_payment_change();
