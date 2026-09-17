# 0005. Fase 5: caja, cobro y comisiones

Fecha: 2026-09-17

## Contexto

El ADR 0004 descartó el intento roto de Caja del proceso paralelo
(`cash_registers`/`transactions`/`commissions` inventados, sin seguir el
plan, y con una colisión de tabla que ni aplicaba). Esta pasada
construye el módulo real siguiendo la sección 3.7 del plan maestro.

## Qué se construyó

- **Modelo de datos** (sección 3.7): `payments`, `sale_items`,
  `cash_sessions`, `cash_movements`, `commission_rules`,
  `commission_entries`, `commission_payouts`. `cash_movements` representa
  específicamente efectivo real de cajón — un pago con tarjeta,
  transferencia o MP nunca genera movimiento ahí (sección 5.5: "Solo el
  efectivo entra al arqueo"), así que el esperado del cierre es una suma
  directa sin tener que filtrar por método.
- **`open_cash_session`** / **`close_cash_session`**: no permite abrir
  una segunda caja si ya hay una abierta; el cierre exige motivo cuando
  el efectivo contado no coincide con el esperado (sección 5.5).
- **`finalize_appointment`**: registra los pagos (varios métodos en el
  mismo cobro), agrega productos vendidos y descuenta stock vía
  `stock_movements`, genera la comisión con la regla más específica
  (servicio > categoría > profesional), y pasa el turno a `completed`.
- **UI conectada** en `/app/{tenant}/caja`: abrir caja, ver los turnos
  confirmados del día con su saldo, cobrar (con método y un producto
  opcional), cerrar con arqueo. Reemplaza la maqueta mock anterior.

## Dos bugs encontrados probando el flujo real, no solo leyendo el código

- **`appointments.balance` nunca reflejaba lo cobrado en caja.** El
  trigger de la Fase 1 calculaba `balance = total - deposit_paid`, una
  aproximación que el ADR 0002 ya marcaba como provisional ("hasta que
  exista payments en la Fase 5"). `finalize_appointment` nunca toca
  `deposit_paid` (ese campo es para señas de MP), así que un turno recién
  cobrado seguía mostrando el total completo como pendiente. Se
  reemplazó el trigger para que sume `payments.amount` reales (sección
  5.5: "total − pagos registrados = saldo"), y se agregó un trigger en
  `payments` que fuerza el recálculo tras cada cobro.
- **`appointments.total` no incluía los productos vendidos.** Se fija una
  sola vez al crear el turno (solo servicios); `finalize_appointment`
  agregaba `sale_items` pero nunca sumaba su valor al total. Se detectó
  vendiendo un shampoo de $3000 junto con el servicio: el balance daba 0
  incluso habiendo cobrado de menos, porque el total nunca creció. Ahora
  `finalize_appointment` suma el valor de los `sale_items` a
  `appointments.total` antes de calcular comisión y balance (sección
  5.5: "total (ítems + productos)").

Ambos probados extremo a extremo contra la API real: turno de $24.000 +
shampoo de $3.000, cobrados juntos en efectivo → `total: 27000`,
`balance: 0`, comisión del 20% calculada sobre los $24.000 del servicio
(sin el producto, como pide la sección 5.5), stock descontado, cierre de
caja con esperado `32000` (apertura $5.000 + cobro) exacto.

## Simplificaciones deliberadas

- La comisión se calcula con la regla del **primer** servicio del turno,
  no por ítem — la UI de creación de turnos todavía arma un solo
  servicio por turno (ADR 0002), así que no hay combos reales que
  necesiten desglosarse todavía.
- El cobro desde la UI permite agregar un solo producto por vez (no un
  carrito). Alcanza para el caso de uso principal; ampliar a varios
  productos es una extensión del mismo `finalize_appointment`, que ya
  acepta un array completo de `sale_items`.
- `commission_payouts` (liquidación por período) tiene tabla y RLS pero
  todavía no una función que la genere ni una UI — queda para cuando
  haga falta liquidarle a un profesional.
- Mercado Pago real sigue sin conectar (ADR 0003): el método
  `mercadopago` existe en el `CHECK` de `payments.method`, pero nada lo
  usa todavía.
