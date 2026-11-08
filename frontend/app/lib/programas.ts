/**
 * Convierte un código interno a una versión legible (sin guiones bajos y con
 * mayúsculas y minúsculas), usada cuando el código no existe en el catálogo.
 */
export function legibilizarCodigo(codigo: string): string {
    if (!codigo) return '';
    const conectores = new Set(['de', 'del', 'y', 'e', 'en', 'el', 'la', 'los', 'las', 'a', 'o', 'u']);
    const partes = codigo.trim().split(/[_\s]+/);
    return partes
        .map((parte, index) => {
            const lower = parte.toLowerCase();
            if (index > 0 && conectores.has(lower)) {
                return lower;
            }
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

/** Catálogo de nombres conocidos por defecto para mapear códigos estándar si no viene catálogo dinámico. */
const PROGRAMAS_CONOCIDOS: Record<string, string> = {
    INGENIERIA_DE_SISTEMAS_Y_COMPUTACION: 'Ingeniería de Sistemas y Computación',
    INGENIERIA_INDUSTRIAL: 'Ingeniería Industrial',
    INGENIERIA_MECANICA: 'Ingeniería Mecánica',
    INGENIERIA_ELECTRICA: 'Ingeniería Eléctrica',
    INGENIERIA_ELECTRONICA: 'Ingeniería Electrónica',
    INGENIERIA_CIVIL: 'Ingeniería Civil',
    INGENIERIA_AMBIENTAL: 'Ingeniería Ambiental',
    ADMINISTRACION_DE_EMPRESAS: 'Administración de Empresas',
    CONTADURIA_PUBLICA: 'Contaduría Pública',
    ECONOMIA: 'Economía',
    DERECHO: 'Derecho',
    PSICOLOGIA: 'Psicología',
    ARQUITECTURA: 'Arquitectura',
    COMUNICACION_SOCIAL_Y_PERIODISMO: 'Comunicación Social y Periodismo',
    MAESTRIA_EN_INGENIERIA: 'Maestría en Ingeniería',
    MAESTRIA_EN_ADMINISTRACION_DE_EMPRESAS: 'Maestría en Administración de Empresas',
    ESPECIALIZACION_EN_GESTION_DE_PROYECTOS: 'Especialización en Gestión de Proyectos',
    ESPECIALIZACION_EN_FINANZAS: 'Especialización en Finanzas',
    DOCTORADO_EN_INGENIERIA: 'Doctorado en Ingeniería',
};

/**
 * Devuelve el nombre legible de un programa académico:
 * 1. La etiqueta del catálogo si está disponible.
 * 2. El nombre en el diccionario de programas conocidos si coincide.
 * 3. El texto tal cual si ya es un texto legible (con minúsculas y sin guiones bajos).
 * 4. Una versión legible del código (sin guiones bajos y con mayúsculas y minúsculas) si es desconocido.
 */
export function formatearPrograma(
    codigo?: string | null,
    catalogo?: Record<string, string> | Array<{ valor: string; etiqueta: string }>,
): string {
    if (!codigo) return '';
    const limpio = codigo.trim();
    if (!limpio) return '';

    if (catalogo) {
        if (Array.isArray(catalogo)) {
            const match = catalogo.find((o) => o.valor === limpio);
            if (match?.etiqueta) return match.etiqueta;
        } else if (catalogo[limpio]) {
            return catalogo[limpio];
        }
    }

    if (PROGRAMAS_CONOCIDOS[limpio]) {
        return PROGRAMAS_CONOCIDOS[limpio];
    }

    // Si ya contiene minúsculas y no tiene guiones bajos, ya es un texto legible.
    if (/[a-z]/.test(limpio) && !limpio.includes('_')) {
        return limpio;
    }

    return legibilizarCodigo(limpio);
}

/** Formatea los programas para el encabezado del estudiante o funcionaria. */
export function formatearEncabezadoProgramas(
    programa?: string | null,
    segundoPrograma?: string | null,
): string {
    const p1 = formatearPrograma(programa);
    const p2 = formatearPrograma(segundoPrograma);
    if (p1 && p2) {
        if (p1.includes(p2)) return p1;
        return `${p1} · ${p2}`;
    }
    return p1 || p2 || '';
}
