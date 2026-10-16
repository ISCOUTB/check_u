import type { Metadata } from "next";
import FormularioLogin from "@/app/components/login/FormularioLogin";

// La plantilla del layout raíz no se aplica a su propia página: el título va completo.
export const metadata: Metadata = { title: { absolute: "Iniciar sesión · CheckU" } };

export default function Login() {
    return <FormularioLogin />;
}
