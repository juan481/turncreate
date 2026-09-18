-- cash_movements no tenía forma de insertarse a mano -- solo lo hacía
-- finalize_appointment (cobro de turno). Un retiro de efectivo o un gasto
-- de insumos (sección 3.7: "payment_id nulo = movimiento suelto") no
-- tenía ninguna función que lo generara.
create function add_cash_movement(
  p_cash_session_id uuid,
  p_type text,
  p_amount numeric,
  p_reason text
)
returns cash_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session cash_sessions;
  v_movement cash_movements;
begin
  select * into v_session from cash_sessions where id = p_cash_session_id;
  if not found then
    raise exception 'Caja no encontrada';
  end if;

  if not has_role(v_session.tenant_id, array['admin', 'receptionist']) then
    raise exception 'Sin permiso para registrar movimientos de caja';
  end if;

  if v_session.closed_at is not null then
    raise exception 'Esa caja ya está cerrada';
  end if;

  if p_type not in ('in', 'out') then
    raise exception 'Tipo de movimiento inválido';
  end if;

  if p_amount <= 0 then
    raise exception 'El monto tiene que ser mayor a 0';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'El motivo es obligatorio';
  end if;

  insert into cash_movements (cash_session_id, type, amount, reason)
  values (p_cash_session_id, p_type, p_amount, p_reason)
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke execute on function add_cash_movement(uuid, text, numeric, text) from public;
grant execute on function add_cash_movement(uuid, text, numeric, text) to authenticated;
