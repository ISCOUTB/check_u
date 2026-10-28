"use client";
import { useEffect, useState } from 'react';
import styles from './DocumentAnalysis.module.css';
export default function VistaPdf({ url, activo }: { url: string; activo: boolean }) {
  const [resultado, setResultado] = useState<{ origen: string; blob?: string; error?: string } | null>(null);
  useEffect(() => {
    if (!activo) return;
    const controlador = new AbortController(); let blob: string | undefined;
    void fetch(url, { credentials: 'include', cache: 'no-store', signal: controlador.signal }).then(async r => {
      if (!r.ok || !r.headers.get('Content-Type')?.includes('application/pdf')) throw new Error(r.status === 410 ?
        'El archivo original ya no está disponible porque terminó su plazo de conservación.' : 'No fue posible cargar el PDF. Revisa tu sesión e intenta nuevamente.');
      const contenido = await r.blob();
      if (controlador.signal.aborted) return;
      blob = URL.createObjectURL(contenido); setResultado({ origen: url, blob });
    }).catch(e => { if (!controlador.signal.aborted) setResultado({ origen: url, error: e instanceof Error ? e.message : 'No fue posible cargar el PDF.' }); });
    return () => { controlador.abort(); if (blob) URL.revokeObjectURL(blob); };
  }, [url, activo]);
  if (!activo) return null;
  if (!resultado || resultado.origen !== url) return <p role="status">Cargando documento original…</p>;
  if (resultado.error) return <p role="alert">{resultado.error}</p>;
  return <><iframe className={styles.pdfReal} title="Vista previa del documento original" src={resultado.blob} /><a href={resultado.blob} target="_blank" rel="noopener noreferrer">Abrir PDF original en otra pestaña</a></>;
}
