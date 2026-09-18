"use client";

import { usePathname } from "next/navigation";

// Sin Framer Motion: remonta el subtree al cambiar de ruta (key=pathname)
// para retriggerear el keyframe de entrada. Da fade-in real entre
// páginas sin dependencias nuevas; no hay fade-out de la página saliente
// porque Next ya desmonta el árbol viejo antes de pintar el nuevo.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-fade-up">
      {children}
    </div>
  );
}
