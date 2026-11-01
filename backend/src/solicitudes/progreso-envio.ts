import type { Response } from 'express';

export interface AvanceEnvio {
  etapa: string;
  porcentaje: number;
  estado: 'procesando' | 'error' | 'completado';
}
export type InformarAvance = (etapa: string) => void;
export function etapaDocumento(tipo: string, orden: number, doble: boolean) {
  const nombres: Record<string, string> = {
    identification: 'Verificando documento de identidad.',
    academic_evaluation: doble
      ? `Verificando evaluación de grado expedida por Banner ${orden}.`
      : 'Verificando evaluación de grado expedida por Banner.',
    paz_y_salvo_bib: 'Verificando paz y salvo con Biblioteca.',
    saber_pro: 'Verificando resultados Saber Pro.',
  };
  return (
    nombres[tipo] ??
    (doble
      ? `Verificando comprobante de pago de estampilla ${orden}.`
      : 'Verificando comprobante de estampilla.')
  );
}
/** Cada evento inicia una etapa real. Solo confirmar() publica el 100 %, después del COMMIT. */
export function flujoProgreso(res: Response, cantidadDocumentos: number) {
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  let etapa = '',
    indice = -1;
  const total = 7 + cantidadDocumentos;
  const escribir = (evento: unknown) => {
    if (!res.destroyed && !res.writableEnded)
      res.write(JSON.stringify(evento) + '\n');
  };
  return {
    informar: (nombre: string) => {
      if (nombre !== etapa) indice++;
      etapa = nombre;
      escribir({
        tipo: 'progreso',
        etapa,
        porcentaje: Math.min(99, Math.floor((indice * 100) / total)),
        estado: 'procesando',
      });
    },
    confirmar: (resultado: unknown) => {
      escribir({
        tipo: 'progreso',
        etapa: 'Resultados listos. Redirigiendo…',
        porcentaje: 100,
        estado: 'completado',
      });
      escribir({ tipo: 'resultado', resultado });
      res.end();
    },
    fallar: (mensaje: string, codigo: number) => {
      escribir({
        tipo: 'error',
        etapa,
        porcentaje: Math.max(
          0,
          Math.min(99, Math.floor((indice * 100) / total)),
        ),
        estado: 'error',
        mensaje,
        codigo,
      });
      res.end();
    },
  };
}
