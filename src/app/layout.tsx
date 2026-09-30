import type { Metadata } from "next";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${plusJakartaSans.variable} antialiased`}>
      <head>
        {/* Material Symbols no está en el catálogo curado de next/font/google
            (es una variable icon font con ejes opsz/wght/FILL/GRAD por query
            string), así que se carga igual que en las pantallas de referencia. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- regla pensada para Pages Router; en App Router un <link> en el root layout es el patrón soportado */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-on-surface">
        {children}
      </body>
    </html>
  );
}
