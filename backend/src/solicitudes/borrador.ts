import { errorValidacionBorrador } from './errores-borrador.js';
import { z } from 'zod';

const texto = z.string().max(500).optional();
const textoLargo = z.string().max(1000).optional();
const fecha = z.union([z.literal(''), z.iso.date()]).optional();
const respuesta = z.boolean().nullable().optional();
// El catálogo lo administra el funcionario (opciones_campo); aquí solo se exige coherencia.
const tipoDiscapacidad = z.string().max(80).optional();
const orden = z.union([z.literal(1), z.literal(2)]);
const programa = z.object({
  orden,
  programa: texto,
  modalidad: z.enum(['', 'PRESENCIAL', 'VIRTUAL']).optional(),
  tipoOpcionGrado: texto,
});
const experiencia = z.object({
  orden,
  empresa: texto,
  cargo: texto,
  tiempo: texto,
});
const sinOrdenRepetido = <T extends { orden: number }>(filas: T[]) =>
  new Set(filas.map((fila) => fila.orden)).size === filas.length;
const documento = z.object({
  id: z.string().max(60).optional(),
  tipo: z.string().max(60).optional(),
  nombre: z.string().trim().min(1).max(255),
  tamano: z.number().int().positive().max(2147483647),
});
const esquema = z.object({
  nivel: z.enum(['PREGRADO', 'POSGRADO']).optional(),
  tipo_solicitud: z.enum(['PREGRADO', 'POSGRADO']).optional(),
  nombres: z.string().max(100).optional(),
  apellidos: z.string().max(100).optional(),
  codigoEstudiantil: texto,
  perfil: z
    .object({
      tipoDocumento: texto,
      numeroDocumento: z
        .string()
        .max(100)
        .regex(/^[A-Za-z0-9]*$/)
        .optional(),
      fechaNacimiento: fecha,
      genero: texto,
      departamento: texto,
      ciudad: texto,
      direccion: texto,
      telefonoFijo: texto,
      celular: texto,
      tieneDiscapacidad: respuesta,
      tipoDiscapacidad,
      detallesAsistencia: textoLargo,
    })
    .optional(),
  segundoPrograma: respuesta,
  programas: z.array(programa).max(2).refine(sinOrdenRepetido).optional(),
  pregrado: z
    .object({
      conoceRegistroSaberPro: respuesta,
      numeroRegistroSaberPro: texto,
      fechaExamenSaberPro: fecha,
      esEmpleadoUtb: respuesta,
      tipoContrato: texto,
      esHijoDeEmpleadoUtb: respuesta,
    })
    .optional(),
  posgrado: z
    .object({
      nivelEstudios: texto,
      tituloObtenido: texto,
      esEgresadoPregradoUtb: respuesta,
    })
    .optional(),
  experiencia: z.array(experiencia).max(2).refine(sinOrdenRepetido).optional(),
  documentos: z
    .union([z.array(documento), z.record(z.string(), documento)])
    .optional(),
}).superRefine((datos, ctx) => {
  const perfil = datos.perfil;
  if (perfil?.tieneDiscapacidad === true && !perfil.tipoDiscapacidad) {
    ctx.addIssue({
      code: 'custom',
      path: ['perfil', 'tipoDiscapacidad'],
      message: 'El tipo de discapacidad es obligatorio cuando se responde Sí',
    });
  }
});

export function validarBorrador(payload: unknown) {
  const resultado = esquema.safeParse(payload ?? {});
  if (!resultado.success) {
    const campos = resultado.error.issues.map(issue => {
      let dato: unknown = payload;
      for (const parte of issue.path) {
        dato = dato && typeof dato === 'object' ? Reflect.get(dato, parte) : undefined;
      }
      return {
        campo: issue.path.map(String).join('.'),
        motivo: (dato === undefined || dato === null || dato === '' ? 'FALTANTE' : 'INVALIDO') as 'FALTANTE' | 'INVALIDO',
      };
    });
    throw errorValidacionBorrador(campos);
  }
  const datos = resultado.data;
  if (datos.perfil) {
    // Un guardado parcial no toca los campos de discapacidad: solo se normalizan cuando el
    // cliente envió la respuesta principal o alguno de sus campos dependientes.
    if (datos.perfil.tieneDiscapacidad === undefined) {
      delete datos.perfil.tipoDiscapacidad;
      delete datos.perfil.detallesAsistencia;
    } else if (datos.perfil.tieneDiscapacidad !== true) {
      // Los campos dependientes no sobreviven a una respuesta negativa.
      datos.perfil.tipoDiscapacidad = '';
      datos.perfil.detallesAsistencia = '';
    }
  }
  if (
    datos.nivel &&
    datos.tipo_solicitud &&
    datos.nivel !== datos.tipo_solicitud
  ) {
    throw errorValidacionBorrador([{ campo: 'nivel', motivo: 'INVALIDO' }]);
  }
  return datos;
}

// Nombres SQL fijos: ninguna tabla ni columna proviene del cliente.
export const PERFIL = {
  tipoDocumento: 'tipo_documento_identidad',
  numeroDocumento: 'numero_documento',
  fechaNacimiento: 'fecha_nacimiento',
  genero: 'genero',
  departamento: 'departamento_residencia',
  ciudad: 'ciudad_residencia',
  direccion: 'direccion_residencia',
  telefonoFijo: 'telefono_fijo',
  celular: 'telefono_celular',
  tieneDiscapacidad: 'tiene_discapacidad',
  tipoDiscapacidad: 'tipo_discapacidad',
  detallesAsistencia: 'detalles_necesidades_asistencia',
};
export const PREGRADO = {
  conoceRegistroSaberPro: 'conoce_registro_saber_pro',
  numeroRegistroSaberPro: 'numero_registro_saber_pro',
  fechaExamenSaberPro: 'fecha_examen_saber_pro',
  esEmpleadoUtb: 'es_empleado_utb',
  tipoContrato: 'tipo_contrato',
  esHijoDeEmpleadoUtb: 'es_hijo_empleado_utb',
};
export const POSGRADO = {
  nivelEstudios: 'nivel_estudios_alcanzado',
  tituloObtenido: 'titulo_obtenido',
  esEgresadoPregradoUtb: 'es_egresado_pregrado_utb',
};
export const PROGRAMA = {
  orden: 'orden',
  programa: 'programa',
  modalidad: 'modalidad',
  tipoOpcionGrado: 'tipo_opcion_grado',
};
export const EXPERIENCIA = {
  orden: 'orden',
  empresa: 'empresa',
  cargo: 'cargo',
  tiempo: 'tiempo',
};

export function proyeccion(mapa: Record<string, string>) {
  return Object.entries(mapa)
    .map(
      ([api, sql]) =>
        `${sql}${sql.startsWith('fecha_') ? '::text' : ''} AS "${api}"`,
    )
    .join(', ');
}
