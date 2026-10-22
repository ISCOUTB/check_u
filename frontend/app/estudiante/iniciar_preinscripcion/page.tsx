import type { Metadata } from "next";
import FormularioPreinscripcion from "./FormularioPreinscripcion";

export const metadata: Metadata = { title: "Iniciar preinscripción" };

/** Un parámetro de la URL puede venir repetido (`?nivel=A&nivel=B`): se toma el primero. */
function primero(valor: string | string[] | undefined): string | undefined {
    return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * /estudiante/iniciar_preinscripcion?nivel=PREGRADO|POSGRADO (componente de servidor).
 * Lee los parámetros aquí y se los pasa al formulario: así el cliente no usa useSearchParams,
 * que en Next 16 exige un Suspense. Validarlos es cosa del formulario.
 */
export default async function IniciarPreinscripcion({
    searchParams,
}: {
    searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
    const { nivel, escenario } = await searchParams;
    return <FormularioPreinscripcion nivel={primero(nivel)} escenario={primero(escenario)} />;
}
