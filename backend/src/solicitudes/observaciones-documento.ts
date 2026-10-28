/** Se proyectan reglas reales; los detalles sin evidencia nunca se sustituyen por una aprobación. */
export function observacionesDocumento(
  estadoDb: string,
  detalle: Record<string, unknown> | null,
) {
  const estado = ['VALIDO', 'NO_VALIDO', 'INCONSISTENTE'].includes(estadoDb)
    ? estadoDb.toLowerCase()
    : 'por_revisar';
  if (!detalle)
    return [
      { estado, mensaje: 'Análisis pendiente. No hay resultados registrados.' },
    ];
  if (detalle.estado_procesamiento === 'pendiente_integracion')
    return [
      {
        estado: 'por_revisar',
        mensaje:
          'La validación de Paz y Salvo de Biblioteca está pendiente de integración. Requiere revisión humana.',
      },
    ];
  const reglas = Array.isArray(detalle.rules)
    ? (detalle.rules as Record<string, unknown>[])
    : [];
  const visibles = reglas.filter((r) =>
    estado === 'valido' ? r.result === 'cumple' : r.result !== 'cumple',
  );
  const mensajes = visibles
    .filter((r) => typeof r.message === 'string' && r.message.trim())
    .map((r) => ({
      estado: r.result === 'no_evaluable' ? 'por_revisar' : estado,
      mensaje: r.message as string,
    }));
  const errores = Array.isArray(detalle.errors)
    ? detalle.errors.filter(
        (e): e is string => typeof e === 'string' && !!e.trim(),
      )
    : [];
  for (const e of errores) mensajes.push({ estado, mensaje: e });
  // La clasificación general debe seguir visible aunque todas sus reglas hayan quedado no evaluables.
  if (!mensajes.length || !mensajes.some((m) => m.estado === estado))
    mensajes.unshift({
      estado,
      mensaje:
        estado === 'valido'
          ? 'Las comprobaciones obligatorias del documento se completaron correctamente.'
          : 'El análisis requiere atención. Consulta las comprobaciones y corrige el documento cuando corresponda.',
    });
  return mensajes.filter(
    (m, i, a) =>
      a.findIndex((v) => v.estado === m.estado && v.mensaje === m.mensaje) ===
      i,
  );
}
