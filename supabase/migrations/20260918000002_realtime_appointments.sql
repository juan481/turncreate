-- Sección 5.6: "Nuevo turno online: pasa a confirmed -> Aviso en la app
-- vía Realtime -> Inmediato". Sin esto, `supabase_realtime` no transmite
-- cambios de esta tabla aunque el cliente se suscriba.
alter publication supabase_realtime add table appointments;
