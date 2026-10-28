/**
 * tipos.ts — Tipos del borrador de preinscripción.
 *
 * Calcan el modelo de datos de la issue #40 (comentario del 22/10/2026). El formulario
 * trabaja con un único `BorradorPreinscripcion` que va llenando de a poco.
 *
 * Convenciones:
 *   - Texto vacío ("") es "sin llenar". Nunca se usa null para un campo de texto.
 *   - `boolean | null` es una pregunta sí/no: null es "sin responder".
 *   - Las fechas son texto `aaaa-mm-dd` (fecha local): se guardan tal como se escriben.
 *   - Los archivos se guardan solo como metadatos (`DocumentoCargado`), nunca su contenido.
 */

import type { Nivel } from "@/app/estudiante/documentos-requeridos";

export type Modalidad = "VIRTUAL" | "PRESENCIAL";

/** Datos personales y de residencia del estudiante. */
export interface PerfilEstudiante {
    /** Valor de `TIPOS_DOCUMENTO` */
    tipoDocumento: string;
    /** Solo letras y dígitos */
    numeroDocumento: string;
    /** `aaaa-mm-dd` */
    fechaNacimiento: string;
    /** Valor de `GENEROS` */
    genero: string;
    telefonoFijo: string;
    celular: string;
    departamento: string;
    ciudad: string;
    direccion: string;
    /** ¿Posee alguna discapacidad? null = sin responder. */
    tieneDiscapacidad: boolean | null;
    /** Valor de `TIPOS_DISCAPACIDAD`; solo si `tieneDiscapacidad` es true. */
    tipoDiscapacidad: string;
    /** Condiciones y apoyos para asistir a la ceremonia de graduación presencial. */
    detallesAsistencia: string;
}

/** Un programa por el que se solicita grado: el primero, o el segundo si hay doble grado. */
export interface ProgramaSolicitud {
    orden: 1 | 2;
    programa: string;
    modalidad: Modalidad | "";
    /** Valor de `OPCIONES_GRADO`. Solo se pide en pregrado; en posgrado queda vacío. */
    tipoOpcionGrado: string;
}

/** Lo que solo se pregunta en pregrado: Saber Pro y vinculación con la UTB. */
export interface InformacionPregrado {
    conoceRegistroSaberPro: boolean | null;
    /** Solo si conoce el registro */
    numeroRegistroSaberPro: string;
    /** `aaaa-mm-dd`. Solo si conoce el registro. */
    fechaExamenSaberPro: string;
    esEmpleadoUtb: boolean | null;
    /** Valor de `TIPOS_CONTRATO`. Solo si es empleado. */
    tipoContrato: string;
    esHijoDeEmpleadoUtb: boolean | null;
}

/** Lo que solo se pregunta en posgrado: estudios alcanzados. */
export interface InformacionPosgrado {
    /** Valor de `NIVELES_ESTUDIO` */
    nivelEstudios: string;
    tituloObtenido: string;
    esEgresadoPregradoUtb: boolean | null;
}

/** Uno de los dos últimos cargos (posgrado): `orden` 1 es el más reciente. */
export interface ExperienciaLaboral {
    orden: 1 | 2;
    empresa: string;
    cargo: string;
    /** Texto libre, por ejemplo "2 años" */
    tiempo: string;
}

/** Un PDF ya cargado, sin su contenido. */
export interface DocumentoCargado {
    /** PDF de esta visita. Al recargar se debe seleccionar nuevamente. */
    archivo?: File;
    /** El id de la zona de carga (`DocumentoDelFormulario.id`) */
    id: string;
    nombre: string;
    /** En bytes */
    tamano: number;
}

export interface BorradorPreinscripcion {
    /** Identificador del borrador persistido, para asociar las cargas posteriores. */
    id_solicitud?: number;
    nivel: Nivel;
    nombres: string;
    apellidos: string;
    /** Viene de la sesión: de solo lectura */
    correo: string;
    codigoEstudiantil: string;
    perfil: PerfilEstudiante;
    /** ¿Solicita grado en un segundo programa? */
    segundoPrograma: boolean | null;
    /**
     * Siempre trae los dos programas, con `orden` 1 y 2, para poder editarlos por posición.
     * El segundo solo cuenta cuando `segundoPrograma` es true.
     */
    programas: ProgramaSolicitud[];
    pregrado: InformacionPregrado;
    posgrado: InformacionPosgrado;
    /** Siempre trae los dos cargos, con `orden` 1 y 2. Solo se pide en posgrado. */
    experiencia: ExperienciaLaboral[];
    /** Por id de zona de carga (`DocumentoDelFormulario.id`) */
    documentos: Record<string, DocumentoCargado>;
    /** ISO 8601 de la última vez que se guardó; null si nunca se ha guardado */
    guardadoEn: string | null;
}

function programaVacio(orden: 1 | 2): ProgramaSolicitud {
    return { orden, programa: "", modalidad: "", tipoOpcionGrado: "" };
}

function experienciaVacia(orden: 1 | 2): ExperienciaLaboral {
    return { orden, empresa: "", cargo: "", tiempo: "" };
}

/** Un borrador sin llenar, con el correo de la sesión. Cada llamada da objetos nuevos. */
export function borradorVacio(nivel: Nivel, correo: string): BorradorPreinscripcion {
    return {
        nivel,
        nombres: "",
        apellidos: "",
        correo,
        codigoEstudiantil: "",
        perfil: {
            tipoDocumento: "",
            numeroDocumento: "",
            fechaNacimiento: "",
            genero: "",
            telefonoFijo: "",
            celular: "",
            departamento: "",
            ciudad: "",
            direccion: "",
            tieneDiscapacidad: null,
            tipoDiscapacidad: "",
            detallesAsistencia: "",
        },
        segundoPrograma: null,
        programas: [programaVacio(1), programaVacio(2)],
        pregrado: {
            conoceRegistroSaberPro: null,
            numeroRegistroSaberPro: "",
            fechaExamenSaberPro: "",
            esEmpleadoUtb: null,
            tipoContrato: "",
            esHijoDeEmpleadoUtb: null,
        },
        posgrado: {
            nivelEstudios: "",
            tituloObtenido: "",
            esEgresadoPregradoUtb: null,
        },
        experiencia: [experienciaVacia(1), experienciaVacia(2)],
        documentos: {},
        guardadoEn: null,
    };
}
