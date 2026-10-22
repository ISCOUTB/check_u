"use client";

import Field from "@/app/components/ui/Field";
import Opciones from "@/app/components/ui/Opciones";
import { MODALIDADES, OPCIONES_GRADO } from "../constantes";
import type { Modalidad } from "../tipos";
import { ID_CAMPOS, idCampoPrograma, type Orden } from "../validacion";
import styles from "../iniciar_preinscripcion.module.css";
import { aSiNo, cambioPrograma, Condicional, deSiNo, OPCIONES_SI_NO, Seccion, type PropsSeccion } from "./comun";

export default function Academico({ borrador, cambiar, errores }: PropsSeccion) {
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

                <CamposPrograma orden={1} borrador={borrador} cambiar={cambiar} errores={errores} />

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
                                <CamposPrograma orden={2} borrador={borrador} cambiar={cambiar} errores={errores} />
                            </div>
                        </fieldset>
                    </Condicional>
                )}
            </div>
        </Seccion>
    );
}

/** Modalidad, programa y (solo pregrado) opción de grado de un programa. */
function CamposPrograma({ orden, borrador, cambiar, errores }: PropsSeccion & { orden: Orden }) {
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
            {/* TODO: texto libre hasta que exista la lista oficial de programas. */}
            <Field
                id={idPrograma}
                className={borrador.nivel === "POSGRADO" ? styles.ancho : undefined}
                etiqueta="Programa"
                obligatorio
                value={solicitud.programa}
                onChange={(evento) => cambiar(cambioPrograma(orden, "programa", evento.target.value))}
                error={errores[idPrograma]}
            />
            {borrador.nivel === "PREGRADO" && (
                <Field
                    id={idOpcionGrado}
                    etiqueta="Opción de grado"
                    opciones={OPCIONES_GRADO}
                    value={solicitud.tipoOpcionGrado}
                    onChange={(evento) => cambiar(cambioPrograma(orden, "tipoOpcionGrado", evento.target.value))}
                    error={errores[idOpcionGrado]}
                />
            )}
        </>
    );
}
