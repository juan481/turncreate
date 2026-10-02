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
};

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
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
};
