"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TransferPanelData } from "./types";

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // http:// o navegadores viejos: sin Clipboard API.
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function CopyRow({ label, value, copyValue, emphasis = false }: { label: string; value: string; copyValue?: string; emphasis?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onCopy = async () => {
    const ok = await copyText(copyValue ?? value);
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  return (
    <div className="flex items-center gap-3 rounded-inner bg-surface-container-low p-md">
      <div className="min-w-0 flex-1">
        <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
        <p className={cn("break-all text-on-surface tabular-nums", emphasis ? "font-headline-md text-headline-md" : "font-label-lg text-label-lg")}>{value}</p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copiar ${label.toLowerCase()}`}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill px-3 font-label-md text-label-md transition-colors",
          state === "copied" ? "bg-status-confirmed-bg text-status-confirmed" : "bg-surface text-on-surface hover:bg-surface-container-high",
        )}
      >
        <Icon name={state === "copied" ? "check" : "content_copy"} className="text-[16px]" />
        <span aria-live="polite">{state === "copied" ? "Copiado" : state === "failed" ? "Copialo a mano" : "Copiar"}</span>
      </button>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-1">
      <span className="shrink-0 font-label-md text-label-md text-on-surface-variant">{label}</span>
      <span className="min-w-0 break-words text-right font-label-lg text-label-lg text-on-surface">{value}</span>
    </div>
  );
}

/** "Turno reservado — pendiente de confirmación": datos para transferir + comprobante por WhatsApp. */
export function TransferInstructions({ panel, showMiTurnoLink = true, headingLevel = "h1" }: { panel: TransferPanelData; showMiTurnoLink?: boolean; headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  return (
    <div className="animate-fade-up space-y-lg">
      <div className="space-y-2 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-status-pending-bg text-status-pending">
          <Icon name="hourglass_top" className="text-[26px]" />
        </span>
        <Heading className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          Turno reservado — pendiente de confirmación
        </Heading>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Tu horario ya quedó guardado. Para confirmarlo, transferí la seña y mandale el comprobante a {panel.tenantName}.
        </p>
      </div>

      <Card hoverLift={false} className="space-y-md p-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-label-lg text-label-lg text-on-surface">{panel.serviceName}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant first-letter:uppercase">{panel.whenLabel}</p>
          </div>
          <StatusPill status="pending" className="shrink-0">Sin confirmar</StatusPill>
        </div>

        <CopyRow label="Monto exacto de la seña" value={panel.amountLabel} copyValue={panel.amountToCopy} emphasis />

        {panel.alias ? (
          <>
            <CopyRow label="Alias" value={panel.alias} />
            {panel.cbu && <CopyRow label="CBU / CVU" value={panel.cbu} />}
            <div className="space-y-2 pt-1">
              {panel.holderName && <InfoRow label="Titular" value={panel.holderName} />}
              {panel.bankName && <InfoRow label="Banco" value={panel.bankName} />}
            </div>
          </>
        ) : (
          <p className="rounded-inner bg-status-pending-bg px-3 py-2 font-body-sm text-body-sm text-status-pending">
            El local todavía no cargó sus datos para transferir. Escribile por WhatsApp para pedírselos.
          </p>
        )}
      </Card>

      {panel.deadlineLabel && (
        <p className="flex items-start gap-2 rounded-inner bg-surface-container-low px-md py-sm font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="schedule" className="mt-px shrink-0 text-[16px]" />
          <span className="min-w-0">
            Tenés tiempo hasta el <strong className="text-on-surface">{panel.deadlineLabel}</strong>. Si para entonces el local no confirmó la seña, el horario se libera solo.
          </span>
        </p>
      )}

      <div className="space-y-3">
        {panel.whatsappHref ? (
          <a href={panel.whatsappHref} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants(), "w-full")}>
            <Icon name="chat" className="text-[18px]" />
            Mandar comprobante por WhatsApp
          </a>
        ) : (
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
            Mandale el comprobante al local por el medio que usen habitualmente.
          </p>
        )}
        {showMiTurnoLink && (
          <>
            <Link href={panel.miTurnoHref} className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
              Ver mi turno
            </Link>
            <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
              Guardá ese link: ahí vas a ver cuándo se confirma y, si lo necesitás, cancelarlo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
