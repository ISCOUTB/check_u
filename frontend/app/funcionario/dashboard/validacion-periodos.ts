export interface DatosPeriodo {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  fechaGraduacion: string;
}
export interface ErrorPeriodo {
  campo: keyof DatosPeriodo;
  mensaje: string;
}
/** Fechas calendario, sin convertir a la zona horaria del navegador. */
function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha.startsWith("0000"))
    return false;
  const date = new Date(`${fecha}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === fecha
  );
}
export function validarPeriodo(
  datos: DatosPeriodo,
  periodos: { id: string; fechaInicio: string; fechaFin: string }[],
  idEditando?: string,
): ErrorPeriodo | null {
  if (!datos.nombre.trim() || datos.nombre.trim().length > 120)
    return {
      campo: "nombre",
      mensaje: "Escribe un nombre para el periodo de entre 1 y 120 caracteres.",
    };
  for (const campo of ["fechaInicio", "fechaFin", "fechaGraduacion"] as const) {
    if (!fechaValida(datos[campo])) {
      const etiqueta = {
        fechaInicio: "inicio",
        fechaFin: "finalización",
        fechaGraduacion: "graduación",
      }[campo];
      return { campo, mensaje: `Selecciona una fecha de ${etiqueta} válida.` };
    }
  }
  if (datos.fechaInicio >= datos.fechaFin)
    return {
      campo: "fechaFin",
      mensaje:
        "La fecha de inicio debe ser anterior a la fecha de finalización. Selecciona un cierre posterior al inicio.",
    };
  if (datos.fechaGraduacion <= datos.fechaFin)
    return {
      campo: "fechaGraduacion",
      mensaje:
        "La fecha de graduación debe ser posterior a la fecha de finalización de recepción de documentos. Selecciona una fecha después del cierre.",
    };
  if (
    periodos.some(
      (p) =>
        p.id !== idEditando &&
        p.fechaInicio === datos.fechaInicio &&
        p.fechaFin === datos.fechaFin,
    )
  )
    return {
      campo: "fechaInicio",
      mensaje:
        "Ya existe un periodo con estas fechas de recepción. Edita el periodo registrado o selecciona otro rango.",
    };
  return null;
}
