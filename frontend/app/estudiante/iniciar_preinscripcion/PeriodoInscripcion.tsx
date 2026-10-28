"use client";

import { useState } from "react";
import Dialog from "../../components/ui/Dialog";
import styles from "./PeriodoInscripcion.module.css";

interface Periodo {
    id: string;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    fechaGraduacion: string;
    fechaCorte: string;
    estado: "ABIERTO" | "CERRADO";
}
export interface ContextoPeriodo {
    fechaActual: string;
    periodoAsignado: Periodo | null;
    periodoDisponible: Periodo | null;
    proximosPeriodos: Periodo[];
}

/** DATE es una fecha calendario: no convertirla a medianoche UTC ni restar días en el cliente. */
function fecha(valor: string) {
    const [anio, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${anio}`;
}

export default function PeriodoInscripcion({ datos }: { datos: ContextoPeriodo | null }) {
    const [abierto, setAbierto] = useState(false);
    if (!datos) return <section className={styles.seccion} aria-label="Periodo de inscripción">
        <h2>Periodo de inscripción</h2>
        <p>No fue posible obtener la información del periodo. Intenta cargar nuevamente tu preinscripción.</p>
    </section>;
    const periodo = datos.periodoAsignado ?? datos.periodoDisponible;
    return <section className={styles.seccion} aria-label="Periodo de inscripción">
        <div className={styles.resumen}>
            <span>Periodo de inscripción (automático):</span>
            <strong>{periodo?.nombre ?? "Sin periodo disponible"}</strong>
            <button type="button" className={styles.ayuda} aria-label="Ver información del periodo de inscripción"
                aria-haspopup="dialog" onClick={() => setAbierto(true)}>?</button>
        </div>
        <Dialog abierto={abierto} alCerrar={() => setAbierto(false)}
            titulo={datos.periodoAsignado ? "Periodo de inscripción asignado" : "Periodo de inscripción"} compacto>
            <div className={styles.detalles}>
            {/* Se conserva el contenido informativo del bloque original. */}
            {periodo ? <>
                <h3>{periodo.nombre}</h3>
                {!datos.periodoAsignado && <p>Este periodo está disponible. Se asignará automáticamente al guardar tu solicitud, si continúa habilitado.</p>}
                <dl className={styles.fechas}>
                    <div><dt>Inicio de inscripción</dt><dd>{fecha(periodo.fechaInicio)}</dd></div>
                    <div><dt>Fin de inscripción</dt><dd>{fecha(periodo.fechaFin)}</dd></div>
                    <div><dt>Fecha de corte para nuevas asignaciones</dt><dd>{fecha(periodo.fechaCorte)}</dd></div>
                </dl>
                <p>Desde la fecha de corte se reservan siete días calendario para revisión humana. Una solicitud ya asignada conserva su periodo.</p>
                {datos.periodoAsignado?.estado === "CERRADO" && <p>Este periodo fue cerrado por la oficina de grados. Tu solicitud conserva su asignación.</p>}
            </> : <p role="status">Actualmente no hay un periodo de inscripción disponible para asignar tu solicitud. Consulta las próximas fechas o comunícate con la oficina de grados.</p>}
            <h3>Próximos periodos de inscripción</h3>
            <p>Estas fechas son informativas. El sistema asigna el periodo automáticamente; no necesitas seleccionarlo.</p>
            {datos.proximosPeriodos.length ? <ul className={styles.proximos}>
                {datos.proximosPeriodos.map(p => <li key={p.id}><strong>{p.nombre}</strong><span>Inicio: {fecha(p.fechaInicio)} · Finalización: {fecha(p.fechaFin)}</span></li>)}
            </ul> : <p>No hay próximos periodos habilitados registrados.</p>}
            </div>
        </Dialog>
    </section>;
}
