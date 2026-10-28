import type { ProgresoEnvio } from '@/app/estudiante/envio-documental';
import styles from './ProgresoDocumental.module.css';
export default function ProgresoDocumental({ progreso }: { progreso: ProgresoEnvio | null }) {
  if (!progreso) return null;
  return <section className={styles.seccion} aria-label="Progreso del envío documental">
    <p role={progreso.estado === 'error' ? 'alert' : 'status'}>{progreso.estado === 'error' ? 'Proceso interrumpido: ' : ''}{progreso.etapa}</p>
    <div className={styles.fila}><progress aria-label="Avance del proceso" max={100} value={progreso.porcentaje} /><strong>{progreso.porcentaje}%</strong></div>
    {progreso.estado === 'error' && <p>El proceso no se completó. Consulta el mensaje de error antes de reintentar.</p>}
  </section>;
}
