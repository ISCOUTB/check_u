/**
 * api.ts — API de la preinscripción (borrador y envío).
 *
 * Persistencia en backend (POST /api/solicitudes/enviar y POST /api/solicitudes/borrador).
 * En desarrollo, soporta escenarios simulados mediante ?escenario= en la URL.
 */

import { documentosRequeridos, type NivelAcademico as Nivel } from "@/app/estudiante/documentos-requeridos";
import { errorDeConexion, interpretarErrorGuardado } from "./mensajes-borrador";
import type { ContextoPeriodo } from "./PeriodoInscripcion";
import { borradorVacio, type BorradorPreinscripcion } from "./tipos";

// ─────────────────────────────────────────────────────────────────────────────
// Escenarios de demostración
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Caso simulado que se pide con `?escenario=` en la URL, solo en desarrollo:
 *   - "ninguno":  sin borrador (lo normal).
 *   - "borrador": carga un borrador parcial con datos inventados.
 *   - "rechazo":  carga un borrador completo, listo para enviar, y el envío se rechaza con motivos.
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
// Estado del envío en la visita actual
// ─────────────────────────────────────────────────────────────────────────────

/** Lo que tarda cada llamada simulada, para que se vean "Guardando…" y "Enviando…". */
const RETARDO_MS = 300;

type ResultadoEnvio = { ok: true } | { ok: false; motivos: string[] };

let solicitudEnviada: { nivel: Nivel; correo: string } | null = null;
/** Resultado de cada envío por su clave de idempotencia: repetir la clave no repite el envío. */
const enviosPorClave = new Map<string, ResultadoEnvio>();

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

function esperar(): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver, RETARDO_MS));
}

function mismoEstudiante(a: { nivel: Nivel; correo: string }, b: { nivel: Nivel; correo: string }): boolean {
    return a.nivel === b.nivel && a.correo === b.correo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Datos de ejemplo
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

/**
 * Un borrador completo: todos los campos del nivel llenos y un PDF por cada documento
 * requerido (sin segundo programa). Se puede enviar de inmediato.
 */
function borradorCompleto(nivel: Nivel, correo: string): BorradorPreinscripcion {
    const borrador = borradorParcial(nivel, correo);
    borrador.codigoEstudiantil = "T00000001";
    borrador.perfil = {
        ...borrador.perfil,
        genero: "OTRO",
        telefonoFijo: "6050000000",
        celular: "3000000000",
        direccion: "Calle de ejemplo 1",
    };
    borrador.segundoPrograma = false;

    if (nivel === "PREGRADO") {
        borrador.programas[0].tipoOpcionGrado = "TRABAJO_DE_GRADO";
        borrador.pregrado = {
            conoceRegistroSaberPro: false,
            numeroRegistroSaberPro: "",
            fechaExamenSaberPro: "",
            esEmpleadoUtb: false,
            tipoContrato: "",
            esHijoDeEmpleadoUtb: false,
        };
    } else {
        borrador.posgrado = {
            nivelEstudios: "PROFESIONAL",
            tituloObtenido: "Título de ejemplo",
            esEgresadoPregradoUtb: true,
        };
        borrador.experiencia = [
            { orden: 1, empresa: "Empresa de ejemplo", cargo: "Cargo de ejemplo", tiempo: "2 años" },
            { orden: 2, empresa: "Otra empresa de ejemplo", cargo: "Otro cargo de ejemplo", tiempo: "1 año" },
        ];
    }

    borrador.documentos = {};
    for (const documento of documentosRequeridos(nivel, false)) {
        const id = documento.tipo;
        borrador.documentos[id] = {
            id,
            nombre: `${id}-prueba.pdf`,
            tamano: 1024,
        };
    }
    return borrador;
}

// ─────────────────────────────────────────────────────────────────────────────
// Funciones públicas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga el borrador del estudiante, o uno vacío si no tiene.
 * Si ya envió su solicitud, `estado` es "enviada" (la página redirige).
 * Fuera de los escenarios de demostración, consulta siempre la base de datos.
 * Los escenarios "borrador" (parcial) y "rechazo" (completo) cargan un borrador de ejemplo.
 */
export async function cargarPreinscripcion(
    nivel: Nivel,
    correo: string,
    escenario: Escenario,
): Promise<{ estado: "sin_borrador" | "borrador" | "enviada"; borrador: BorradorPreinscripcion; periodos?: ContextoPeriodo }> {
    if (escenario !== "ninguno") await esperar();

    const estudiante = { nivel, correo };

    if (escenario === "enviada" || (solicitudEnviada && mismoEstudiante(solicitudEnviada, estudiante))) {
        return { estado: "enviada", borrador: borradorVacio(nivel, correo) };
    }
    if (escenario === "borrador") {
        return { estado: "borrador", borrador: borradorParcial(nivel, correo) };
    }
    if (escenario === "rechazo") {
        return { estado: "borrador", borrador: borradorCompleto(nivel, correo) };
    }
    const respuesta = await fetch(`${API_URL}/solicitudes/borrador`, {
        credentials: "include", cache: "no-store",
    });
    if (!respuesta.ok) throw new Error("No fue posible recuperar el borrador");
    const datos = await respuesta.json();
    if (datos.estado && datos.estado !== "BORRADOR") {
        return { estado: "enviada", borrador: borradorVacio(nivel, correo) };
    }
    if (!datos.borrador) return { estado: "sin_borrador", borrador: borradorVacio(nivel, correo), periodos: datos.periodos };
    const base = borradorVacio(datos.borrador.nivel ?? nivel, correo);
    // PostgreSQL usa NULL para textos pendientes; los controles del formulario usan "".
    const normalizar = <T extends object>(vacio: T, guardado: Partial<T> | undefined): T =>
        Object.fromEntries(Object.entries(vacio).map(([clave, valor]) => {
            const dato = guardado?.[clave as keyof T];
            return [clave, dato == null ? valor : dato];
        })) as T;
    const guardado = datos.borrador;
    return { estado: "borrador", periodos: datos.periodos, borrador: {
        ...normalizar(base, guardado), correo, id_solicitud: datos.id_solicitud,
        perfil: normalizar(base.perfil, guardado.perfil),
        pregrado: normalizar(base.pregrado, guardado.pregrado),
        posgrado: normalizar(base.posgrado, guardado.posgrado),
        programas: base.programas.map(p => normalizar(p, guardado.programas?.find((g: { orden: number }) => g.orden === p.orden))),
        experiencia: base.experiencia.map(e => normalizar(e, guardado.experiencia?.find((g: { orden: number }) => g.orden === e.orden))),
        documentos: guardado.documentos ?? {},
    } };
}

/**
 * Guarda campos parciales. La primera asignación requiere un periodo disponible en el backend.
 * Devuelve la fecha del guardado (ISO 8601) y la información de periodos.
 * Solo confirma el guardado después de recibir éxito del backend.
 */
export async function guardarBorrador(borrador: BorradorPreinscripcion): Promise<{ guardadoEn: string; id_solicitud: number; periodos?: ContextoPeriodo }> {
    let respuesta: Response;
    try {
        respuesta = await fetch(`${API_URL}/solicitudes/borrador`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(borrador, (clave, valor) => clave === "archivo" ? undefined : valor),
        });
    } catch {
        throw errorDeConexion();
    }
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) throw interpretarErrorGuardado(respuesta.status, datos);
    if (!datos?.ok || !Number.isInteger(datos.id_solicitud) || datos.id_solicitud < 1 ||
        typeof datos.guardadoEn !== "string" || !Number.isFinite(Date.parse(datos.guardadoEn))) {
        // Una respuesta ilegible no confirma el guardado; nunca anunciar éxito en este caso.
        throw interpretarErrorGuardado(500, null);
    }
    return { guardadoEn: datos.guardadoEn, id_solicitud: datos.id_solicitud, ...(datos.periodos ? { periodos: datos.periodos } : {}) };
}

/**
 * Envía la preinscripción vía POST /api/solicitudes/enviar.
 * Con la misma clave de idempotencia devuelve el mismo resultado sin enviar otra vez.
 * Con el escenario "rechazo" simula rechazo con motivos.
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
        enviosPorClave.set(claveIdempotencia, resultado);
        return resultado;
    }

    const requeridos = documentosRequeridos(borrador.nivel, borrador.segundoPrograma === true);
    const faltantes = requeridos.filter(d => !borrador.documentos[d.id]?.archivo);
    if (faltantes.length) return { ok: false, motivos: [
        `Selecciona nuevamente los PDF antes de enviar: ${faltantes.map(d => d.etiqueta).join(", ")}.`
    ] };
    const form = new FormData();
    form.append("datos", JSON.stringify(borrador, (clave, valor) => clave === "archivo" ? undefined : valor));
    form.append("tipos", requeridos.map(d => d.id).join(","));
    for (const d of requeridos) form.append("documentos", borrador.documentos[d.id].archivo!);
    const respuesta = await fetch(`${API_URL}/solicitudes/enviar`, {
        method: "POST", credentials: "include", body: form,
    });
    const data = await respuesta.json().catch(() => null);
    if (respuesta.ok && data?.ok === true) {
        resultado = { ok: true };
        solicitudEnviada = { nivel: borrador.nivel, correo: borrador.correo };
        enviosPorClave.set(claveIdempotencia, resultado);
        return resultado;
    }
    // Los fallos NO se almacenan: reintentar debe comunicarse de nuevo con el backend.
    const mensaje = respuesta.status === 503 ? "El motor o la base de datos no están disponibles. Tu borrador se conserva; intenta nuevamente." :
        respuesta.status === 502 ? "El motor no pudo completar el análisis. Tu borrador se conserva; revisa los PDF e intenta nuevamente." :
        respuesta.status === 409 ? "La solicitud ya fue enviada o no hay un periodo disponible. Recarga para comprobar su estado." :
        respuesta.status === 400 ? "Revisa los datos del formulario y adjunta todos los PDF requeridos." :
        "No fue posible registrar la preinscripción. Tu borrador se conserva.";
    return { ok: false, motivos: [mensaje] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de configuración y formato
// ─────────────────────────────────────────────────────────────────────────────

const BYTES_POR_MB = 1024 * 1024;

/**
 * Tamaño máximo de un PDF en bytes, o null si no está configurado (el cliente no limita el
 * tamaño). El valor viene de NEXT_PUBLIC_TAMANO_MAXIMO_PDF_MB, en MB. Un valor que no es un
 * número positivo se ignora.
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
