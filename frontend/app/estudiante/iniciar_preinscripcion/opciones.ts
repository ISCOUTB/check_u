import type { OpcionCampo } from "@/app/components/ui/Field";
import type { Nivel } from "@/app/estudiante/documentos-requeridos";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

/** Campos cuyas opciones administra el funcionario y aquí se cargan desde la base de datos. */
export const CAMPOS_FORMULARIO = [
    "TIPO_DOCUMENTO",
    "GENERO",
    "PROGRAMA",
    "OPCION_GRADO",
    "TIPO_DISCAPACIDAD",
] as const;

export type CampoFormulario = (typeof CAMPOS_FORMULARIO)[number];

export type OpcionesFormulario = Record<CampoFormulario, OpcionCampo[]>;

function sinOpciones(): OpcionesFormulario {
    return {
        TIPO_DOCUMENTO: [],
        GENERO: [],
        PROGRAMA: [],
        OPCION_GRADO: [],
        TIPO_DISCAPACIDAD: [],
    };
}

/**
 * Carga las opciones configuradas en el panel del funcionario. Si se especifica el nivel,
 * consulta y asigna únicamente los programas académicos asociados a su nivel de formación.
 * El orden que devuelve el backend es el que ve el estudiante: no se reordena en el cliente.
 */
export async function cargarOpcionesFormulario(
    nivel?: Nivel,
    signal?: AbortSignal,
): Promise<OpcionesFormulario> {
    const url = nivel ? `${API_URL}/opciones-campo?nivel=${nivel}` : `${API_URL}/opciones-campo`;
    const respuesta = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        signal,
    });
    if (!respuesta.ok) {
        throw new Error("No fue posible cargar las opciones del formulario.");
    }
    const datos: unknown = await respuesta.json();
    if (!Array.isArray(datos)) {
        throw new Error("La respuesta de opciones del formulario no es válida.");
    }

    const opciones = sinOpciones();
    const campoProgramaNivel = nivel === "POSGRADO" ? "PROGRAMA_POSGRADO" : "PROGRAMA_PREGRADO";

    for (const fila of datos as Array<{ campo?: unknown; valor?: unknown; etiqueta?: unknown }>) {
        if (typeof fila.valor !== "string" || typeof fila.etiqueta !== "string") continue;
        const campo = String(fila.campo);

        if (campo === "PROGRAMA_PREGRADO" || campo === "PROGRAMA_POSGRADO") {
            if (!nivel || campo === campoProgramaNivel) {
                opciones.PROGRAMA.push({
                    valor: fila.valor,
                    etiqueta: fila.etiqueta,
                });
            }
        } else if (campo === "PROGRAMA") {
            opciones.PROGRAMA.push({
                valor: fila.valor,
                etiqueta: fila.etiqueta,
            });
        } else if ((CAMPOS_FORMULARIO as readonly string[]).includes(campo)) {
            opciones[campo as CampoFormulario].push({
                valor: fila.valor,
                etiqueta: fila.etiqueta,
            });
        }
    }
    return opciones;
}

/**
 * Un borrador guardado puede tener un valor que ya no está en el catálogo (por ejemplo,
 * un programa escrito antes de que existiera el selector). Se conserva visible para no
 * perder el dato mientras el estudiante lo reemplaza.
 */
export function conValorActual(
    opciones: readonly OpcionCampo[],
    valor: string,
): readonly OpcionCampo[] {
    if (!valor || opciones.some((opcion) => opcion.valor === valor)) return opciones;
    return [...opciones, { valor, etiqueta: valor }];
}
