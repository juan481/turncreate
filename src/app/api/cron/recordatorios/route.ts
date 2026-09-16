import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
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

    let enqueued = 0;

    for (const apt of appointments) {
      // Check if a reminder already exists for this appointment in outbox_events
      const { data: existingEvents, error: evError } = await supabase
        .from('outbox_events')
        .select('id')
        .eq('tenant_id', apt.tenant_id)
        .eq('type', 'appointment_reminder')
        .contains('payload', { appointment_id: apt.id })
        .limit(1);
        
      if (evError) {
        console.error('Error checking existing events:', evError);
        continue;
      }

      if (existingEvents && existingEvents.length > 0) {
        continue; // Reminder already enqueued
      }

      // Enqueue reminder in outbox_events
      const { error: insertError } = await supabase
        .from('outbox_events')
        .insert({
          tenant_id: apt.tenant_id,
          type: 'appointment_reminder',
          payload: {
            appointment_id: apt.id,
            client_id: apt.client_id,
            starts_at: apt.starts_at
          }
        });

      if (insertError) {
        console.error(`Failed to enqueue reminder for appointment ${apt.id}:`, insertError);
      } else {
        enqueued++;
      }
    }

    return NextResponse.json({ 
      message: 'Reminders job completed',
      processed: appointments.length,
      enqueued 
    });

  } catch (error) {
    console.error('[REMINDERS] Critical error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
