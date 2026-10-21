# Design QA — TurnCreate: reserva, personalización y caja

Fecha: 2026-10-21
Estado: `passed`

## Evidencia revisada

- Producción previa en desktop y mobile: el turnero mostraba dos calendarios simultáneos y obligaba a bajar hasta `Ver horarios`.
- Implementación nueva recorrida en Pixel 7 contra Firebase Emulator: servicio → fecha → horario → datos → pago → estados de checkout.
- Anchos incluidos por la suite: referencia Pixel 7; el diseño conserva reglas existentes para 320, 360 y 390 px.

## Resultado UX

- Un calendario por pantalla, navegación actual/siguiente y avance directo al tocar una fecha.
- Acción sticky y targets táctiles de al menos 44 px.
- Horarios ocupados visibles sin competir con los disponibles.
- Inputs blancos con borde y foco perceptibles.
- Precio, seña y total inmediato visibles antes de confirmar.
- Selector de color con validación de contraste y preview global.
- Caja estructurada por tarea: resumen, cobros, tipo de cobro, movimientos y cierre.
- Movimientos con categorías explícitas y pago mixto explicado antes de confirmar.
- Estados hover/focus y transiciones respetan `prefers-reduced-motion` heredado del sistema.

## Accesibilidad y responsive

- Labels asociados a todos los nuevos inputs.
- Botones de calendario exponen fecha completa y estado ocupado por nombre accesible.
- Selector de categoría usa semántica radio y estado `aria-checked`.
- Campana expone cantidad de novedades y anuncia cambios con `aria-live`.
- Los colores arbitrarios se aceptan solo con contraste AA para texto blanco.

## Observaciones no bloqueantes

- El sonido depende de una primera interacción, comportamiento impuesto por autoplay del navegador y comunicado en UI.
- Las alertas son polling mientras el panel está abierto; no reemplazan notificaciones push del sistema operativo.
- La prueba real de acreditación/reembolso Mercado Pago requiere cuentas externas de prueba.
