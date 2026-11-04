function decodificar(valor: string): string | null {
  try {
    return decodeURIComponent(valor);
  } catch {
    return null;
  }
}

/**
 * Desplaza la vista hasta el ancla de un enlace cuando su destino ya está
 * montado en la página actual. Devuelve `true` si encontró el elemento.
 *
 * Se usa porque el desplazamiento automático del navegador y de Next.js no se
 * repite cuando el ancla ya forma parte de la URL o cuando el elemento aparece
 * después de una carga asíncrona.
 */
export function desplazarAAncla(href: string): boolean {
  const [ruta, hash] = href.split('#');

  if (!hash) return false;
  if (ruta && ruta !== window.location.pathname) return false;

  const id = decodificar(hash);
  if (!id) return false;

  const elemento = document.getElementById(id);
  if (!elemento) return false;

  elemento.scrollIntoView({ block: 'start' });
  return true;
}
