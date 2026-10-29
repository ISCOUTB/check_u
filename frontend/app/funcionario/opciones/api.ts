import type { NombreIcono } from "@/app/components/ui/Icono";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export const CAMPOS_ADMIN = [
    {
        id: "TIPO_DOCUMENTO",
        titulo: "Tipo de documento",
        descripcion: "Documentos de identidad que puede elegir el estudiante.",
        icono: "documento",
    },
    {
        id: "GENERO",
        titulo: "Género",
        descripcion: "Opciones disponibles al responder el género.",
        icono: "persona",
    },
    {
        id: "PROGRAMA",
        titulo: "Programa académico",
        descripcion: "Programas en los que se puede solicitar grado.",
        icono: "graduacion",
    },
    {
        id: "OPCION_GRADO",
        titulo: "Opción de grado",
        descripcion: "Modalidades de trabajo de grado para pregrado.",
        icono: "escudo",
    },
    {
        id: "TIPO_DISCAPACIDAD",
        titulo: "Tipo de discapacidad",
        descripcion: "Apoyos que el estudiante puede declarar para la ceremonia.",
        icono: "accesibilidad",
    },
] as const satisfies readonly {
    id: string;
    titulo: string;
    descripcion: string;
    icono: NombreIcono;
}[];

export type CampoAdmin = (typeof CAMPOS_ADMIN)[number]["id"];

export interface OpcionAdmin {
    id: number;
    campo: CampoAdmin;
    valor: string;
    etiqueta: string;
    orden: number;
}

export interface DuplicadoImportado {
    linea: number;
    valor: string;
}

export interface InvalidoImportado {
    linea: number;
    valor: string;
    motivo: string;
}

export interface ResultadoImportacion {
    campo: CampoAdmin;
    creadas: number;
    total: number;
    duplicados: DuplicadoImportado[];
    vacias: number[];
    invalidos: InvalidoImportado[];
}

function mensajeDe(datos: unknown, respaldo: string): string {
    const mensaje = (datos as { message?: string | string[] } | null)?.message;
    if (Array.isArray(mensaje)) return mensaje.join(" ");
    return typeof mensaje === "string" && mensaje.trim() ? mensaje : respaldo;
}

async function solicitar<T>(ruta: string, init?: RequestInit): Promise<T> {
    let respuesta: Response;
    try {
        respuesta = await fetch(`${API_URL}${ruta}`, {
            credentials: "include",
            cache: "no-store",
            ...init,
        });
    } catch {
        throw new Error("No fue posible conectar con el servidor. Revisa tu conexión.");
    }
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
        throw new Error(mensajeDe(datos, "No fue posible completar la operación."));
    }
    return datos as T;
}

export async function obtenerOpciones(señal?: AbortSignal): Promise<OpcionAdmin[]> {
    return solicitar<OpcionAdmin[]>("/opciones-campo", { signal: señal });
}

export async function crearOpcion(campo: CampoAdmin, etiqueta: string): Promise<OpcionAdmin> {
    return solicitar<OpcionAdmin>("/opciones-campo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo, etiqueta }),
    });
}

export async function eliminarOpcion(id: number): Promise<void> {
    await solicitar(`/opciones-campo/${id}`, { method: "DELETE" });
}

export async function reordenarOpciones(campo: CampoAdmin, ids: number[]): Promise<OpcionAdmin[]> {
    return solicitar<OpcionAdmin[]>("/opciones-campo/orden", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo, ids }),
    });
}

export async function importarOpciones(campo: CampoAdmin, texto: string): Promise<ResultadoImportacion> {
    return solicitar<ResultadoImportacion>("/opciones-campo/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campo, texto }),
    });
}
