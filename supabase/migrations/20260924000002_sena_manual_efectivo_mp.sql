-- Agendar un turno a mano (admin/recepción) no tenía forma de registrar
-- una seña -- solo el turnero público generaba una vía Mercado Pago.
-- Esta función registra la seña como un pago real (kind='deposit'),
-- efectivo o Mercado Pago, para que el balance del turno (que se calcula
-- desde payments, migración 20260923000002) la refleje correctamente.
-- Un pago en efectivo entra al arqueo de caja solo si hay una caja
-- abierta en el momento -- si no, queda registrado igual pero no
-- descuenta contra ningún arqueo (igual que un cobro histórico).
create function register_appointment_deposit(
  p_appointment_id uuid,
  p_amount numeric,
  p_method text,
  p_cash_session_id uuid default null
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_payment_id uuid;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if not found then
    raise exception 'Turno no encontrado';
  end if;

  if not has_role(v_appointment.tenant_id, array['admin', 'receptionist']) then
    raise exception 'Sin permiso para cobrar una seña en este turno';
  end if;

  if p_method not in ('cash', 'mercadopago') then
    raise exception 'Método de seña inválido';
  end if;

  if p_amount <= 0 then
    raise exception 'El monto de la seña tiene que ser mayor a 0';
  end if;

  insert into payments (tenant_id, appointment_id, kind, method, amount, status, cash_session_id)
  values (
    v_appointment.tenant_id, p_appointment_id, 'deposit', p_method, p_amount, 'approved',
    case when p_method = 'cash' then p_cash_session_id else null end
  )
  returning id into v_payment_id;

  if p_method = 'cash' and p_cash_session_id is not null then
    insert into cash_movements (cash_session_id, type, amount, reason, payment_id)
    values (p_cash_session_id, 'in', p_amount, 'Seña de turno', v_payment_id);
  end if;

  update appointments
  set deposit_required = greatest(deposit_required, p_amount),
      deposit_paid = deposit_paid + p_amount
  where id = p_appointment_id
  returning * into v_appointment;

  return v_appointment;
end;
$$;

revoke execute on function register_appointment_deposit(uuid, numeric, text, uuid) from public;
grant execute on function register_appointment_deposit(uuid, numeric, text, uuid) to authenticated;
