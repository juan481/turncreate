"use client";

import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { MENU_TILE_CLASS, MENU_TILE_ICON_CLASS } from "@/components/ui/menu-tile";

/**
 * Antes era una barra propia (link + 2 botones "Copiar"/"Abrir") arriba
 * de la home. Ahora calza como una tile más de la botonera (mismo molde
 * visual que MenuTile, pero <button> en vez de <Link> porque la acción
 * es copiar/compartir, no navegar) -- un solo tap: Web Share API si el
 * navegador la tiene (mobile real), sino copia al portapapeles y avisa
 * por toast. `copiedMessage` deja que la home meta el nudge del usuario
 * demo ("probá reservar uno vos mismo/a...") en el mismo toast, sin
 * necesitar una frase larga pegada en la tile.
 */
export function PublicLink({ url, copiedMessage }: { url: string; copiedMessage?: string }) {
  const toast = useToast();

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ url, title: "Reservá tu turno" });
        return;
      } catch {
        // El usuario cerró el share sheet -- no es un error, no hay nada que avisar.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.show(copiedMessage ?? "Link copiado -- compartilo con tus clientes");
    } catch {
      // Clipboard API puede fallar por permisos del navegador -- no hay
      // mucho más para hacer, al menos no rompemos el flujo.
      toast.show(url, "info");
    }
  }

  return (
    <button type="button" onClick={handleShare} className={MENU_TILE_CLASS}>
      <span className={MENU_TILE_ICON_CLASS}>
        <Icon name="link" />
      </span>
      <div className="w-full min-w-0 flex-1">
        <p className="font-label-lg text-label-lg leading-tight text-on-surface">Tu link de reservas</p>
        <p className="truncate font-label-sm text-label-sm text-on-surface-variant">Tocá para copiar o compartir</p>
      </div>
    </button>
  );
}
