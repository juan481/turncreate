import "server-only";
import { formatInTz } from "@/lib/dates";
import type { TenantRecord } from "@/server/firebase/tenants";
import type { TransferInstructions } from "@/server/public-booking/transfer";
import { moneyLabel, moneyToCopy, transferReceiptMessage, whatsAppLink } from "@/server/public-booking/payment-methods";
import type { TransferPanelData } from "./types";

function whenLabel(iso: string, timezone: string) {
  const day = formatInTz(iso, timezone, { weekday: "long", day: "numeric", month: "long" });
  const time = formatInTz(iso, timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${day} a las ${time}`;
}

function deadlineLabel(iso: string, timezone: string) {
  const day = formatInTz(iso, timezone, { weekday: "long", day: "numeric", month: "numeric" });
  const time = formatInTz(iso, timezone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${day} a las ${time}`;
}

/** Arma (del lado del server, en la zona del local) lo que muestra la pantalla de "transferí la seña". */
export function buildTransferPanel(tenant: TenantRecord, slug: string, token: string, instructions: TransferInstructions): TransferPanelData {
  const amountLabel = moneyLabel(instructions.depositDue);
  const when = instructions.startsAt ? whenLabel(instructions.startsAt, tenant.timezone) : "";
  const message = transferReceiptMessage({
    clientName: instructions.clientName,
    serviceName: instructions.serviceName,
    whenLabel: when,
    amountLabel,
  });
  return {
    tenantName: tenant.name,
    clientName: instructions.clientName,
    serviceName: instructions.serviceName,
    whenLabel: when,
    amount: instructions.depositDue,
    amountLabel,
    amountToCopy: moneyToCopy(instructions.depositDue),
    deadlineLabel: instructions.expiresAt ? deadlineLabel(instructions.expiresAt, tenant.timezone) : null,
    alias: instructions.transfer?.alias ?? null,
    cbu: instructions.transfer?.cbu ?? null,
    holderName: instructions.transfer?.holderName ?? null,
    bankName: instructions.transfer?.bankName ?? null,
    whatsappHref: whatsAppLink(instructions.whatsappNumber, message),
    miTurnoHref: `/${slug}/mi-turno/${token}`,
  };
}
