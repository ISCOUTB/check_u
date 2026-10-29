"use client";

import ProgresoDocumental from "@/app/components/ui/ProgresoDocumental";
import type { ProgresoEnvio } from "../envio-documental";
import Button from "@/app/components/ui/Button";
import Dialog from "@/app/components/ui/Dialog";
import { MODALIDADES, type Opcion } from "./constantes";
import type { OpcionesFormulario } from "./opciones";
import type { BorradorPreinscripcion, ProgramaSolicitud } from "./tipos";
import type { Progreso } from "./validacion";
import styles from "./iniciar_preinscripcion.module.css";

/** Lo que se va a enviar, en pocas líneas, para el diálogo de confirmación. */
function datosDelEnvio(
    borrador: BorradorPreinscripcion,
    avance: Progreso,
    opciones: OpcionesFormulario,
): [string, string][] {
    const etiqueta = (lista: readonly Opcion[], valor: string) =>
        lista.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;
    const programa = (solicitud: ProgramaSolicitud) =>
        `${etiqueta(opciones.PROGRAMA, solicitud.programa)} · ${etiqueta(MODALIDADES, solicitud.modalidad)}`;
    const { perfil, programas } = borrador;

    const datos: [string, string][] = [
        ["Nombre", `${borrador.nombres.trim()} ${borrador.apellidos.trim()}`],
        ["Documento", `${etiqueta(opciones.TIPO_DOCUMENTO, perfil.tipoDocumento)} ${perfil.numeroDocumento}`],
        ["Código estudiantil", borrador.codigoEstudiantil.trim()],
        ["Programa", programa(programas[0])],
    ];
    if (borrador.segundoPrograma === true) datos.push(["Segundo programa", programa(programas[1])]);
    const { cargados, requeridos } = avance.documentos;
    datos.push(["Documentos", `${cargados} de ${requeridos} documentos cargados`]);
    return datos;
}

export interface DialogoConfirmarEnvioProps {
    progresoEnvio?: ProgresoEnvio | null;
    abierto: boolean;
    borrador: BorradorPreinscripcion | null;
    avance: Progreso | null;
    opciones: OpcionesFormulario | null;
    enviando: boolean;
    /** El último envío falló por un error técnico: el botón pasa a "Reintentar" */
    errorEnvio: boolean;
    /** "Volver a editar", Esc o la ×: quien orquesta decide si se puede cerrar (no mientras envía) */
    alCerrar: () => void;
    alEnviar: () => void;
}

/**
 * "Revisa tu información antes de enviar": un resumen de lo que se envía, la advertencia de que
 * después es de solo consulta y que CheckU prevalida, no aprueba. Los botones son Volver a editar y
 * Enviar ("Enviando…", y "Reintentar" tras un error técnico).
 */
export default function DialogoConfirmarEnvio({
    abierto,
    progresoEnvio,
    borrador,
    avance,
    opciones,
    enviando,
    errorEnvio,
    alCerrar,
    alEnviar,
}: DialogoConfirmarEnvioProps) {
    return (
        <Dialog
            abierto={abierto}
            alCerrar={alCerrar}
            titulo="Revisa tu información antes de enviar"
            descripcion="Después de enviarla, tu preinscripción queda de solo consulta."
            compacto
        >
            <ProgresoDocumental progreso={progresoEnvio ?? null} />
            <dl className={styles.datosEnvio}>
                {borrador &&
                    avance &&
                    opciones &&
                    datosDelEnvio(borrador, avance, opciones).map(([dato, valor]) => (
                        <div key={dato}>
                            <dt>{dato}</dt>
                            <dd>{valor}</dd>
                        </div>
                    ))}
            </dl>
            <p className={styles.notaDialogo}>
                CheckU prevalida tus documentos antes de la solicitud formal: enviarla no aprueba tu grado.
            </p>
            {errorEnvio && (
                <p role="alert" className={styles.errorDialogo}>
                    No fue posible enviar tu preinscripción. Revisa tu conexión e inténtalo de nuevo.
                </p>
            )}
            <div className={styles.accionesDialogo}>
                <Button variante="secundario" disabled={enviando} onClick={alCerrar}>
                    Volver a editar
                </Button>
                <Button cargando={enviando} textoCargando="Enviando…" conservarFoco onClick={alEnviar}>
                    {errorEnvio ? "Reintentar" : "Enviar"}
                </Button>
            </div>
        </Dialog>
    );
}
