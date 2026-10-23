"use client";

import Field from "@/app/components/ui/Field";
import Opciones from "@/app/components/ui/Opciones";
import { NIVELES_ESTUDIO } from "../constantes";
import { ID_CAMPOS, idCampoExperiencia, type Orden } from "../validacion";
import styles from "../iniciar_preinscripcion.module.css";
import { aSiNo, cambioExperiencia, cambioPosgrado, deSiNo, OPCIONES_SI_NO, Seccion, type PropsSeccion } from "./comun";

const CARGOS: { orden: Orden; titulo: string }[] = [
    { orden: 1, titulo: "Cargo más reciente" },
    { orden: 2, titulo: "Cargo anterior" },
];

/** Solo posgrado. Todo es opcional. */
export default function EstudiosExperiencia({ borrador, cambiar, errores }: PropsSeccion) {
    const { posgrado } = borrador;

    return (
        <Seccion id="estudios">
            <div className={styles.campos}>
                <Field
                    id={ID_CAMPOS.nivelEstudios}
                    etiqueta="Nivel de estudios alcanzado"
                    opciones={NIVELES_ESTUDIO}
                    value={posgrado.nivelEstudios}
                    onChange={(evento) => cambiar(cambioPosgrado("nivelEstudios", evento.target.value))}
                    error={errores[ID_CAMPOS.nivelEstudios]}
                />
                <Field
                    id={ID_CAMPOS.tituloObtenido}
                    etiqueta="Título obtenido"
                    value={posgrado.tituloObtenido}
                    onChange={(evento) => cambiar(cambioPosgrado("tituloObtenido", evento.target.value))}
                    error={errores[ID_CAMPOS.tituloObtenido]}
                />
                <Opciones
                    id={ID_CAMPOS.esEgresadoPregradoUtb}
                    className={styles.ancho}
                    leyenda="¿Eres egresado o egresada de un pregrado de la UTB?"
                    nombre="es-egresado-pregrado-utb"
                    opciones={OPCIONES_SI_NO}
                    valor={aSiNo(posgrado.esEgresadoPregradoUtb)}
                    alCambiar={(valor) => cambiar(cambioPosgrado("esEgresadoPregradoUtb", deSiNo(valor)))}
                    error={errores[ID_CAMPOS.esEgresadoPregradoUtb]}
                />
            </div>

            <div className={styles.bloque}>
                <h3 className={styles.subtitulo}>Experiencia laboral</h3>
                <p className={styles.descripcionSeccion}>Tus dos últimos cargos, del más reciente al más antiguo.</p>
                {CARGOS.map(({ orden, titulo }) => {
                    const cargo = borrador.experiencia[orden - 1];
                    const ids = {
                        empresa: idCampoExperiencia("empresa", orden),
                        cargo: idCampoExperiencia("cargo", orden),
                        tiempo: idCampoExperiencia("tiempo", orden),
                    };
                    return (
                        <fieldset key={orden} className={`${styles.subgrupo} ${styles.cargo}`}>
                            <legend className={styles.leyendaSubgrupo}>{titulo}</legend>
                            <div className={styles.campos}>
                                <Field
                                    id={ids.empresa}
                                    etiqueta="Empresa"
                                    autoComplete="off"
                                    value={cargo.empresa}
                                    onChange={(evento) =>
                                        cambiar(cambioExperiencia(orden, "empresa", evento.target.value))
                                    }
                                    error={errores[ids.empresa]}
                                />
                                <Field
                                    id={ids.cargo}
                                    etiqueta="Cargo"
                                    autoComplete="off"
                                    value={cargo.cargo}
                                    onChange={(evento) =>
                                        cambiar(cambioExperiencia(orden, "cargo", evento.target.value))
                                    }
                                    error={errores[ids.cargo]}
                                />
                                <Field
                                    id={ids.tiempo}
                                    etiqueta="Tiempo en el cargo"
                                    ayuda="Ejemplo: 2 años"
                                    autoComplete="off"
                                    value={cargo.tiempo}
                                    onChange={(evento) =>
                                        cambiar(cambioExperiencia(orden, "tiempo", evento.target.value))
                                    }
                                    error={errores[ids.tiempo]}
                                />
                            </div>
                        </fieldset>
                    );
                })}
            </div>
        </Seccion>
    );
}
