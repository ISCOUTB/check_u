import type { Metadata } from "next";

export const metadata: Metadata = { title: "Prueba de conexión" };

export default function Layout({ children }: { children: React.ReactNode }) {
    return children;
}
