import type { ResultadoAnalisis } from './types';

export async function analizarDocumentos(
  formulario: FormData,
): Promise<ResultadoAnalisis> {
  const respuesta = await fetch('/api/documentos/analizar', {
    method: 'POST',
    body: formulario,
  });

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const mensaje =
      cuerpo && typeof cuerpo === 'object' && 'message' in cuerpo
        ? String((cuerpo as { message: unknown }).message)
        : 'No fue posible analizar los documentos';

    throw new Error(mensaje);
  }

  return cuerpo as ResultadoAnalisis;
}
