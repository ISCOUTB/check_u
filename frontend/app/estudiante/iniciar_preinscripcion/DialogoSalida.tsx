"use client";

import Button from "@/app/components/ui/Button";
import Dialog from "@/app/components/ui/Dialog";
import styles from "./iniciar_preinscripcion.module.css";

export interface DialogoSalidaProps {
    abierto: boolean;
    guardando: boolean;
    /** El último guardado falló: se avisa aquí, porque la barra queda detrás del diálogo */
    errorGuardado: string | null;
    alGuardarYSalir: () => void;
    alSalirSinGuardar: () => void;
    alSeguirAqui: () => void;
}

/**
 * "Tienes cambios sin guardar" (decisión 6 del spec), al tocar un enlace interno con cambios:
 * Guardar y salir, Salir sin guardar o Seguir aquí. Esc y la × equivalen a Seguir aquí.
 */
export default function DialogoSalida({
    abierto,
    guardando,
    errorGuardado,
    alGuardarYSalir,
    alSalirSinGuardar,
    alSeguirAqui,
}: DialogoSalidaProps) {
    return (
        <Dialog
            abierto={abierto}
            alCerrar={() => {
                // Mientras guarda no se cierra: al terminar, "Guardar y salir" sigue el enlace.
                if (!guardando) alSeguirAqui();
            }}
            titulo="Tienes cambios sin guardar"
            descripcion="Si sales ahora, pierdes lo que cambiaste desde la última vez que guardaste."
            compacto
        >
            {errorGuardado && (
                <p role="alert" className={styles.errorDialogo}>
                    {errorGuardado}
                </p>
            )}
            <div className={styles.accionesDialogo}>
                <Button cargando={guardando} textoCargando="Guardando…" conservarFoco onClick={alGuardarYSalir}>
                    Guardar y salir
                </Button>
                <Button variante="secundario" disabled={guardando} onClick={alSalirSinGuardar}>
                    Salir sin guardar
                </Button>
                <Button variante="secundario" disabled={guardando} onClick={alSeguirAqui}>
                    Seguir aquí
                </Button>
            </div>
        </Dialog>
    );
}
