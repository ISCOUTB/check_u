/**
 * api.ts — API simulada de la preinscripción (borrador y envío).
 *
 * ⚠️  SIMULADO: el backend aún no tiene endpoints de solicitudes, borradores ni archivos.
 * Todo vive en memoria, en este módulo: no sobrevive a recargar la página, y los archivos
 * no salen del navegador. Nada se guarda en localStorage, sessionStorage ni en la URL,
 * y nada de esto escribe datos personales en la consola.
 *
 * Lo único real de la página es la sesión (`GET ${API_URL}/auth/me`).
 * Cuando existan los endpoints, se reemplaza el cuerpo de cada función y se quita el TODO.
 */

import type { Nivel } from "@/app/estudiante/documentos-requeridos";
import { borradorVacio, type BorradorPreinscripcion } from "./tipos";

// ─────────────────────────────────────────────────────────────────────────────
// Escenarios de demostración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Caso simulado que se pide con `?escenario=` en la URL, solo en desarrollo:
 *   - "ninguno":  sin borrador (lo normal).
 *   - "borrador": carga un borrador parcial con datos inventados.
 *   - "rechazo":  el envío se rechaza con motivos.
 *   - "enviada":  la solicitud ya fue enviada.
 */
export type Escenario = "ninguno" | "borrador" | "rechazo" | "enviada";

/** El escenario de un valor de la URL. En producción siempre es "ninguno". */
export function escenarioDesde(valor: string | undefined): Escenario {
    if (process.env.NODE_ENV === "production") return "ninguno";
    if (valor === "borrador" || valor === "rechazo" || valor === "enviada") return valor;
    return "ninguno";
}

// ─────────────────────────────────────────────────────────────────────────────
// Memoria del módulo (se pierde al recargar la página)
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que tarda cada llamada simulada, para que se vean "Guardando…" y "Enviando…". */
const RETARDO_MS = 300;

type ResultadoEnvio = { ok: true } | { ok: false; motivos: string[] };

let borradorGuardado: BorradorPreinscripcion | null = null;
let solicitudEnviada: { nivel: Nivel; correo: string } | null = null;
/** Resultado de cada envío por su clave de idempotencia: repetir la clave no repite el envío. */
const enviosPorClave = new Map<string, ResultadoEnvio>();

function esperar(): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver, RETARDO_MS));
}

function copiar(borrador: BorradorPreinscripcion): BorradorPreinscripcion {
    return structuredClone(borrador);
}

function mismoEstudiante(a: { nivel: Nivel; correo: string }, b: { nivel: Nivel; correo: string }): boolean {
    return a.nivel === b.nivel && a.correo === b.correo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Datos de ejemplo (obviamente inventados)
// ─────────────────────────────────────────────────────────────────────────────

/** Un borrador a medias: trae datos, pero faltan campos y documentos. */
function borradorParcial(nivel: Nivel, correo: string): BorradorPreinscripcion {
    const borrador = borradorVacio(nivel, correo);
    borrador.nombres = "Ana";
    borrador.apellidos = "Prueba";
    borrador.codigoEstudiantil = "T00012345";
    borrador.perfil = {
        ...borrador.perfil,
        tipoDocumento: "CC",
        numeroDocumento: "1234567890",
        fechaNacimiento: "2000-01-01",
        departamento: "Bolívar",
        ciudad: "Cartagena",
    };
    borrador.programas[0] = {
        orden: 1,
        programa: "Programa de ejemplo",
        modalidad: "PRESENCIAL",
        tipoOpcionGrado: "",
    };
    if (nivel === "PREGRADO") {
        borrador.pregrado.conoceRegistroSaberPro = false;
    } else {
        borrador.posgrado.esEgresadoPregradoUtb = true;
    }
    borrador.documentos["identification"] = {
        id: "identification",
        nombre: "documento-de-ejemplo.pdf",
        tamano: 245760,
    };
    borrador.guardadoEn = "2026-10-20T15:30:00.000Z";
    return borrador;
}

// ─────────────────────────────────────────────────────────────────────────────
// Funciones públicas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga el borrador del estudiante, o uno vacío si no tiene.
 * Si ya envió su solicitud, `estado` es "enviada" (la página redirige).
 * Lo guardado en esta misma visita a la página tiene prioridad sobre el escenario.
 *
 * SIMULADO — TODO: endpoint pendiente (GET de la solicitud activa con su borrador, p. ej.
 * ${API_URL}/solicitudes/activa; ver también home/api.ts).
 */
export async function cargarPreinscripcion(
    nivel: Nivel,
    correo: string,
    escenario: Escenario,
): Promise<{ estado: "sin_borrador" | "borrador" | "enviada"; borrador: BorradorPreinscripcion }> {
    await esperar();

    const estudiante = { nivel, correo };

    if (escenario === "enviada" || (solicitudEnviada && mismoEstudiante(solicitudEnviada, estudiante))) {
        return { estado: "enviada", borrador: borradorVacio(nivel, correo) };
    }
    if (borradorGuardado && mismoEstudiante(borradorGuardado, estudiante)) {
        return { estado: "borrador", borrador: copiar(borradorGuardado) };
    }
    if (escenario === "borrador") {
        return { estado: "borrador", borrador: borradorParcial(nivel, correo) };
    }
    return { estado: "sin_borrador", borrador: borradorVacio(nivel, correo) };
}

/**
 * Guarda el borrador tal como está, sin exigir nada. Devuelve la fecha del guardado (ISO 8601).
 *
 * SIMULADO — TODO: endpoint pendiente (guardar el borrador de la solicitud, sin consumir
 * ningún reenvío).
 */
export async function guardarBorrador(borrador: BorradorPreinscripcion): Promise<{ guardadoEn: string }> {
    await esperar();

    const guardadoEn = new Date().toISOString();
    borradorGuardado = { ...copiar(borrador), guardadoEn };
    return { guardadoEn };
}

/**
 * Envía la preinscripción. Con la misma clave de idempotencia devuelve el mismo resultado
 * sin enviar otra vez. Con el escenario "rechazo" el backend la rechaza con motivos.
 *
 * SIMULADO — TODO: endpoint pendiente (crear la entrega inicial, con la clave de idempotencia
 * del contrato `Submission`; ver docs/contratos.md).
 */
export async function enviarPreinscripcion(
    borrador: BorradorPreinscripcion,
    claveIdempotencia: string,
    escenario: Escenario,
): Promise<ResultadoEnvio> {
    await esperar();

    const anterior = enviosPorClave.get(claveIdempotencia);
    if (anterior) return anterior;

    let resultado: ResultadoEnvio;
    if (escenario === "rechazo") {
        resultado = {
            ok: false,
            motivos: [
                "El número de documento no coincide con el registrado en la universidad.",
                "El programa indicado no coincide con el de tu código estudiantil.",
            ],
        };
    } else {
        resultado = { ok: true };
        solicitudEnviada = { nivel: borrador.nivel, correo: borrador.correo };
        borradorGuardado = null;
    }

    enviosPorClave.set(claveIdempotencia, resultado);
    return resultado;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de configuración y formato
// ─────────────────────────────────────────────────────────────────────────────

const BYTES_POR_MB = 1024 * 1024;

/**
 * Tamaño máximo de un PDF en bytes, o null si no está configurado (el cliente no limita el
 * tamaño). El valor viene de NEXT_PUBLIC_TAMANO_MAXIMO_PDF_MB, en MB. Un valor que no es un
 * número positivo se ignora.
 *
 * TODO: el backend es quien decide el tamaño máximo real; esto solo evita cargas inútiles.
 */
export function tamanoMaximoPdfBytes(
    valor: string | undefined = process.env.NEXT_PUBLIC_TAMANO_MAXIMO_PDF_MB,
): number | null {
    const texto = valor?.trim();
    if (!texto || !/^\d+(\.\d+)?$/.test(texto)) return null;

    const megas = Number(texto);
    return megas > 0 ? Math.floor(megas * BYTES_POR_MB) : null;
}

const FORMATO_GUARDADO = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

/** Fecha y hora del último guardado en hora de Bogotá: "22/10/2026, 3:40 p. m." */
export function formatearGuardado(iso: string): string {
    return FORMATO_GUARDADO.format(new Date(iso));
}
