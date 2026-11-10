import Link from 'next/link';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

/**
 * Jerarquía visual de botones (Tarea 68):
 *
 * - primario:   acción principal del contexto (solo una por grupo de acciones).
 *               Fondo accent, máximo peso visual.
 * - secundario: acciones importantes pero no principales (Cancelar, Editar, Reintentar…).
 *               Mismo tamaño, menos saturación (borde + surface).
 * - terciario:  acciones de bajo impacto o auxiliares (Ver todas, Quitar, links de acción).
 *               Mínima presencia visual (sin fondo, tipografía más ligera).
 */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'terciario';
  /** Mientras espera: muestra textoCargando, queda deshabilitado y con aria-busy. */
  cargando?: boolean;
  textoCargando?: string;
  /**
   * Mientras carga, el botón no se deshabilita: queda con aria-disabled e ignora los clics.
   * Así el foco no se pierde y el lector lo anuncia.
   */
  conservarFoco?: boolean;
  /** Con href navega (next/link) en vez de ser un botón. */
  href?: string;
};

/** Botón de CheckU: 44 px de alto como mínimo, foco visible y respuesta al presionar. */
export default function Button({
  variante = 'primario',
  cargando = false,
  textoCargando,
  conservarFoco = false,
  href,
  className,
  children,
  disabled,
  type = 'button',
  ...resto
}: ButtonProps) {
  const clases = [styles.boton, styles[variante], className]
    .filter(Boolean)
    .join(' ');
  const ocupado = cargando && conservarFoco;

  if (href) {
    return (
      <Link
        href={href}
        className={clases}
        aria-label={resto['aria-label']}
        title={resto.title}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={clases}
      disabled={disabled || (cargando && !conservarFoco)}
      aria-disabled={ocupado || undefined}
      aria-busy={cargando || undefined}
      {...resto}
      onClick={
        conservarFoco
          ? (evento) => {
              if (ocupado) evento.preventDefault();
              else resto.onClick?.(evento);
            }
          : resto.onClick
      }
    >
      {cargando && textoCargando ? textoCargando : children}
    </button>
  );
}
