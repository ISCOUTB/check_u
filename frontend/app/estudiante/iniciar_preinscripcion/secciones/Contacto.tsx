"use client";

import Field from "@/app/components/ui/Field";
import { ID_CAMPOS } from "../validacion";
import styles from "../iniciar_preinscripcion.module.css";
import { cambioPerfil, Seccion, type PropsSeccion } from "./comun";

// TODO: departamento y ciudad son texto libre hasta que existan las listas oficiales (en la #40
// también son texto).
export default function Contacto({ borrador, cambiar, errores }: PropsSeccion) {
    const { perfil } = borrador;

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
            </div>
        </Seccion>
    );
}
