"use client";

import { TurneroSwitch } from "../../turnero-switch";

/** Mismo interruptor (y la misma celebración) que el paso a paso del home. */
export function PublicBookingToggle(props: { tenantSlug: string; enabled: boolean; ready: boolean; publicUrl: string }) {
  return <TurneroSwitch {...props} />;
}
