export type NivelAcademico = "PREGRADO" | "POSGRADO";
export type VarianteVista = "estudiante" | "funcionario";

/** Formato de presentación de un valor */
export type FormatoCampo =
  | "texto"
  | "documento"
  | "fecha"
  | "mayusculas"
  | "lista"; // experiencia laboral: varias líneas

export interface CargoLaboral {
  empresa: string;
  cargo: string;
  tiempo: string;
}

/** Datos de solo lectura del perfil*/
export interface DatosInformacionEstudiante {
  // Identificación
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fechaNacimiento: string; // AAAA-MM-DD o vacío
  genero: string;

  // Contacto y residencia
  correo: string;
  telefonoFijo: string;
  telefonoCelular: string;
  departamento: string;
  ciudad: string;
  direccion: string;

  // Académica común
  codigoEstudiantil: string;
  modalidad: string;
  programa: string;

  // Pregrado
  tipoOpcionGrado?: string;
  tieneSegundoPrograma?: boolean;
  modalidadSegundoPrograma?: string;
  segundoPrograma?: string;
  tipoOpcionGradoSegundo?: string;
  conoceRegistroSaberPro?: boolean;
  numeroRegistroSaberPro?: string;
  fechaExamenSaberPro?: string;
  esEmpleadoUtb?: boolean;
  tipoContrato?: string;
  esHijoEmpleadoUtb?: boolean;

  // Posgrado
  nivelEstudiosAlcanzado?: string;
  tituloObtenido?: string;
  esEgresadoPregradoUtb?: boolean;
  cargos?: CargoLaboral[];

  /** Solo relevante en vista funcionario (opcional) */
  ultimaActualizacion?: string; //texto ya formateado
}

export interface PropsInformacionEstudiante {
  nivel: NivelAcademico;
  datos: DatosInformacionEstudiante;
  variante: VarianteVista;
}