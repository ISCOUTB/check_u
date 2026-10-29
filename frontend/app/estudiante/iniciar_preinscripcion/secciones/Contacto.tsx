"use client";

import type { ChangeEvent } from "react";
import AreaTexto from "@/app/components/ui/AreaTexto";
import Field from "@/app/components/ui/Field";
import Opciones from "@/app/components/ui/Opciones";
import { conValorActual } from "../opciones";
import { ID_CAMPOS } from "../validacion";
import styles from "../iniciar_preinscripcion.module.css";
import {
    aSiNo,
    cambioPerfil,
    Condicional,
    deSiNo,
    OPCIONES_SI_NO,
    Seccion,
    type PropsSeccion,
} from "./comun";

// TODO: departamento y ciudad son texto libre hasta que existan las listas oficiales (en la #40
// también son texto).
export default function Contacto({ borrador, cambiar, errores, opciones }: PropsSeccion) {
    const { perfil } = borrador;

    /** Al responder "No" (o dejar sin responder) se descartan los datos dependientes. */
    const cambiarDiscapacidad = (valor: string) => {
        const tieneDiscapacidad = deSiNo(valor);
        if (tieneDiscapacidad === true) {
            cambiar(cambioPerfil("tieneDiscapacidad", true));
            return;
        }
        cambiar((b) => ({
            ...b,
            perfil: {
                ...b.perfil,
                tieneDiscapacidad,
                tipoDiscapacidad: "",
                detallesAsistencia: "",
            },
        }));
    };

    return (
        <Seccion id="contacto">
            <div className={styles.campos}>
                <Field
                    id={ID_CAMPOS.correo}
                    className={styles.ancho}
                    etiqueta="Correo institucional"
                    ayuda="Viene de tu cuenta institucional; no se puede cambiar"
                    type="email"
                    autoComplete="email"
                    readOnly
                    value={borrador.correo}
                />
                <Field
                    id={ID_CAMPOS.celular}
                    etiqueta="Celular"
                    type="tel"
                    autoComplete="tel"
                    value={perfil.celular}
                    onChange={(evento) => cambiar(cambioPerfil("celular", evento.target.value))}
                    error={errores[ID_CAMPOS.celular]}
                />
                <Field
                    id={ID_CAMPOS.telefonoFijo}
                    etiqueta="Teléfono fijo"
                    type="tel"
                    autoComplete="tel"
                    value={perfil.telefonoFijo}
                    onChange={(evento) => cambiar(cambioPerfil("telefonoFijo", evento.target.value))}
                    error={errores[ID_CAMPOS.telefonoFijo]}
                />
                <Field
                    id={ID_CAMPOS.departamento}
                    etiqueta="Departamento"
                    autoComplete="address-level1"
                    value={perfil.departamento}
                    onChange={(evento) => cambiar(cambioPerfil("departamento", evento.target.value))}
                    error={errores[ID_CAMPOS.departamento]}
                />
                <Field
                    id={ID_CAMPOS.ciudad}
                    etiqueta="Ciudad o municipio"
                    autoComplete="address-level2"
                    value={perfil.ciudad}
                    onChange={(evento) => cambiar(cambioPerfil("ciudad", evento.target.value))}
                    error={errores[ID_CAMPOS.ciudad]}
                />
                <Field
                    id={ID_CAMPOS.direccion}
                    className={styles.ancho}
                    etiqueta="Dirección"
                    autoComplete="street-address"
                    value={perfil.direccion}
                    onChange={(evento) => cambiar(cambioPerfil("direccion", evento.target.value))}
                    error={errores[ID_CAMPOS.direccion]}
                />

                <hr className={`${styles.ancho} ${styles.divisor}`} />

                <h3 className={`${styles.ancho} ${styles.subtitulo}`}>
                    Discapacidad y asistencia a la ceremonia
                </h3>
                <p className={`${styles.ancho} ${styles.descripcionSeccion}`}>
                    Ayúdanos a preparar los apoyos necesarios para tu graduación presencial.
                </p>

                <Opciones
                    id={ID_CAMPOS.tieneDiscapacidad}
                    className={styles.ancho}
                    leyenda="¿Posee alguna discapacidad?"
                    nombre="tiene-discapacidad"
                    opciones={OPCIONES_SI_NO}
                    valor={aSiNo(perfil.tieneDiscapacidad)}
                    alCambiar={cambiarDiscapacidad}
                    error={errores[ID_CAMPOS.tieneDiscapacidad]}
                />

                {perfil.tieneDiscapacidad === true && (
                    <Condicional className={`${styles.ancho} ${styles.campos}`}>
                        <Field
                            id={ID_CAMPOS.tipoDiscapacidad}
                            etiqueta="Tipo de discapacidad"
                            obligatorio
                            opciones={conValorActual(opciones.TIPO_DISCAPACIDAD, perfil.tipoDiscapacidad)}
                            value={perfil.tipoDiscapacidad}
                            onChange={(evento: ChangeEvent<HTMLSelectElement>) =>
                                cambiar(cambioPerfil("tipoDiscapacidad", evento.target.value))
                            }
                            error={errores[ID_CAMPOS.tipoDiscapacidad]}
                        />
                        <AreaTexto
                            id={ID_CAMPOS.detallesAsistencia}
                            className={styles.ancho}
                            etiqueta="Detalles y necesidades de asistencia"
                            ayuda="Describe las condiciones, adaptaciones o apoyos que deban considerarse. Si elegiste «Otra», especifica cuál."
                            rows={4}
                            maxLength={1000}
                            value={perfil.detallesAsistencia}
                            onChange={(evento) =>
                                cambiar(cambioPerfil("detallesAsistencia", evento.target.value))
                            }
                            error={errores[ID_CAMPOS.detallesAsistencia]}
                        />
                    </Condicional>
                )}
            </div>
        </Seccion>
    );
}
