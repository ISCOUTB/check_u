"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Navbar from "@/app/components/navbar/Navbar";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { useSesion } from "@/app/lib/useSesion";
import {
  importarEstudiantes,
  registrarEstudiante,
  MAXIMO_BYTES_CSV,
  type DatosEstudiante,
  type EstudianteRegistrado,
  type ResultadoImportacion,
} from "./api";
import styles from "./registro.module.css";

const VACIO: DatosEstudiante = {
  nombres: "",
  apellidos: "",
  codigo_estudiantil: "",
  correo: "",
  rol: "ESTUDIANTE",
};

export default function RegistrarEstudiantes() {
  const { usuario, cargando } = useSesion("funcionario");
  const [datos, setDatos] = useState<DatosEstudiante>(VACIO);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState<"individual" | "csv" | null>(null);
  const ocupadoRef = useRef(false);
  const [errorIndividual, setErrorIndividual] = useState("");
  const [errorCsv, setErrorCsv] = useState("");
  const [registrado, setRegistrado] = useState<EstudianteRegistrado | null>(
    null,
  );
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const entradaArchivo = useRef<HTMLInputElement>(null);
  const resultadoRef = useRef<HTMLHeadingElement>(null);

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado("individual");
    setErrorIndividual("");
    setRegistrado(null);
    try {
      const estudiante = await registrarEstudiante({
        ...datos,
        correo: datos.correo.trim().toLowerCase(),
      });
      setRegistrado(estudiante);
      setDatos(VACIO);
    } catch (error) {
      setErrorIndividual(
        error instanceof Error
          ? error.message
          : "No fue posible registrar al estudiante.",
      );
    } finally {
      ocupadoRef.current = false;
      setOcupado(null);
    }
  }

  function seleccionarArchivo(evento: ChangeEvent<HTMLInputElement>) {
    setErrorCsv("");
    setResultado(null);
    const seleccionado = evento.target.files?.[0] ?? null;
    if (
      seleccionado &&
      (!seleccionado.name.toLowerCase().endsWith(".csv") ||
        seleccionado.size > MAXIMO_BYTES_CSV)
    ) {
      setErrorCsv(
        "Selecciona un archivo .csv de máximo 64 KiB, guardado en UTF-8.",
      );
      setArchivo(null);
      evento.target.value = "";
      return;
    }
    setArchivo(seleccionado);
  }

  async function importar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupadoRef.current) return;
    if (!archivo) {
      setErrorCsv("Selecciona el archivo CSV que deseas importar.");
      return;
    }
    ocupadoRef.current = true;
    setOcupado("csv");
    setErrorCsv("");
    setResultado(null);
    try {
      setResultado(await importarEstudiantes(archivo));
      setArchivo(null);
      if (entradaArchivo.current) entradaArchivo.current.value = "";
      requestAnimationFrame(() => resultadoRef.current?.focus());
    } catch (error) {
      setErrorCsv(
        error instanceof Error
          ? error.message
          : "No fue posible importar los estudiantes.",
      );
    } finally {
      ocupadoRef.current = false;
      setOcupado(null);
    }
  }

  if (cargando || !usuario)
    return (
      <main id="contenido" className={styles.cargando} aria-busy="true">
        <p role="status">Comprobando sesión...</p>
      </main>
    );

  return (
    <>
      <Navbar tipoUsuario="funcionario" nombreUsuario={usuario.name} />
      <main id="contenido" tabIndex={-1} className={styles.pagina}>
        <PageHeader
          titulo="Registrar estudiantes"
          descripcion="Registra estudiantes individualmente o importa un archivo CSV. Cada estudiante requiere su correo electrónico; el código estudiantil es opcional."
          ruta={[
            { texto: "Inicio", href: "/funcionario/dashboard" },
            { texto: "Registrar estudiantes" },
          ]}
        />
        <div className={styles.rejilla}>
          <Card titulo="Registro individual">
            <form
              aria-label="Registro individual de estudiantes"
              onSubmit={registrar}
              className={styles.formulario}
            >
              <label className={styles.campo}>
                Nombres
                <input
                  required
                  maxLength={100}
                  autoComplete="given-name"
                  value={datos.nombres}
                  disabled={Boolean(ocupado)}
                  onChange={(evento) =>
                    setDatos({ ...datos, nombres: evento.target.value })
                  }
                />
              </label>
              <label className={styles.campo}>
                Apellidos
                <input
                  required
                  maxLength={100}
                  autoComplete="family-name"
                  value={datos.apellidos}
                  disabled={Boolean(ocupado)}
                  onChange={(evento) =>
                    setDatos({ ...datos, apellidos: evento.target.value })
                  }
                />
              </label>
              <label className={styles.campo}>
                Código estudiantil
                <input
                  maxLength={50}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  pattern="[A-Za-z0-9_\-]+"
                  aria-describedby="ayuda-codigo"
                  value={datos.codigo_estudiantil}
                  disabled={Boolean(ocupado)}
                  onChange={(evento) =>
                    setDatos({
                      ...datos,
                      codigo_estudiantil: evento.target.value,
                    })
                  }
                />
              </label>
              <p id="ayuda-codigo" className={styles.ayuda}>
                Opcional. Hasta 50 letras o números. También admite guion y guion bajo.
                Los códigos se guardan en mayúsculas.
              </p>
              <label className={styles.campo}>
                Correo electrónico
                <input
                  required
                  type="email"
                  maxLength={150}
                  autoComplete="email"
                  spellCheck={false}
                  aria-describedby="ayuda-correo"
                  value={datos.correo}
                  disabled={Boolean(ocupado)}
                  onChange={(evento) =>
                    setDatos({ ...datos, correo: evento.target.value })
                  }
                />
              </label>
              <p id="ayuda-correo" className={styles.ayuda}>
                Obligatorio. Se guarda en minúsculas y sin espacios externos.
              </p>
              <label className={styles.campo}>
                Rol
                <input readOnly value="Estudiante" />
              </label>
              <Button
                type="submit"
                disabled={Boolean(ocupado)}
                cargando={ocupado === "individual"}
                textoCargando="Registrando estudiante..."
              >
                Registrar estudiante
              </Button>
              {errorIndividual && (
                <p role="alert" className={styles.error}>
                  {errorIndividual}
                </p>
              )}
              {registrado && (
                <p role="status" className={styles.aviso}>
                  Estudiante registrado correctamente. {registrado.nombres}{" "}
                  {registrado.apellidos}
                  {registrado.codigo_estudiantil
                    ? ` · Código ${registrado.codigo_estudiantil}`
                    : " · Sin código estudiantil"}
                  {` · Correo ${registrado.correo}`} · Rol Estudiante.
                </p>
              )}
            </form>
          </Card>
          <Card titulo="Importación de estudiantes por CSV">
            <p className={styles.ayuda}>
              Guarda el archivo en UTF-8 y separa las columnas con punto y coma (;).
              Admite hasta 1000 estudiantes y 64 KiB por archivo.
            </p>
            <p className={styles.estructura}>
              nombres;apellidos;codigo_estudiantil;correo;rol
            </p>
            <div className={styles.infoCsv}>
              <p className={styles.ayuda}>
                <strong>Estructura requerida:</strong>
              </p>
              <ul className={styles.listaAyuda}>
                <li>
                  <strong>nombres y apellidos:</strong> obligatorios (hasta 100 caracteres).
                </li>
                <li>
                  <strong>codigo_estudiantil:</strong> opcional (hasta 50 caracteres alfanuméricos, guiones o guiones bajos). Si se ingresa, se guarda en mayúsculas y debe ser único. Puede dejarse la columna vacía (por ejemplo: <code>;;</code>).
                </li>
                <li>
                  <strong>correo:</strong> obligatorio (hasta 150 caracteres). Debe tener un formato válido y ser único en el sistema; se guarda en minúsculas.
                </li>
                <li>
                  <strong>rol:</strong> obligatorio, su valor debe ser <code>ESTUDIANTE</code>.
                </li>
              </ul>
              <p className={styles.ayuda}>
                El resultado de la importación indicará el detalle de estudiantes registrados y el motivo de las filas rechazadas.
              </p>
            </div>
            <a
              className={styles.enlace}
              href="/plantillas/estudiantes.csv"
              download
            >
              Descargar plantilla CSV
            </a>
            <form
              aria-label="Importación de estudiantes"
              onSubmit={importar}
              className={styles.formulario}
            >
              <label className={styles.campo}>
                Archivo CSV
                <input
                  ref={entradaArchivo}
                  type="file"
                  accept=".csv,text/csv"
                  disabled={Boolean(ocupado)}
                  onChange={seleccionarArchivo}
                  aria-describedby="archivo-seleccionado"
                />
              </label>
              <div
                id="archivo-seleccionado"
                className={archivo ? styles.archivoInfoActivo : styles.ayuda}
              >
                {archivo ? (
                  <>
                    <span className={styles.archivoNombre}>
                      Archivo seleccionado: {archivo.name}
                    </span>
                    <span className={styles.archivoTamano}>
                      ({(archivo.size / 1024).toFixed(1)} KiB)
                    </span>
                  </>
                ) : (
                  "Selecciona un archivo para importar."
                )}
              </div>
              <Button
                type="submit"
                disabled={Boolean(ocupado)}
                cargando={ocupado === "csv"}
                textoCargando="Importando estudiantes..."
              >
                Importar estudiantes
              </Button>
              {errorCsv && (
                <p role="alert" className={styles.error}>
                  {errorCsv}
                </p>
              )}
            </form>
          </Card>
        </div>
        {resultado && (
          <section
            className={styles.resultados}
            aria-labelledby="titulo-resultados"
          >
            <h2 id="titulo-resultados" ref={resultadoRef} tabIndex={-1}>
              Resultado de la importación
            </h2>
            <p role="status">
              {resultado.total} registros procesados. {resultado.registrados}{" "}
              registrados y {resultado.errores} con errores.
            </p>
            <div
              className={styles.tabla}
              role="region"
              aria-label="Resultados por fila"
              tabIndex={0}
            >
              <table>
                <caption>
                  Estudiantes registrados y filas que requieren corrección
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Línea</th>
                    <th scope="col">Estudiante</th>
                    <th scope="col">Código estudiantil</th>
                    <th scope="col">Correo electrónico</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.filas.map((fila) => (
                    <tr key={fila.linea}>
                      <td>{fila.linea}</td>
                      <td>
                        {[fila.nombres, fila.apellidos]
                          .filter(Boolean)
                          .join(" ") || "Sin nombre"}
                      </td>
                      <td>{fila.codigo_estudiantil || "Sin código"}</td>
                      <td>{fila.correo || "Sin correo"}</td>
                      <td>
                        {fila.estado === "registrado" ? "Registrado" : "Error"}
                      </td>
                      <td>{fila.mensaje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
