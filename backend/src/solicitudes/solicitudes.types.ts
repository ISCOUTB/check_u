import type { ContextoPeriodo } from '../periodos/asignacion-periodo.js';

export interface SolicitudResumen {
  id_periodo?: string | null;
  id_solicitud: number;
  tipo_solicitud: string;
  estado: string;
}

export interface RespuestaSolicitudEstudiante {
  tiene_solicitud: boolean;
  solicitud: SolicitudResumen | null;
}

export interface RespuestaEnvioPreinscripcion {
  ok: true;
  id_solicitud: number;
  id_entrega: number;
  estado: string;
  mensaje: string;
}

export interface RespuestaGuardarBorrador {
  periodos: ContextoPeriodo;
  ok: true;
  guardadoEn: string;
  id_solicitud: number;
  estado: 'BORRADOR';
  mensaje: string;
}

export interface RespuestaObtenerBorrador {
  periodos: ContextoPeriodo;
  ok: true;
  id_solicitud: number | null;
  estado: string | null;
  borrador: (DatosEnvioPreinscripcion & { guardadoEn: string }) | null;
}

export interface PerfilEstudianteDTO {
  tipoDocumento?: string;
  numeroDocumento?: string;
  fechaNacimiento?: string;
  genero?: string;
  departamento?: string;
  ciudad?: string;
  direccion?: string;
  telefonoFijo?: string;
  celular?: string;
}

export interface ProgramaSolicitudDTO {
  orden: number;
  programa?: string;
  modalidad?: string;
  tipoOpcionGrado?: string;
}

export interface InformacionPregradoDTO {
  conoceRegistroSaberPro?: boolean | null;
  numeroRegistroSaberPro?: string;
  fechaExamenSaberPro?: string;
  esEmpleadoUtb?: boolean | null;
  tipoContrato?: string;
  esHijoDeEmpleadoUtb?: boolean | null;
}

export interface InformacionPosgradoDTO {
  nivelEstudios?: string;
  tituloObtenido?: string;
  esEgresadoPregradoUtb?: boolean | null;
}

export interface ExperienciaLaboralDTO {
  orden: number;
  empresa?: string;
  cargo?: string;
  tiempo?: string;
}

export interface DocumentoCargadoDTO {
  id?: string;
  tipo?: string;
  nombre?: string;
  tamano?: number;
}

export interface DatosEnvioPreinscripcion {
  nivel?: string;
  tipo_solicitud?: string;
  nombres?: string;
  apellidos?: string;
  codigoEstudiantil?: string;
  perfil?: PerfilEstudianteDTO;
  segundoPrograma?: boolean | null;
  programas?: ProgramaSolicitudDTO[];
  pregrado?: InformacionPregradoDTO;
  posgrado?: InformacionPosgradoDTO;
  experiencia?: ExperienciaLaboralDTO[];
  documentos?: Record<string, DocumentoCargadoDTO> | DocumentoCargadoDTO[];
  claveIdempotencia?: string;
}
