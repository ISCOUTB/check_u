export interface SolicitudResumen {
  id_solicitud: number;
  tipo_solicitud: string;
  estado: string;
}

export interface RespuestaSolicitudEstudiante {
  tiene_solicitud: boolean;
  solicitud: SolicitudResumen | null;
}
