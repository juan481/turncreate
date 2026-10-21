# Design QA — landing TurnCreate

Fecha: 2026-10-21

## Referencias

- Dirección visual seleccionada: `C:\Users\Juanc\.codex\generated_images\01a156b1-13fc-79c3-b1ce-7ea1fd56ef79\exec-cf4fcf71-470e-4fc2-a087-92bb2ad4fdd8.png`
- Dirección mobile: `C:\Users\Juanc\.codex\generated_images\01a156b1-13fc-79c3-b1ce-7ea1fd56ef79\exec-07b35217-85ea-419c-85ca-8c9f60b60eb1.png`
- Captura desktop local: `artifacts/landing-redesign/desktop-final.png`
- Captura mobile local: `artifacts/landing-redesign/mobile-final.png`
- Comparaciones: `artifacts/landing-redesign/comparison-desktop.png` y `artifacts/landing-redesign/comparison-mobile.png`

## Resultado visual

La implementación conserva la estructura y el lenguaje de la opción 1: hero editorial con producto visible, fondos lavanda luminosos, paneles reales de TurnCreate, recorrido de reserva, dashboard, personalización, integraciones, planes y cierre oscuro. A pedido del usuario se amplió deliberadamente la separación vertical entre secciones respecto de la referencia.

### Desktop · 1440 × 1000

- Hero en dos columnas, con mensaje a la izquierda y turnero/dashboard a la derecha.
- Ancho máximo estable de 1240 px y jerarquía tipográfica clara.
- Secciones con entre 104 y 160 px de aire vertical adaptable.
- Sin overflow horizontal (`scrollWidth === clientWidth`).

### Mobile · 390 × 844

- Navegación compacta con menú accesible que se cierra al navegar, hacer clic fuera o presionar Escape.
- CTA, títulos y paneles reorganizados en una sola columna.
- Reserva interactiva completa sin overflow.
- Planes y previews de color en carruseles táctiles con scroll-snap donde corresponde.
- Targets principales de interacción de 44 px o más.

## Interacción y movimiento

- Fade-up al entrar al viewport y transiciones escalonadas en el hero.
- Hover lift en cards, planes, integraciones, previews y botones.
- Crossfade/slide entre pasos del turnero demostrativo.
- Movimiento ambiental sutil en fondos y badges; no compite con el contenido.
- `prefers-reduced-motion: reduce` desactiva animaciones y transiciones de la landing.

## Hallazgos y correcciones

### P0

Ninguno.

### P1 resueltos

1. `Reveal` usaba `threshold: 0.15`: una sección más alta que el viewport podía no alcanzar nunca ese porcentaje y quedar transparente en mobile. Se redujo a `0.01` con margen de entrada proporcional.
2. `max-w-md` y `max-w-sm` colisionaban con la escala de spacing personalizada de Tailwind v4 y comprimían textos a 14/8 px de ancho. Se reemplazaron por valores arbitrarios explícitos.
3. El menú mobile nativo permanecía abierto al navegar por anclas. Se reemplazó por un componente controlado con cierre explícito y soporte de Escape/clic exterior.

### P2

Ninguno pendiente.

## Comprobaciones automatizadas

- Un solo `h1`.
- Cero botones o links sin nombre accesible.
- Cero imágenes sin atributo `alt`.
- Cero errores de consola o `pageerror` durante la navegación.
- Menú mobile, pasos de reserva, política de devolución y selector de color probados con Playwright.
- Viewports auditados: 1440 × 1000 y 390 × 844.

## Final result

passed
