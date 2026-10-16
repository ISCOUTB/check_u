// Íconos de trazo, todos con el mismo grosor (24×24, stroke 2). Son decorativos: el texto que
// los acompaña dice lo mismo, así que van con aria-hidden.

const TRAZOS = {
    valido: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    no_valido: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m9 9 6 6M15 9l-6 6" />
        </>
    ),
    inconsistente: (
        <>
            <path d="M12 3.5 2.5 20h19L12 3.5Z" />
            <path d="M12 10v4.5M12 17.5v.01" />
        </>
    ),
    por_revisar: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5V12l3 2" />
        </>
    ),
    procesando: <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5" />,
    falta_cargar: (
        <>
            <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
            <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
        </>
    ),
    escudo: (
        <>
            <path d="M12 21s7.5-3.75 7.5-10.25V5.5L12 3 4.5 5.5v5.25C4.5 17.25 12 21 12 21Z" />
            <path d="m9 11.75 2 2 4-4" />
        </>
    ),
    lista: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
    campana: (
        <>
            <path d="M6 9.5a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15.5 6 9.5Z" />
            <path d="M10 20a2 2 0 0 0 4 0" />
        </>
    ),
    salir: (
        <>
            <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
            <path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" />
        </>
    ),
    flecha_abajo: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
    documento: (
        <>
            <path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5Z" />
            <path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" />
        </>
    ),
    cerrar: <path d="m6 6 12 12M18 6 6 18" />,
};

export type NombreIcono = keyof typeof TRAZOS;

export default function Icono({ nombre, tamano = 18 }: { nombre: NombreIcono; tamano?: number }) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            width={tamano}
            height={tamano}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {TRAZOS[nombre]}
        </svg>
    );
}
