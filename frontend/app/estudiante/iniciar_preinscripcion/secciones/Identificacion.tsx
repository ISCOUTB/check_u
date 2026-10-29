"use client";

import { useState, type ChangeEvent } from "react";
import Field from "@/app/components/ui/Field";
import { conValorActual } from "../opciones";
import { ID_CAMPOS, limpiarNumeroDocumento } from "../validacion";
import styles from "../iniciar_preinscripcion.module.css";
import { cambioPerfil, Seccion, type PropsSeccion } from "./comun";

const REGLA_NUMERO = "Solo letras y números, sin puntos ni espacios";

export default function Identificacion({ borrador, cambiar, errores, opciones }: PropsSeccion) {
    // Los caracteres no permitidos se quitan al escribir y al pegar. Si se quitó alguno, la regla
    // se muestra como error (debajo del campo, sin moverlo) hasta salir del campo, y se anuncia en
    // una región viva oculta (WCAG 4.1.3): el error solo enlazado no se lee hasta volver al campo.
    const [seQuitaron, setSeQuitaron] = useState(false);
    const { perfil } = borrador;

    return (
        <Seccion id="identificacion" descripcion="Escríbelos tal como aparecen en tu documento de identidad.">
            <div className={styles.campos}>
                <Field
                    id={ID_CAMPOS.nombres}
                    etiqueta="Nombres"
                    obligatorio
                    autoComplete="given-name"
                    value={borrador.nombres}
                    onChange={(evento) => {
                        const nombres = evento.target.value;
                        cambiar((b) => ({ ...b, nombres }));
                    }}
                    error={errores[ID_CAMPOS.nombres]}
                />
                <Field
                    id={ID_CAMPOS.apellidos}
                    etiqueta="Apellidos"
                    obligatorio
                    autoComplete="family-name"
                    value={borrador.apellidos}
                    onChange={(evento) => {
                        const apellidos = evento.target.value;
                        cambiar((b) => ({ ...b, apellidos }));
                    }}
                    error={errores[ID_CAMPOS.apellidos]}
                />
                <Field
                    id={ID_CAMPOS.tipoDocumento}
                    etiqueta="Tipo de documento"
                    obligatorio
                    opciones={conValorActual(opciones.TIPO_DOCUMENTO, perfil.tipoDocumento)}
                    value={perfil.tipoDocumento}
                    onChange={(evento: ChangeEvent<HTMLSelectElement>) =>
                        cambiar(cambioPerfil("tipoDocumento", evento.target.value))
                    }
                    error={errores[ID_CAMPOS.tipoDocumento]}
                />
                <Field
                    id={ID_CAMPOS.numeroDocumento}
                    etiqueta="Número de documento"
                    obligatorio
                    autoComplete="off"
                    spellCheck={false}
                    value={perfil.numeroDocumento}
                    onChange={(evento) => {
                        const escrito = evento.target.value;
                        const limpio = limpiarNumeroDocumento(escrito);
                        if (limpio !== escrito) setSeQuitaron(true);
                        cambiar(cambioPerfil("numeroDocumento", limpio));
                    }}
                    onBlur={() => setSeQuitaron(false)}
                    error={errores[ID_CAMPOS.numeroDocumento] ?? (seQuitaron ? REGLA_NUMERO : undefined)}
                />
                <Field
                    id={ID_CAMPOS.fechaNacimiento}
                    etiqueta="Fecha de nacimiento"
                    type="date"
                    autoComplete="bday"
                    value={perfil.fechaNacimiento}
                    onChange={(evento) => cambiar(cambioPerfil("fechaNacimiento", evento.target.value))}
                    error={errores[ID_CAMPOS.fechaNacimiento]}
                />
                <Field
                    id={ID_CAMPOS.genero}
                    etiqueta="Género"
                    opciones={conValorActual(opciones.GENERO, perfil.genero)}
                    autoComplete="sex"
                    value={perfil.genero}
                    onChange={(evento: ChangeEvent<HTMLSelectElement>) =>
                        cambiar(cambioPerfil("genero", evento.target.value))
                    }
                    error={errores[ID_CAMPOS.genero]}
                />
            </div>
            {/* Siempre montada, para que el lector anuncie el cambio. Sin role: no choca con role="status". */}
            <span className="solo-lector" aria-live="polite">
                {seQuitaron ? REGLA_NUMERO : ""}
            </span>
        </Seccion>
    );
}
