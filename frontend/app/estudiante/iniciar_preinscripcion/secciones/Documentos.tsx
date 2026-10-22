"use client";

import type { Progreso } from "../validacion";
import styles from "../iniciar_preinscripcion.module.css";
import { Seccion } from "./comun";

/**
 * Sección de documentos. Por ahora solo el contador: las zonas de carga de cada PDF
 * (ZonaDocumento) llegan con la parte de guardar y enviar.
 */
export default function Documentos({ progreso }: { progreso: Progreso }) {
    const { cargados, requeridos } = progreso.documentos;

    return (
        <Seccion id="documentos" descripcion="Cada documento va en su propio archivo PDF.">
            <p className={styles.contador}>
                {cargados} de {requeridos} documentos cargados
            </p>
        </Seccion>
    );
}
