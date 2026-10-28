import type { DatosInformacionEstudiante, FormatoCampo, NivelAcademico } from "./types";

export interface DefinicionCampo {
  clave: keyof DatosInformacionEstudiante;
  etiqueta: string;
  formato: FormatoCampo;
  /** Traduce el valor almacenado a una etiqueta legible. */
  etiquetas?: Record<string, string>;
  /** Si no se define, el campo se muestra siempre dentro del grupo */
  visibleSi?: (datos: DatosInformacionEstudiante) => boolean;
}

export interface DefinicionGrupo {
  id: string;
  titulo: string;
  /** Si no se define, el grupo se muestra siempre */
  visibleSi?: (datos: DatosInformacionEstudiante) => boolean;
  campos: DefinicionCampo[];
}

const identificacion: DefinicionGrupo = {
  id: "identificacion",
  titulo: "Identificación",
  campos: [
    { clave: "nombres", etiqueta: "Nombres", formato: "texto" },
    { clave: "apellidos", etiqueta: "Apellidos", formato: "texto" },
    { clave: "tipoDocumento", etiqueta: "Tipo de documento de identidad", formato: "texto" },
    { clave: "numeroDocumento", etiqueta: "Número de documento de identidad", formato: "documento" },
    { clave: "fechaNacimiento", etiqueta: "Fecha de nacimiento", formato: "fecha" },
    { clave: "genero", etiqueta: "Género", formato: "texto" },
  ],
};

const contacto: DefinicionGrupo = {
  id: "contacto",
  titulo: "Contacto y residencia",
  campos: [
    { clave: "correo", etiqueta: "Correo electrónico", formato: "texto" },
    { clave: "telefonoFijo", etiqueta: "Número de teléfono fijo", formato: "texto" },
    { clave: "telefonoCelular", etiqueta: "Número de teléfono celular", formato: "texto" },
    { clave: "departamento", etiqueta: "Departamento de residencia", formato: "texto" },
    { clave: "ciudad", etiqueta: "Ciudad / municipio de residencia", formato: "texto" },
    { clave: "direccion", etiqueta: "Dirección de residencia", formato: "texto" },
  ],
};

const asistencia: DefinicionGrupo = {
  id: "asistencia",
  titulo: "Discapacidad y asistencia a la ceremonia",
  campos: [
    {
      clave: "tieneDiscapacidad",
      etiqueta: "¿Posee alguna discapacidad?",
      formato: "texto",
    },
    {
      clave: "tipoDiscapacidad",
      etiqueta: "Tipo de discapacidad",
      formato: "texto",
      etiquetas: {
        SENSORIAL: "Sensorial",
        FISICA: "Física",
        INTELECTUAL: "Intelectual",
        ORGANOS: "Órganos",
        OTRA: "Otra",
      },
      visibleSi: (d) => d.tieneDiscapacidad === true,
    },
    {
      clave: "detallesAsistencia",
      etiqueta: "Detalles y necesidades de asistencia",
      formato: "parrafo",
      visibleSi: (d) => d.tieneDiscapacidad === true,
    },
  ],
};

const academicaPregrado: DefinicionGrupo = {
  id: "academica",
  titulo: "Información académica",
  campos: [
    { clave: "codigoEstudiantil", etiqueta: "Código estudiantil", formato: "texto" },
    { clave: "modalidad", etiqueta: "Modalidad de estudio del programa", formato: "texto" },
    { clave: "programa", etiqueta: "Programa para el que solicita grado", formato: "texto" },
    { clave: "tipoOpcionGrado", etiqueta: "Tipo de opción de grado realizada", formato: "texto" },
  ],
};

const segundoPrograma: DefinicionGrupo = {
  id: "segundo_programa",
  titulo: "Segundo programa",
  visibleSi: (d) => Boolean(d.tieneSegundoPrograma),
  campos: [
    { clave: "modalidadSegundoPrograma", etiqueta: "Modalidad de estudio del segundo programa", formato: "texto" },
    { clave: "segundoPrograma", etiqueta: "Segundo programa para el que solicita grado", formato: "texto" },
    { clave: "tipoOpcionGradoSegundo", etiqueta: "Tipo de opción de grado del segundo programa", formato: "texto" },
  ],
};

const saberPro: DefinicionGrupo = {
  id: "saber_pro",
  titulo: "Pruebas Saber Pro",
  campos: [
    {
      clave: "conoceRegistroSaberPro",
      etiqueta: "¿Conoce su número de registro?",
      formato: "texto",
    },
    {
      clave: "numeroRegistroSaberPro",
      etiqueta: "Número de registro",
      formato: "mayusculas",
      visibleSi: (d) => d.conoceRegistroSaberPro === true,
    },
    {
      clave: "fechaExamenSaberPro",
      etiqueta: "Fecha en que presentó el examen",
      formato: "fecha",
    },
  ],
};

const vinculacionUtb: DefinicionGrupo = {
  id: "vinculacion_utb",
  titulo: "Vinculación con la UTB",
  campos: [
    { clave: "esEmpleadoUtb", etiqueta: "¿Es empleado de la UTB?", formato: "texto" },
    {
      clave: "tipoContrato",
      etiqueta: "Tipo de contrato",
      formato: "texto",
      visibleSi: (d) => d.esEmpleadoUtb === true,
    },
    { clave: "esHijoEmpleadoUtb", etiqueta: "¿Es hijo de algún empleado de la UTB?", formato: "texto" },
  ],
};

const academicaPosgrado: DefinicionGrupo = {
  id: "academica",
  titulo: "Información académica",
  campos: [
    { clave: "codigoEstudiantil", etiqueta: "Código estudiantil", formato: "texto" },
    { clave: "modalidad", etiqueta: "Modalidad de estudio del programa", formato: "texto" },
    { clave: "programa", etiqueta: "Programa para el que solicita grado", formato: "texto" },
    {
      clave: "segundoPrograma",
      etiqueta: "Segundo programa para el que solicita grado",
      formato: "texto",
      visibleSi: (d) => Boolean(d.tieneSegundoPrograma),
    },
    { clave: "nivelEstudiosAlcanzado", etiqueta: "Nivel de estudios alcanzado actualmente", formato: "texto" },
    { clave: "tituloObtenido", etiqueta: "Título obtenido", formato: "texto" },
    { clave: "esEgresadoPregradoUtb", etiqueta: "¿Es egresado de pregrado de la UTB?", formato: "texto" },
  ],
};

const experienciaLaboral: DefinicionGrupo = {
  id: "experiencia",
  titulo: "Experiencia laboral",
  campos: [
    { clave: "cargos", etiqueta: "Últimos cargos desempeñados", formato: "lista" },
  ],
};

/** Grupos según nivel. Agregar/quitar campos solo aquí. */
export function gruposPorNivel(nivel: NivelAcademico): DefinicionGrupo[] {
  if (nivel === "POSGRADO") {
    return [identificacion, contacto, asistencia, academicaPosgrado, experienciaLaboral];
  }
  return [identificacion, contacto, asistencia, academicaPregrado, segundoPrograma, saberPro, vinculacionUtb];
}