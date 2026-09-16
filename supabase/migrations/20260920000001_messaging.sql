-- Migration 20260920000001_messaging.sql

CREATE TABLE IF NOT EXISTS public.outbox_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    retries INT DEFAULT 0,
    next_retry_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    outbox_event_id UUID REFERENCES public.outbox_events(id) ON DELETE SET NULL,
    recipient TEXT NOT NULL,
    message_type TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger function for appointments
-- appointments no tiene customer_id/start_time -- son client_id/starts_at
-- (secciones 3.5-3.6). 'reprogramado' tampoco es un status válido: una
-- reprogramación deja el turno original en 'cancelled' con
-- cancel_reason = 'Reprogramado' (create_staff_appointment ya lo hace).
CREATE OR REPLACE FUNCTION public.enqueue_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR (TG_OP = 'INSERT') THEN
        IF NEW.status IN ('confirmed', 'cancelled') THEN
            INSERT INTO public.outbox_events (tenant_id, type, payload)
            VALUES (
                NEW.tenant_id,
                'appointment_' || NEW.status,
                jsonb_build_object(
                    'appointment_id', NEW.id,
                    'client_id', NEW.client_id,
                    'status', NEW.status,
                    'starts_at', NEW.starts_at
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enqueue_appointment_status_change ON public.appointments;
CREATE TRIGGER trg_enqueue_appointment_status_change
    AFTER INSERT OR UPDATE OF status
    ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_appointment_status_change();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.outbox_events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX outbox_events_tenant_id_idx ON public.outbox_events (tenant_id);
CREATE INDEX outbox_events_status_idx ON public.outbox_events (status, next_retry_at);
CREATE INDEX message_logs_tenant_id_idx ON public.message_logs (tenant_id);

-- Igual que audit_logs/webhook_events (Fase 0): sin policies, solo
-- accesibles con la service role key desde los cron jobs. Sin esto,
-- RLS queda deshabilitado y cualquier usuario autenticado podría leer
-- mensajería (teléfonos, contenido) de CUALQUIER tenant.
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
