import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client to bypass RLS for cron jobs
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // 1. Fetch pending events
    const { data: events, error: fetchError } = await supabase
      .from('outbox_events')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .limit(50);

    if (fetchError) throw fetchError;
    
    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'No pending events' });
    }

    const processedEvents = [];
    const failedEvents = [];

    // 2. Process each event
    for (const event of events) {
      try {
        // Simulate sending WhatsApp/Email
        console.log(`[OUTBOX] Sending ${event.type} to tenant ${event.tenant_id}. Payload:`, event.payload);
        
        // Save to message_logs
        const { error: logError } = await supabase
          .from('message_logs')
          .insert({
            tenant_id: event.tenant_id,
            outbox_event_id: event.id,
            recipient: 'customer@example.com', // Should fetch actual recipient based on payload in a real app
            message_type: event.type,
            content: `Simulated message for ${event.type} (Appt: ${event.payload.appointment_id})`,
            status: 'sent'
          });

        if (logError) throw logError;

        // Mark as processed
        const { error: updateError } = await supabase
          .from('outbox_events')
          .update({ status: 'processed', updated_at: new Date().toISOString() })
          .eq('id', event.id);

        if (updateError) throw updateError;
        
        processedEvents.push(event.id);
      } catch (err) {
        console.error(`[OUTBOX] Failed to process event ${event.id}:`, err);
        
        // Increment retries
        const newRetries = (event.retries || 0) + 1;
        const status = newRetries >= 3 ? 'failed' : 'pending';
        // next_retry_at = now + 5 minutes * retries
        const nextRetryAt = new Date(Date.now() + 5 * 60000 * newRetries);
        
        await supabase
          .from('outbox_events')
          .update({ 
            status, 
            retries: newRetries, 
            next_retry_at: nextRetryAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', event.id);
          
        failedEvents.push(event.id);
      }
    }

    return NextResponse.json({ 
      message: 'Outbox processed', 
      processed: processedEvents.length,
      failed: failedEvents.length 
    });

  } catch (error) {
    console.error('[OUTBOX] Critical error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
