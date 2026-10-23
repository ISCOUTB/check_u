"use client";

import Field from "@/app/components/ui/Field";
import Opciones from "@/app/components/ui/Opciones";
import { TIPOS_CONTRATO } from "../constantes";
import { ID_CAMPOS } from "../validacion";
import styles from "../iniciar_preinscripcion.module.css";
import { aSiNo, cambioPregrado, Condicional, deSiNo, OPCIONES_SI_NO, Seccion, type PropsSeccion } from "./comun";

/** Solo pregrado. Todo es opcional: si no tienes los datos a mano, puedes seguir después. */
export default function SaberProVinculacion({ borrador, cambiar, errores }: PropsSeccion) {
    const { pregrado } = borrador;

    return (
        <Seccion id="saber_pro">
            <div className={styles.campos}>
                <Opciones
                    id={ID_CAMPOS.conoceRegistroSaberPro}
                    className={styles.ancho}
                    leyenda="¿Conoces tu número de registro?"
                    nombre="conoce-registro-saber-pro"
                    opciones={OPCIONES_SI_NO}
                    valor={aSiNo(pregrado.conoceRegistroSaberPro)}
                    alCambiar={(valor) => cambiar(cambioPregrado("conoceRegistroSaberPro", deSiNo(valor)))}
                    error={errores[ID_CAMPOS.conoceRegistroSaberPro]}
                />
                {pregrado.conoceRegistroSaberPro === true && (
                    <Condicional className={`${styles.ancho} ${styles.campos} ${styles.alineadosAbajo}`}>
                        <Field
                            id={ID_CAMPOS.numeroRegistroSaberPro}
                            etiqueta="Número de registro"
                            ayuda="Ejemplo: EK202012345678"
                            autoComplete="off"
                            spellCheck={false}
                            value={pregrado.numeroRegistroSaberPro}
                            onChange={(evento) =>
                                cambiar(cambioPregrado("numeroRegistroSaberPro", evento.target.value))
                            }
                            error={errores[ID_CAMPOS.numeroRegistroSaberPro]}
                        />
                        <Field
                            id={ID_CAMPOS.fechaExamenSaberPro}
                            etiqueta="Fecha del examen"
                            type="date"
                            value={pregrado.fechaExamenSaberPro}
                            onChange={(evento) => cambiar(cambioPregrado("fechaExamenSaberPro", evento.target.value))}
                            error={errores[ID_CAMPOS.fechaExamenSaberPro]}
                        />
                    </Condicional>
                )}

                <hr className={`${styles.ancho} ${styles.divisor}`} />

                <Opciones
                    id={ID_CAMPOS.esEmpleadoUtb}
                    className={styles.ancho}
                    leyenda="¿Eres empleado de la UTB?"
                    nombre="es-empleado-utb"
                    opciones={OPCIONES_SI_NO}
                    valor={aSiNo(pregrado.esEmpleadoUtb)}
                    alCambiar={(valor) => cambiar(cambioPregrado("esEmpleadoUtb", deSiNo(valor)))}
                    error={errores[ID_CAMPOS.esEmpleadoUtb]}
                />
                {pregrado.esEmpleadoUtb === true && (
                    <Condicional className={`${styles.ancho} ${styles.campos}`}>
                        <Field
                            id={ID_CAMPOS.tipoContrato}
                            etiqueta="Tipo de contrato"
                            opciones={TIPOS_CONTRATO}
                            value={pregrado.tipoContrato}
                            onChange={(evento) => cambiar(cambioPregrado("tipoContrato", evento.target.value))}
                            error={errores[ID_CAMPOS.tipoContrato]}
                        />
                    </Condicional>
                )}

                <Opciones
                    id={ID_CAMPOS.esHijoDeEmpleadoUtb}
                    className={styles.ancho}
                    leyenda="¿Eres hijo o hija de un empleado de la UTB?"
                    nombre="es-hijo-de-empleado-utb"
                    opciones={OPCIONES_SI_NO}
                    valor={aSiNo(pregrado.esHijoDeEmpleadoUtb)}
                    alCambiar={(valor) => cambiar(cambioPregrado("esHijoDeEmpleadoUtb", deSiNo(valor)))}
                    error={errores[ID_CAMPOS.esHijoDeEmpleadoUtb]}
                />
            </div>
        </Seccion>
    );
}
