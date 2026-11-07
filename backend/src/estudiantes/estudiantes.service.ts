import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { leerEstudiantesCsv } from './estudiantes-csv.js';

export interface DatosEstudiante {
  nombres: string;
  apellidos: string;
  codigo_estudiantil: string;
  rol: 'ESTUDIANTE';
}
export interface EstudianteRegistrado extends DatosEstudiante {
  id_usuario: number;
}
export interface ResultadoFilaEstudiante {
  linea: number;
  nombres: string;
  apellidos: string;
  codigo_estudiantil: string;
  estado: 'registrado' | 'error';
  mensaje: string;
}

const INSERTAR_ESTUDIANTE = `INSERT INTO usuarios (nombres, apellidos, codigo_estudiante, rol, correo)
  VALUES ($1, $2, $3, 'ESTUDIANTE', NULL)
  ON CONFLICT (upper(btrim(codigo_estudiante))) WHERE codigo_estudiante IS NOT NULL DO NOTHING
  RETURNING id_usuario, nombres, apellidos, codigo_estudiante AS codigo_estudiantil, rol`;
const CODIGO_DUPLICADO =
  'El código estudiantil ya está registrado. Revisa el código antes de volver a enviarlo.';

/** Crea usuarios base. Las importaciones confirman juntas las filas válidas. */
@Injectable()
export class EstudiantesService {
  constructor(private readonly db: DatabaseService) {}

  async registrar(input: unknown): Promise<EstudianteRegistrado> {
    const datos = this.validar(input);
    const registrado = await this.insertar(this.db, datos);
    if (!registrado) throw new ConflictException(CODIGO_DUPLICADO);
    return registrado;
  }

  async importar(texto: string) {
    const filas = leerEstudiantesCsv(texto);
    return this.db.transaction(async (client) => {
      const resultados: ResultadoFilaEstudiante[] = [];
      const codigos = new Set<string>();
      for (const fila of filas) {
        const [nombres = '', apellidos = '', codigo = '', rol = ''] =
          fila.celdas;
        const resultado: ResultadoFilaEstudiante = {
          linea: fila.linea,
          nombres,
          apellidos,
          codigo_estudiantil: codigo,
          estado: 'error',
          mensaje: '',
        };
        if (fila.celdas.length !== 4) {
          resultado.mensaje =
            'La fila debe contener exactamente cuatro columnas separadas por punto y coma.';
          resultados.push(resultado);
          continue;
        }
        let datos: DatosEstudiante;
        try {
          datos = this.validar({
            nombres,
            apellidos,
            codigo_estudiantil: codigo,
            rol,
          });
        } catch (error) {
          if (!(error instanceof BadRequestException)) throw error;
          resultado.mensaje = error.message;
          resultados.push(resultado);
          continue;
        }
        resultado.codigo_estudiantil = datos.codigo_estudiantil;
        if (codigos.has(datos.codigo_estudiantil)) {
          resultado.mensaje =
            'El código estudiantil se repite en este archivo.';
          resultados.push(resultado);
          continue;
        }
        codigos.add(datos.codigo_estudiantil);
        const registrado = await this.insertar(client, datos);
        resultado.estado = registrado ? 'registrado' : 'error';
        resultado.mensaje = registrado
          ? 'Estudiante registrado correctamente.'
          : CODIGO_DUPLICADO;
        resultados.push(resultado);
      }
      const registrados = resultados.filter(
        (fila) => fila.estado === 'registrado',
      ).length;
      return {
        total: resultados.length,
        registrados,
        errores: resultados.length - registrados,
        filas: resultados,
      };
    });
  }

  private async insertar(
    client: Pick<DatabaseService, 'query'>,
    datos: DatosEstudiante,
  ): Promise<EstudianteRegistrado | null> {
    const result = await client.query<EstudianteRegistrado>(
      INSERTAR_ESTUDIANTE,
      [datos.nombres, datos.apellidos, datos.codigo_estudiantil],
    );
    return result.rows[0] ?? null;
  }

  private validar(input: unknown): DatosEstudiante {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('Completa los datos del estudiante.');
    const campos = input as Record<string, unknown>;
    const nombres = this.nombre(campos.nombres, 'nombres');
    const apellidos = this.nombre(campos.apellidos, 'apellidos');
    if (campos.rol !== 'ESTUDIANTE')
      throw new BadRequestException('El rol debe ser ESTUDIANTE.');
    const codigo =
      typeof campos.codigo_estudiantil === 'string'
        ? campos.codigo_estudiantil.trim().toUpperCase()
        : '';
    if (!codigo || codigo.length > 50 || !/^[A-Z0-9_-]+$/.test(codigo)) {
      throw new BadRequestException(
        'El código estudiantil debe tener de 1 a 50 letras o números. También admite guion y guion bajo.',
      );
    }
    return {
      nombres,
      apellidos,
      codigo_estudiantil: codigo,
      rol: 'ESTUDIANTE',
    };
  }

  private nombre(valor: unknown, campo: string): string {
    if (
      typeof valor !== 'string' ||
      !valor.trim() ||
      valor.trim().length > 100 ||
      // oxlint-disable-next-line no-control-regex -- Los nombres no admiten controles ni saltos de línea.
      /[\u0000-\u001f\u007f]/.test(valor.trim())
    ) {
      throw new BadRequestException(
        `Los ${campo} son obligatorios y deben tener como máximo 100 caracteres sin saltos de línea ni caracteres de control.`,
      );
    }
    return valor.trim();
  }
}
