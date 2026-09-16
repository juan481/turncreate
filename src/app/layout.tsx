import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "TurnCreate",
    template: "%s · TurnCreate",
  },
  description:
    "Turnos, CRM y caja para barberías, salones y centros de estética.",
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
