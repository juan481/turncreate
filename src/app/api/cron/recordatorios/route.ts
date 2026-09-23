import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Find confirmed appointments in the next 24 hours
    const { data: appointments, error: aptError } = await supabase
      .from('appointments')
      .select('id, tenant_id, client_id, starts_at, status')
      .eq('status', 'confirmed')
      .gte('starts_at', now.toISOString())
      .lte('starts_at', tomorrow.toISOString());

    if (aptError) throw aptError;

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ message: 'No upcoming appointments to remind' });
    }

    const { data: existingEvents, error: evError } = await supabase
      .from('outbox_events')
      .select('payload')
      .eq('type', 'appointment_reminder')
      .gte('created_at', new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString());

    if (evError) throw evError;

    const alreadyEnqueued = new Set(
      (existingEvents ?? []).map((e) => (e.payload as { appointment_id?: string })?.appointment_id),
    );

    const pending = appointments.filter((apt) => !alreadyEnqueued.has(apt.id));

    if (pending.length === 0) {
      return NextResponse.json({
        message: 'Reminders job completed',
        processed: appointments.length,
        enqueued: 0,
      });
    }

    const { error: insertError } = await supabase.from('outbox_events').insert(
      pending.map((apt) => ({
        tenant_id: apt.tenant_id,
        type: 'appointment_reminder',
        payload: {
          appointment_id: apt.id,
          client_id: apt.client_id,
          starts_at: apt.starts_at,
        },
      })),
    );

    if (insertError) throw insertError;

    return NextResponse.json({
      message: 'Reminders job completed',
      processed: appointments.length,
      enqueued: pending.length,
    });

  } catch (error) {
    console.error('[REMINDERS] Critical error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
