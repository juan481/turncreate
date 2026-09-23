"use client";

import { usePathname } from "next/navigation";

// Sin Framer Motion: remonta el subtree al cambiar de ruta (key=pathname)
// para retriggerear el keyframe de entrada. Da fade-in real entre
// páginas sin dependencias nuevas; no hay fade-out de la página saliente
// porque Next ya desmonta el árbol viejo antes de pintar el nuevo.
//
// fade-in y no fade-up: este div envuelve la página entera, y cualquier
// transform acá lo vuelve containing block de los `fixed` de adentro
// (las páginas-modal quedaban invisibles resolviendo inset-0 contra un
// wrapper de altura 0).
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
