-- tenants solo tenía policy de select -- el admin no podía editar nombre,
-- dirección ni redes sociales desde la nueva pantalla de Configuración.
-- El alta sigue siendo por RPC (onboard_tenant); esto solo habilita
-- editar los datos de un local ya creado.
create policy tenants_update on tenants
  for update using (has_role(id, array['admin']))
  with check (has_role(id, array['admin']));
