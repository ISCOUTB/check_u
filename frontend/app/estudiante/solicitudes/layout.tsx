import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Mis solicitudes",
};

export default function SolicitudesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
