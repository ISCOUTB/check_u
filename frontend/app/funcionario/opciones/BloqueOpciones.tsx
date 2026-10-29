"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Icono, { type NombreIcono } from "@/app/components/ui/Icono";
import type { CampoAdmin, OpcionAdmin, ResultadoImportacion } from "./api";
import styles from "./opciones.module.css";

interface Props {
    campo: CampoAdmin;
    titulo: string;
    descripcion: string;
    icono: NombreIcono;
    opciones: OpcionAdmin[];
    ocupado: boolean;
    alCrear: (etiqueta: string) => Promise<void>;
    alEliminar: (opcion: OpcionAdmin) => void;
    alMover: (opcion: OpcionAdmin, direccion: -1 | 1) => Promise<void>;
    alImportar: (texto: string) => Promise<ResultadoImportacion>;
}

/** Un bloque independiente por campo: crear, ordenar, eliminar e importar sus opciones. */
export default function BloqueOpciones({
    titulo,
    descripcion,
    icono,
    opciones,
    ocupado,
    alCrear,
    alEliminar,
    alMover,
    alImportar,
}: Props) {
    const idBase = useId();
    const idNueva = `${idBase}-nueva`;
    const idAyuda = `${idBase}-ayuda`;
    const archivoRef = useRef<HTMLInputElement>(null);

    const [etiqueta, setEtiqueta] = useState("");
    const [agregando, setAgregando] = useState(false);
    const [importando, setImportando] = useState(false);
    const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
    const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

    const ocupadoBloque = ocupado || agregando || importando;

    const agregar = async (evento: FormEvent<HTMLFormElement>) => {
        evento.preventDefault();
        const nombre = etiqueta.trim();
        if (!nombre) {
            setMensaje({ tipo: "error", texto: "Escribe el nombre de la opción." });
            return;
        }
        setAgregando(true);
        setMensaje(null);
        setResultado(null);
        try {
            await alCrear(nombre);
            setEtiqueta("");
            setMensaje({ tipo: "ok", texto: `Se agregó «${nombre}».` });
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error instanceof Error ? error.message : "No fue posible agregar la opción.",
            });
        } finally {
            setAgregando(false);
        }
    };

    const mover = async (opcion: OpcionAdmin, direccion: -1 | 1) => {
        setMensaje(null);
        setResultado(null);
        try {
            await alMover(opcion, direccion);
            setMensaje({ tipo: "ok", texto: "Se actualizó el orden de las opciones." });
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error instanceof Error ? error.message : "No fue posible cambiar el orden.",
            });
        }
    };

    const importar = async (archivo: File | undefined) => {
        if (!archivo) return;
        if (!archivo.name.toLowerCase().endsWith(".csv")) {
            setMensaje({ tipo: "error", texto: "Selecciona un archivo con extensión .csv." });
            return;
        }
        if (archivo.size > 1_000_000) {
            setMensaje({ tipo: "error", texto: "El archivo CSV no puede superar 1 MB." });
            return;
        }
        setImportando(true);
        setMensaje(null);
        setResultado(null);
        try {
            const texto = await archivo.text();
            const resumen = await alImportar(texto);
            setResultado(resumen);
            setMensaje(
                resumen.creadas > 0
                    ? { tipo: "ok", texto: `Se importaron ${resumen.creadas} opciones.` }
                    : { tipo: "error", texto: "No se importó ninguna opción nueva." },
            );
        } catch (error) {
            setMensaje({
                tipo: "error",
                texto: error instanceof Error ? error.message : "No fue posible importar el archivo.",
            });
        } finally {
            setImportando(false);
            if (archivoRef.current) archivoRef.current.value = "";
        }
    };

    return (
        <Card
            className={styles.bloque}
            titulo={titulo}
            nivelTitulo={2}
            acciones={
                <span className={styles.insignia}>
                    <Icono nombre={icono} tamano={18} />
                    <span aria-hidden="true">{opciones.length}</span>
                    <span className="solo-lector">
                        {opciones.length === 1 ? "1 opción" : `${opciones.length} opciones`}
                    </span>
                </span>
            }
        >
            <p className={styles.descripcion}>{descripcion}</p>

            <form className={styles.formulario} onSubmit={agregar}>
                <label htmlFor={idNueva} className={styles.etiquetaCampo}>
                    Nueva opción
                </label>
                <div className={styles.filaAlta}>
                    <input
                        id={idNueva}
                        className={styles.control}
                        value={etiqueta}
                        maxLength={150}
                        placeholder="Ej. Cédula de ciudadanía"
                        onChange={(evento) => setEtiqueta(evento.target.value)}
                        aria-describedby={idAyuda}
                        disabled={ocupadoBloque}
                    />
                    <Button type="submit" cargando={agregando} textoCargando="Agregando…" disabled={ocupado}>
                        <Icono nombre="mas" tamano={18} />
                        Agregar
                    </Button>
                </div>
                <p id={idAyuda} className={styles.ayuda}>
                    El valor interno se genera automáticamente a partir del nombre.
                </p>
            </form>

            <div className={styles.importacion}>
                <input
                    ref={archivoRef}
                    type="file"
                    accept=".csv,text/csv"
                    className={styles.archivoOculto}
                    aria-hidden="true"
                    tabIndex={-1}
                    onChange={(evento) => void importar(evento.target.files?.[0])}
                />
                <Button
                    variante="secundario"
                    cargando={importando}
                    textoCargando="Importando…"
                    disabled={ocupado}
                    onClick={() => archivoRef.current?.click()}
                >
                    <Icono nombre="importar" tamano={18} />
                    Importar CSV
                </Button>
                <p className={styles.ayuda}>
                    Una opción por fila. Primera columna: nombre visible. Segunda columna opcional: valor interno.
                    Se aceptan archivos separados por coma o punto y coma.
                </p>
            </div>

            {opciones.length === 0 ? (
                <p className={styles.vacio}>Aún no hay opciones para este campo.</p>
            ) : (
                <ol className={styles.lista} aria-label={`Opciones de ${titulo}`}>
                    {opciones.map((opcion, indice) => (
                        <li key={opcion.id} className={styles.opcion}>
                            <span className={styles.numero} aria-hidden="true">
                                {indice + 1}
                            </span>
                            <span className={styles.datos}>
                                <span className={styles.nombre}>{opcion.etiqueta}</span>
                                <span className={styles.valor}>{opcion.valor}</span>
                            </span>
                            <span className={styles.acciones}>
                                <button
                                    type="button"
                                    className={styles.accion}
                                    onClick={() => void mover(opcion, -1)}
                                    disabled={ocupadoBloque || indice === 0}
                                    aria-label={`Subir ${opcion.etiqueta}`}
                                    title="Subir"
                                >
                                    <Icono nombre="arriba" tamano={18} />
                                </button>
                                <button
                                    type="button"
                                    className={styles.accion}
                                    onClick={() => void mover(opcion, 1)}
                                    disabled={ocupadoBloque || indice === opciones.length - 1}
                                    aria-label={`Bajar ${opcion.etiqueta}`}
                                    title="Bajar"
                                >
                                    <Icono nombre="abajo" tamano={18} />
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.accion} ${styles.accionEliminar}`}
                                    onClick={() => alEliminar(opcion)}
                                    disabled={ocupadoBloque}
                                    aria-label={`Eliminar ${opcion.etiqueta}`}
                                    title="Eliminar"
                                >
                                    <Icono nombre="basura" tamano={18} />
                                </button>
                            </span>
                        </li>
                    ))}
                </ol>
            )}

            {mensaje && (
                <p
                    className={mensaje.tipo === "ok" ? styles.mensajeOk : styles.mensajeError}
                    role={mensaje.tipo === "ok" ? "status" : "alert"}
                >
                    {mensaje.texto}
                </p>
            )}

            {resultado && (
                <div className={styles.detallesImportacion}>
                    <p>
                        {resultado.total === 1 ? "1 registro leído" : `${resultado.total} registros leídos`} ·{" "}
                        {resultado.creadas} {resultado.creadas === 1 ? "creada" : "creadas"}
                    </p>
                    {resultado.duplicados.length > 0 && (
                        <p>
                            <strong>Duplicadas:</strong>{" "}
                            {resultado.duplicados.map((d) => `«${d.valor}» (línea ${d.linea})`).join(", ")}
                        </p>
                    )}
                    {resultado.vacias.length > 0 && (
                        <p>
                            <strong>Vacías:</strong> línea{resultado.vacias.length === 1 ? "" : "s"}{" "}
                            {resultado.vacias.join(", ")}
                        </p>
                    )}
                    {resultado.invalidos.length > 0 && (
                        <p>
                            <strong>Inválidas:</strong>{" "}
                            {resultado.invalidos
                                .map((i) => `«${i.valor}» (línea ${i.linea}: ${i.motivo})`)
                                .join(", ")}
                        </p>
                    )}
                </div>
            )}
        </Card>
    );
}
