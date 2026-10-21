// Formas de los `json`/`jsonb` que devuelven las RPCs públicas
// (get_public_tenant, get_public_catalog, get_public_staff, ...).
// Postgres las tipa como `Json` genérico -- estos tipos documentan la
// forma real tal como la arman esas funciones SQL.

export type PublicTenant = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  timezone: string;
  booking_enabled: boolean;
  /** Medios con los que la clienta puede pagar la seña (al menos uno si booking_enabled). */
  payment_methods: { mercadopago: boolean; transfer: boolean };
  books_by_staff: boolean;
  max_booking_days: number;
  cancellation_refund_hours: number;
  slot_interval_min: number;
  bookable_weekdays: number[];
  description: string | null;
  address: string | null;
  instagram_url: string | null;
  whatsapp_number: string | null;
  brand_color: import("@/lib/brand-theme").BrandColorValue;
};

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  featured: boolean;
};

export type PublicCategory = {
  id: string;
  name: string;
  services: PublicService[];
};

export type PublicStaffMember = {
  id: string;
  name: string;
  photo_url: string | null;
};

export type PublicHold = {
  id: string;
  tenant_id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  expires_at: string;
};

export type PublicSlot = {
  starts_at: string;
  available: boolean;
};

export type PublicAppointment = {
  id: string;
  token: string;
  status: string;
  starts_at: string;
  ends_at: string;
  total: number;
  balance: number;
};

// Forma de get_appointment_by_token (Mi turno).
export type MiTurnoResult = {
  appointment: PublicAppointment;
  client: { full_name: string };
  staff: { display_name: string };
  tenant: { slug: string; name: string };
  items: { id: string; name: string; price: number }[];
};

export type ClientFormData = {
  full_name: string;
  phone_e164: string;
  email: string;
  age: string;
};

/**
 * Errores esperables de las acciones públicas: viajan como valor (en
 * producción Next oculta el mensaje de un `throw` en una server action).
 */
export type PublicActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Pantalla "Turno reservado — pendiente de confirmación" (turnero y Mi turno). */
export type TransferPanelData = {
  tenantName: string;
  clientName: string;
  serviceName: string;
  /** "sábado 10 de octubre a las 10:00" en la zona del local. */
  whenLabel: string;
  amount: number;
  amountLabel: string;
  amountToCopy: string;
  /** "sábado 10/10 a las 22:00" -- hasta cuándo se espera el comprobante. */
  deadlineLabel: string | null;
  alias: string | null;
  cbu: string | null;
  holderName: string | null;
  bankName: string | null;
  whatsappHref: string | null;
  miTurnoHref: string;
};
