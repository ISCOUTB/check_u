export interface DatosEstudiante {
  nombres: string;
  apellidos: string;
  codigo_estudiantil: string;
  rol: "ESTUDIANTE";
}
export interface EstudianteRegistrado extends DatosEstudiante {
  id_usuario: number;
}
export interface ResultadoFila {
  linea: number;
  nombres: string;
  apellidos: string;
  codigo_estudiantil: string;
  estado: "registrado" | "error";
  mensaje: string;
}
export interface ResultadoImportacion {
  total: number;
  registrados: number;
  errores: number;
  filas: ResultadoFila[];
}
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";
export const MAXIMO_BYTES_CSV = 64 * 1024;

async function enviar(ruta: string, opciones: RequestInit): Promise<unknown> {
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 60000);
  try {
    const respuesta = await fetch(`${API_URL}/funcionario/estudiantes${ruta}`, {
      ...opciones,
      method: "POST",
      credentials: "include",
      cache: "no-store",
      signal: controlador.signal,
    });
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      if (respuesta.status === 401)
        throw new Error("Tu sesión venció. Inicia sesión nuevamente.");
      if (respuesta.status === 403)
        throw new Error("Solo la funcionaria puede registrar estudiantes.");
      const mensaje = Array.isArray(datos?.message)
        ? datos.message.join(" ")
        : datos?.message;
      throw new Error(
        typeof mensaje === "string"
          ? mensaje
          : "No fue posible completar el registro. Revisa los datos e intenta nuevamente.",
      );
    }
    return datos;
  } catch (error) {
    if (controlador.signal.aborted)
      throw new Error(
        "La operación tardó demasiado y no se pudo confirmar el resultado. Puedes reintentar. Los códigos ya registrados se informarán como duplicados.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "No fue posible conectar con el servidor. Revisa la conexión e intenta nuevamente.",
      );
    throw error;
  } finally {
    clearTimeout(limite);
  }
}
export async function registrarEstudiante(
  datos: DatosEstudiante,
): Promise<EstudianteRegistrado> {
  const respuesta = await enviar("", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  const estudiante = respuesta as EstudianteRegistrado | null;
  if (
    !estudiante ||
    !Number.isSafeInteger(estudiante.id_usuario) ||
    estudiante.id_usuario <= 0 ||
    estudiante.rol !== "ESTUDIANTE" ||
    !["nombres", "apellidos", "codigo_estudiantil"].every(
      (campo) => typeof estudiante[campo as keyof DatosEstudiante] === "string",
    )
  ) {
    throw new Error(
      "La respuesta del registro no es válida. Verifica el resultado antes de volver a enviarlo.",
    );
  }
  return estudiante;
}
export async function importarEstudiantes(
  archivo: File,
): Promise<ResultadoImportacion> {
  const formulario = new FormData();
  formulario.append("archivo", archivo);
  const datos = (await enviar("/importar", {
    body: formulario,
  })) as ResultadoImportacion | null;
  if (
    !datos ||
    ![datos.total, datos.registrados, datos.errores].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) ||
    !Array.isArray(datos.filas) ||
    datos.filas.length !== datos.total ||
    datos.registrados + datos.errores !== datos.total ||
    datos.filas.some(
      (fila) =>
        !fila ||
        !Number.isSafeInteger(fila.linea) ||
        fila.linea < 1 ||
        !["nombres", "apellidos", "codigo_estudiantil", "mensaje"].every(
          (campo) => typeof fila[campo as keyof ResultadoFila] === "string",
        ) ||
        !["registrado", "error"].includes(fila.estado),
    ) ||
    datos.filas.filter((fila) => fila.estado === "registrado").length !==
      datos.registrados
  ) {
    throw new Error(
      "La respuesta de la importación no es válida. Verifica el resultado antes de volver a enviarlo.",
    );
  }
  return datos;
}
