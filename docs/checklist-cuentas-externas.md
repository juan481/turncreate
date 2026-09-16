# Checklist de cuentas externas

Nada de esto bloquea el desarrollo local (ver `docs/adr/0001-fase-0-fundaciones.md`).
Es lo que hay que crear cuando se quiera pasar de local a la nube.

## Para salir de local (resto de la Fase 0)

- [ ] **GitHub**: repo remoto (org o cuenta personal). `git remote add origin ...`
- [ ] **Supabase**: proyecto de staging + proyecto de producción (planes en
      sección 8.4 del plan: staging Free, producción Pro ~USD 25 + uso).
- [ ] **Vercel**: proyecto conectado al repo, plan Pro (~USD 20/mes),
      variables de entorno de `.env.example` cargadas por ambiente.
- [ ] **Sentry**: proyecto Next.js (plan Developer, USD 0 para empezar).
- [ ] **Google Cloud Console**: OAuth client (tipo "Web application") para
      habilitar "Iniciar sesión con Google" — client id/secret van en la
      config de Auth del proyecto Supabase.
- [ ] **Dominio**: `turncreate.com.ar` (principal) + `turncreate.com`
      (redirección), apuntados a Vercel.

## Para la Fase 2 (turnero público + pagos)

- [ ] **Mercado Pago**: app de developer con credenciales sandbox
      (Checkout Pro con OAuth — la seña se acredita en la cuenta del local,
      no en una cuenta de TurnCreate).

## Para la Fase 3 (mensajería)

- [ ] **Meta Business + WhatsApp Cloud API**: cuenta de WhatsApp Business,
      número único de TurnCreate, plantillas utility para aprobar.
- [ ] **Brevo**: cuenta para transaccionales y avisos de cuenta por email.

## Para el cobro de suscripción (Fase 4)

- [ ] **Mercado Pago Suscripciones**: además del Checkout Pro de la Fase 2,
      la suscripción SaaS mensual/anual se cobra en la cuenta de TurnCreate.
