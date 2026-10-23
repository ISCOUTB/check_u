import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Bienvenida",
};

export default function BienvenidaLayout({ children }: { children: React.ReactNode }) {
    return children;
}
