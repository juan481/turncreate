import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const SITE_URL = "https://turn.justcreate.com.ar";
const DESCRIPTION =
  "Turnos online, CRM de clientes y caja para barberías, salones y centros de estética. Reservá en minutos y gestioná tu local desde un solo lugar.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TurnCreate",
    template: "%s · TurnCreate",
  },
  description: DESCRIPTION,
  keywords: [
    "turnos online",
    "reserva de turnos",
    "CRM barbería",
    "software para peluquerías",
    "sistema de turnos Argentina",
    "agenda para salones de belleza",
  ],
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: SITE_URL,
    siteName: "TurnCreate",
    title: "TurnCreate — Turnos, CRM y caja para tu local",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "TurnCreate — Turnos, CRM y caja para tu local",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// `viewportFit: "cover"` deja que el contenido llegue hasta los bordes
// reales del teléfono (notch / home indicator) para que los `env(safe-
// area-inset-*)` de globals.css tengan algo que compensar -- sin esto,
// Safari/Chrome mobile ya reservan ese margen solos y los paddings de
// safe-area quedan duplicados. `themeColor` pinta la barra de estado del
// sistema (y la UI de instalación PWA) con el violeta de marca en vez
// del blanco/negro por defecto del navegador.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7069e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${plusJakartaSans.variable} antialiased`}>
      <body className="min-h-screen bg-canvas font-sans text-on-surface">
        {children}
      </body>
    </html>
  );
}
