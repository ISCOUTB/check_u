import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SCRIPT_TEMA } from "./lib/tema";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Cada ruta define su título; el anunciador de rutas de Next lo lee al navegar.
export const metadata: Metadata = {
  title: { default: "CheckU", template: "%s · CheckU" },
  description: "Solicitud de grado, más sencilla.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script de tema pone data-tema en <html> antes de hidratar.
    <html lang="es" className={geist.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <a href="#contenido" className="saltar-al-contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
