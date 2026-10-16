import type { Metadata } from "next";
import { Geist } from "next/font/google";
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
    <html lang="es" className={geist.variable}>
      <body>
        <a href="#contenido" className="saltar-al-contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
