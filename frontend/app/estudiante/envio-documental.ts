export interface ProgresoEnvio { etapa: string; porcentaje: number; estado: 'procesando' | 'error' | 'completado'; }
export type AlProgreso = (progreso: ProgresoEnvio) => void;
interface ResultadoTransporte { ok: boolean; mensaje: string; codigo: number; }
const ERROR_RED = 'Se interrumpió la conexión. Consulta tu preinscripción antes de reintentar; el servidor puede haber terminado el envío.';

/** Un POST: bytes reales en upload.onprogress y etapas NDJSON emitidas por el backend. */
export function transportarEnvio(url: string, form: FormData, alProgreso: AlProgreso, cantidad: number): Promise<ResultadoTransporte> {
  return new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    let consumido = 0, pendiente = '', terminado = false;
    let ultimo: ProgresoEnvio = { etapa: 'Subiendo documentos.', porcentaje: 0, estado: 'procesando' };
    alProgreso(ultimo);
    const emitir = (p: ProgresoEnvio) => {
      ultimo = { ...p, porcentaje: Math.max(ultimo.porcentaje, p.porcentaje) }; alProgreso(ultimo);
    };
    const fallar = (mensaje: string) => { emitir({ ...ultimo, estado: 'error' }); rechazar(new Error(mensaje)); };
    const consumir = () => {
      pendiente += xhr.responseText.slice(consumido); consumido = xhr.responseText.length;
      let fin;
      while ((fin = pendiente.indexOf('\n')) >= 0) {
        const linea = pendiente.slice(0, fin); pendiente = pendiente.slice(fin + 1);
        if (!linea.trim()) continue;
        const evento = JSON.parse(linea) as Record<string, unknown>;
        if (evento.tipo === 'progreso' && typeof evento.etapa === 'string' && typeof evento.porcentaje === 'number' && evento.estado !== 'completado')
          emitir({ etapa: evento.etapa, porcentaje: Math.min(99, Math.max(0, evento.porcentaje)), estado: 'procesando' });
        if (evento.tipo === 'error') {
          terminado = true; emitir({ ...ultimo, estado: 'error' });
          resolver({ ok: false, mensaje: typeof evento.mensaje === 'string' ? evento.mensaje : ERROR_RED, codigo: Number(evento.codigo) || 500 });
        }
        if (evento.tipo === 'resultado') {
          const r = evento.resultado as Record<string, unknown> | undefined;
          if (!r || r.ok !== true) throw new Error('Confirmación de envío inválida.');
          terminado = true;
          emitir({ etapa: 'Resultados listos. Redirigiendo…', porcentaje: 100, estado: 'completado' });
          resolver({ ok: true, mensaje: typeof r.mensaje === 'string' ? r.mensaje : 'Resultados registrados.', codigo: 201 });
        }
      }
    };
    xhr.open('POST', url); xhr.withCredentials = true; xhr.timeout = 15 * 60 * 1000;
    xhr.setRequestHeader('Accept', 'application/x-ndjson');
    xhr.upload.onprogress = e => {
      if (!e.lengthComputable || consumido > 0) return;
      emitir({ etapa: 'Subiendo documentos.', porcentaje: Math.min(Math.floor(100/(7+cantidad)), Math.floor((e.loaded/e.total)*100/(7+cantidad))), estado: 'procesando' });
    };
    xhr.onprogress = () => {
      if (xhr.status < 200 || xhr.status >= 300) return;
      try { consumir(); } catch { xhr.abort(); fallar('Respuesta de progreso inválida. Consulta tu preinscripción para comprobar su estado.'); }
    };
    xhr.onload = () => {
      if (terminado) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { consumir(); } catch { fallar('No fue posible interpretar la confirmación del envío.'); return; }
        if (!terminado) fallar(ERROR_RED);
      } else {
        let mensaje = 'No fue posible enviar los documentos. Revisa tu sesión y los PDF seleccionados.';
        try { const r = JSON.parse(xhr.responseText); if (typeof r.message === 'string' && xhr.status < 500) mensaje = r.message; } catch { /* mensaje seguro */ }
        emitir({ ...ultimo, estado: 'error' }); resolver({ ok: false, mensaje, codigo: xhr.status });
      }
    };
    xhr.onerror = () => fallar(ERROR_RED);
    xhr.ontimeout = () => fallar(ERROR_RED);
    xhr.onabort = () => { if (!terminado) fallar(ERROR_RED); };
    xhr.send(form);
  });
}
