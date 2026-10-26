import {
  BadRequestException,
  HttpException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

const CAMPOS: Record<string, string> = {
  'perfil.tipoDocumento': 'el tipo de documento de identidad',
  'perfil.numeroDocumento': 'el número de documento de identidad',
  'perfil.fechaNacimiento': 'la fecha de nacimiento',
  'perfil.ciudad': 'la ciudad de residencia',
  nombres: 'los nombres',
  apellidos: 'los apellidos',
  codigoEstudiantil: 'el código estudiantil',
  nivel: 'el nivel académico',
  tipo_solicitud: 'el nivel académico',
  'pregrado.fechaExamenSaberPro': 'la fecha del examen Saber Pro',
  'pregrado.numeroRegistroSaberPro': 'el registro Saber Pro',
  'programas.programa': 'el programa académico',
  'programas.modalidad': 'la modalidad del programa',
  'documentos.nombre': 'el nombre del documento',
  'documentos.tamano': 'el tamaño del documento',
};
const COLUMNAS: Record<string, string> = {
  tipo_documento_identidad: 'perfil.tipoDocumento',
  numero_documento: 'perfil.numeroDocumento',
  programa: 'programas.programa',
  modalidad: 'programas.modalidad',
};
export interface CampoBorrador {
  campo: string;
  motivo: 'FALTANTE' | 'INVALIDO';
}

export function errorValidacionBorrador(campos: CampoBorrador[] = []) {
  const primero = campos[0];
  const claveCampo = primero?.campo.replace(/\.\d+(?=\.|$)/g, '') ?? '';
  const etiqueta = Object.hasOwn(CAMPOS, claveCampo)
    ? CAMPOS[claveCampo]
    : undefined;
  const faltante = primero?.motivo === 'FALTANTE';
  return new BadRequestException({
    statusCode: 400,
    codigo: faltante ? 'BORRADOR_CAMPO_REQUERIDO' : 'BORRADOR_DATOS_INVALIDOS',
    message: etiqueta
      ? faltante
        ? `No pudimos guardar tu borrador porque falta completar ${etiqueta}. Verifica este campo e inténtalo nuevamente.`
        : `No pudimos guardar tu borrador porque ${etiqueta} contiene un valor inválido. Verifica este campo e inténtalo nuevamente.`
      : 'No pudimos guardar tu borrador porque algunos datos no son válidos. Revisa el formulario e inténtalo nuevamente.',
    campos,
  });
}

/** Contrato seguro solo para POST borrador. Nunca devuelve SQL, detalles ni trazas. */
export function traducirErrorBorrador(error: unknown): HttpException {
  const http = error instanceof HttpException ? error : null;
  const respuesta = http?.getResponse();
  // Solo las validaciones construidas aquí pueden conservar su respuesta detallada.
  if (
    http &&
    typeof respuesta === 'object' &&
    respuesta !== null &&
    'campos' in respuesta &&
    'codigo' in respuesta &&
    ['BORRADOR_CAMPO_REQUERIDO', 'BORRADOR_DATOS_INVALIDOS'].includes(
      String(respuesta.codigo),
    )
  )
    return http;
  const causa = http?.cause ?? error;
  const pg =
    causa && typeof causa === 'object'
      ? (causa as { code?: string; column?: string; constraint?: string })
      : {};
  if (pg.code === '23502') {
    const campo = Object.hasOwn(COLUMNAS, pg.column ?? '')
      ? COLUMNAS[pg.column!]
      : undefined;
    return errorValidacionBorrador(
      campo ? [{ campo, motivo: 'FALTANTE' }] : [],
    );
  }
  if (['23514', '22P02', '22007', '22008', '22001'].includes(pg.code ?? ''))
    return errorValidacionBorrador();
  let status = http?.getStatus() ?? 500;
  let codigo = 'BORRADOR_ERROR_SERVIDOR';
  let message =
    'Ocurrió un inconveniente al guardar tu borrador. Tu información permanece en el formulario; inténtalo nuevamente en unos momentos.';
  if (status === 401) {
    codigo = 'BORRADOR_SESION_EXPIRADA';
    message =
      'Tu sesión ha expirado. Inicia sesión nuevamente para continuar con tu preinscripción.';
  } else if (status === 403) {
    codigo = 'BORRADOR_SIN_PERMISO';
    message =
      'Tu cuenta no tiene permiso para guardar esta preinscripción. Verifica que ingresaste como estudiante.';
  } else if (
    pg.code === '23505' &&
    pg.constraint === 'uq_perfil_estudiante_identidad'
  ) {
    status = 409;
    codigo = 'BORRADOR_IDENTIDAD_REPETIDA';
    message =
      'No pudimos guardar tu borrador porque ese documento de identidad ya está registrado. Verifica su tipo y número; si son correctos, contacta al personal de grados.';
  } else if (status === 409) {
    codigo = 'BORRADOR_NO_EDITABLE';
    message =
      'La preinscripción ya fue enviada y no permite guardar cambios como borrador. Consulta el estado de tu solicitud.';
  } else if (status === 400 || status === 422) return errorValidacionBorrador();
  else if (
    [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      '57P01',
      '57P03',
      '53300',
    ].includes(pg.code ?? '') ||
    pg.code?.startsWith('08') ||
    (status === 503 && !http?.cause)
  ) {
    status = 503;
    codigo = 'BORRADOR_SERVICIO_NO_DISPONIBLE';
    message =
      'El servicio de guardado no está disponible en este momento. Tu información permanece en el formulario; intenta nuevamente en unos momentos.';
  } else status = 500;
  const cuerpo = { statusCode: status, codigo, message };
  if (status === 401) return new UnauthorizedException(cuerpo);
  if (status === 403) return new ForbiddenException(cuerpo);
  return new HttpException(cuerpo, status);
}
