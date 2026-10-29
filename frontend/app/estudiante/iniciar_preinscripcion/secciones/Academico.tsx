"use client";

import type { ChangeEvent } from "react";
import Field from "@/app/components/ui/Field";
import Opciones from "@/app/components/ui/Opciones";
import { MODALIDADES } from "../constantes";
import { conValorActual } from "../opciones";
import type { Modalidad } from "../tipos";
import { ID_CAMPOS, idCampoPrograma, type Orden } from "../validacion";
import styles from "../iniciar_preinscripcion.module.css";
import { aSiNo, cambioPrograma, Condicional, deSiNo, OPCIONES_SI_NO, Seccion, type PropsSeccion } from "./comun";

export default function Academico({ borrador, cambiar, errores, opciones }: PropsSeccion) {
    return (
        <Seccion id="academico">
            <div className={styles.campos}>
                <Field
                    id={ID_CAMPOS.codigoEstudiantil}
                    etiqueta="Código estudiantil"
                    obligatorio
                    ayuda="Ejemplo: T00012345"
                    autoComplete="off"
                    spellCheck={false}
                    value={borrador.codigoEstudiantil}
                    onChange={(evento) => {
                        const codigoEstudiantil = evento.target.value;
                        cambiar((b) => ({ ...b, codigoEstudiantil }));
                    }}
                    error={errores[ID_CAMPOS.codigoEstudiantil]}
                />

                <CamposPrograma orden={1} borrador={borrador} cambiar={cambiar} errores={errores} opciones={opciones} />

                <Opciones
                    id={ID_CAMPOS.segundoPrograma}
                    className={styles.ancho}
                    leyenda="¿Solicitas grado en un segundo programa?"
                    nombre="segundo-programa"
                    opciones={OPCIONES_SI_NO}
                    valor={aSiNo(borrador.segundoPrograma)}
                    alCambiar={(valor) => {
                        const segundoPrograma = deSiNo(valor);
                        cambiar((b) => ({ ...b, segundoPrograma }));
                    }}
                    error={errores[ID_CAMPOS.segundoPrograma]}
                />

                {borrador.segundoPrograma === true && (
                    <Condicional className={styles.ancho}>
                        <fieldset className={styles.subgrupo}>
                            <legend className={styles.leyendaSubgrupo}>Segundo programa</legend>
                            <div className={styles.campos}>
                                <CamposPrograma orden={2} borrador={borrador} cambiar={cambiar} errores={errores} opciones={opciones} />
                            </div>
                        </fieldset>
                    </Condicional>
                )}
            </div>
        </Seccion>
    );
}

/** Modalidad, programa y (solo pregrado) opción de grado de un programa. */
function CamposPrograma({ orden, borrador, cambiar, errores, opciones }: PropsSeccion & { orden: Orden }) {
    const solicitud = borrador.programas[orden - 1];
    const idModalidad = idCampoPrograma("modalidad", orden);
    const idPrograma = idCampoPrograma("programa", orden);
    const idOpcionGrado = idCampoPrograma("tipoOpcionGrado", orden);

    return (
        <>
            <Opciones
                id={idModalidad}
                className={styles.ancho}
                leyenda="Modalidad"
                nombre={`modalidad-${orden}`}
                obligatorio
                opciones={MODALIDADES}
                valor={solicitud.modalidad}
                alCambiar={(valor) => cambiar(cambioPrograma(orden, "modalidad", valor as Modalidad))}
                error={errores[idModalidad]}
            />
            <Field
                id={idPrograma}
                className={borrador.nivel === "POSGRADO" ? styles.ancho : undefined}
                etiqueta="Programa"
                obligatorio
                opciones={conValorActual(opciones.PROGRAMA, solicitud.programa)}
                value={solicitud.programa}
                onChange={(evento: ChangeEvent<HTMLSelectElement>) =>
                    cambiar(cambioPrograma(orden, "programa", evento.target.value))
                }
                error={errores[idPrograma]}
            />
            {borrador.nivel === "PREGRADO" && (
                <Field
                    id={idOpcionGrado}
                    etiqueta="Opción de grado"
                    opciones={conValorActual(opciones.OPCION_GRADO, solicitud.tipoOpcionGrado)}
                    value={solicitud.tipoOpcionGrado}
                    onChange={(evento: ChangeEvent<HTMLSelectElement>) =>
                        cambiar(cambioPrograma(orden, "tipoOpcionGrado", evento.target.value))
                    }
                    error={errores[idOpcionGrado]}
                />
            )}
        </>
    );
}
