import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service.js';
import { parsearCsvOpciones } from './opciones-csv.js';
import {
  CAMPOS_OPCIONES,
  normalizarValorOpcion,
  type CampoOpciones,
  type OpcionCampo,
  type ResultadoImportacion,
} from './opciones.types.js';

interface OpcionRow {
  id_opcion: number;
  campo: CampoOpciones;
  valor: string;
  etiqueta: string;
  orden: number;
}

interface OpcionExistente {
  valor: string;
  etiqueta: string;
}

const SELECT_OPCION = `SELECT id_opcion, campo, valor, etiqueta, orden FROM opciones_campo`;

@Injectable()
export class OpcionesService {
  constructor(private readonly db: DatabaseService) {}

  async listar(campo?: string): Promise<OpcionCampo[]> {
    if (campo !== undefined) {
      const campoValido = this.validarCampo(campo);
      const result = await this.db.query<OpcionRow>(
        `${SELECT_OPCION} WHERE campo = $1 ORDER BY orden, id_opcion`,
        [campoValido],
      );
      return result.rows.map((row) => this.serializar(row));
    }

    const result = await this.db.query<OpcionRow>(
      `${SELECT_OPCION}
       ORDER BY array_position($1::text[], campo), orden, id_opcion`,
      [CAMPOS_OPCIONES],
    );
    return result.rows.map((row) => this.serializar(row));
  }

  async crear(input: { campo?: string; etiqueta?: string; valor?: string }): Promise<OpcionCampo> {
    const campo = this.validarCampo(input.campo);
    const etiqueta = this.validarEtiqueta(input.etiqueta);
    const valor = this.validarValor(input.valor ?? etiqueta);
    await this.comprobarDuplicado(campo, valor, etiqueta);

    // Se consulta aparte para no reutilizar el mismo parámetro con dos tipos inferidos.
    const siguiente = await this.db.query<{ siguiente: number }>(
      `SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM opciones_campo WHERE campo = $1`,
      [campo],
    );
    const result = await this.db.query<OpcionRow>(
      `INSERT INTO opciones_campo (campo, valor, etiqueta, orden)
       VALUES ($1, $2, $3, $4)
       RETURNING id_opcion, campo, valor, etiqueta, orden`,
      [campo, valor, etiqueta, Number(siguiente.rows[0]?.siguiente ?? 1)],
    );
    return this.serializar(result.rows[0]);
  }

  async actualizar(id: string, input: { etiqueta?: string }): Promise<OpcionCampo> {
    const idOpcion = this.validarId(id);
    const actual = await this.db.query<OpcionRow>(
      `${SELECT_OPCION} WHERE id_opcion = $1`,
      [idOpcion],
    );
    const fila = actual.rows[0];
    if (!fila) throw new NotFoundException('No existe la opción indicada.');

    const etiqueta = this.validarEtiqueta(input.etiqueta ?? fila.etiqueta);
    const repetida = await this.db.query<{ id_opcion: number }>(
      `SELECT id_opcion FROM opciones_campo
       WHERE campo = $1 AND lower(etiqueta) = lower($2) AND id_opcion <> $3
       LIMIT 1`,
      [fila.campo, etiqueta, idOpcion],
    );
    if (repetida.rows[0]) {
      throw new ConflictException('Ya existe una opción con ese nombre para este campo.');
    }

    const result = await this.db.query<OpcionRow>(
      `UPDATE opciones_campo
       SET etiqueta = $2, fecha_actualizacion = now()
       WHERE id_opcion = $1
       RETURNING id_opcion, campo, valor, etiqueta, orden`,
      [idOpcion, etiqueta],
    );
    return this.serializar(result.rows[0]);
  }

  async eliminar(id: string): Promise<{ ok: true; id: number }> {
    const idOpcion = this.validarId(id);
    const result = await this.db.query<{ id_opcion: number }>(
      `DELETE FROM opciones_campo WHERE id_opcion = $1 RETURNING id_opcion`,
      [idOpcion],
    );
    if (!result.rows[0]) throw new NotFoundException('No existe la opción indicada.');
    return { ok: true, id: idOpcion };
  }

  /** Guarda el orden completo de un campo: `ids` llega en el orden visible deseado. */
  async reordenar(campo: string, ids: unknown): Promise<OpcionCampo[]> {
    const campoValido = this.validarCampo(campo);
    if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id) || (id as number) < 1)) {
      throw new BadRequestException('El orden debe ser una lista de identificadores válidos.');
    }
    const identificadores = ids as number[];
    if (new Set(identificadores).size !== identificadores.length) {
      throw new BadRequestException('El orden contiene identificadores repetidos.');
    }

    await this.db.transaction(async (client: PoolClient) => {
      const actuales = await client.query<{ id_opcion: number }>(
        `SELECT id_opcion FROM opciones_campo WHERE campo = $1 ORDER BY orden, id_opcion FOR UPDATE`,
        [campoValido],
      );
      const idsActuales = actuales.rows.map((row) => Number(row.id_opcion));
      const mismos =
        idsActuales.length === identificadores.length &&
        identificadores.every((id) => idsActuales.includes(id));

      if (!mismos) {
        throw new BadRequestException(
          'El orden debe incluir todas las opciones del campo, sin sobrantes ni faltantes.',
        );
      }

      for (const [indice, id] of identificadores.entries()) {
        await client.query(
          `UPDATE opciones_campo
           SET orden = $2, fecha_actualizacion = now()
           WHERE id_opcion = $1 AND campo = $3`,
          [id, indice + 1, campoValido],
        );
      }
    });

    return this.listar(campoValido);
  }

  async importar(campo: string, texto: unknown): Promise<ResultadoImportacion> {
    const campoValido = this.validarCampo(campo);
    if (typeof texto !== 'string' || texto.trim() === '') {
      throw new BadRequestException('Adjunta un archivo CSV con al menos una opción.');
    }
    if (texto.length > 1_000_000) {
      throw new BadRequestException('El archivo CSV supera el tamaño máximo permitido (1 MB).');
    }

    const { filas, vacias } = parsearCsvOpciones(texto);
    if (filas.length === 0 && vacias.length === 0) {
      throw new BadRequestException('El archivo no contiene opciones para importar.');
    }

    const resultado: ResultadoImportacion = {
      campo: campoValido,
      creadas: 0,
      total: filas.length,
      duplicados: [],
      vacias: [...vacias],
      invalidos: [],
    };

    await this.db.transaction(async (client: PoolClient) => {
      const existentes = await client.query<OpcionExistente>(
        `SELECT valor, etiqueta FROM opciones_campo WHERE campo = $1`,
        [campoValido],
      );
      const valoresExistentes = new Set(existentes.rows.map((row) => row.valor));
      const etiquetasExistentes = new Set(
        existentes.rows.map((row) => row.etiqueta.toLowerCase()),
      );
      const nuevo = await client.query<{ siguiente: number }>(
        `SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM opciones_campo WHERE campo = $1`,
        [campoValido],
      );
      let siguienteOrden = Number(nuevo.rows[0]?.siguiente ?? 1);

      for (const fila of filas) {
        const etiqueta = fila.etiqueta.trim();

        if (!etiqueta) {
          resultado.vacias.push(fila.linea);
          continue;
        }
        if (etiqueta.length > 150) {
          resultado.invalidos.push({
            linea: fila.linea,
            valor: etiqueta,
            motivo: 'El nombre supera 150 caracteres.',
          });
          continue;
        }

        const valor = this.validarValor(fila.valor ?? etiqueta, fila.linea, resultado);
        if (!valor) continue;

        const claveEtiqueta = etiqueta.toLowerCase();
        if (
          valoresExistentes.has(valor) ||
          etiquetasExistentes.has(claveEtiqueta)
        ) {
          resultado.duplicados.push({ linea: fila.linea, valor: etiqueta });
          continue;
        }

        await client.query(
          `INSERT INTO opciones_campo (campo, valor, etiqueta, orden)
           VALUES ($1, $2, $3, $4)`,
          [campoValido, valor, etiqueta, siguienteOrden],
        );
        siguienteOrden += 1;
        valoresExistentes.add(valor);
        etiquetasExistentes.add(claveEtiqueta);
        resultado.creadas += 1;
      }
    });

    return resultado;
  }

  private async comprobarDuplicado(
    campo: CampoOpciones,
    valor: string,
    etiqueta: string,
  ): Promise<void> {
    const result = await this.db.query<OpcionExistente>(
      `SELECT valor, etiqueta FROM opciones_campo
       WHERE campo = $1 AND (valor = $2 OR lower(etiqueta) = lower($3))
       LIMIT 1`,
      [campo, valor, etiqueta],
    );
    if (result.rows[0]) {
      throw new ConflictException(
        result.rows[0].valor === valor
          ? 'Ya existe una opción con el mismo valor interno para este campo.'
          : 'Ya existe una opción con ese nombre para este campo.',
      );
    }
  }

  private validarCampo(valor: unknown): CampoOpciones {
    if (typeof valor !== 'string' || !(CAMPOS_OPCIONES as readonly string[]).includes(valor)) {
      throw new BadRequestException(
        `El campo debe ser uno de: ${CAMPOS_OPCIONES.join(', ')}.`,
      );
    }
    return valor as CampoOpciones;
  }

  private validarEtiqueta(valor: unknown): string {
    if (typeof valor !== 'string') {
      throw new BadRequestException('El nombre de la opción es obligatorio.');
    }
    const etiqueta = valor.trim().replace(/\s+/g, ' ');
    if (!etiqueta) {
      throw new BadRequestException('El nombre de la opción es obligatorio.');
    }
    if (etiqueta.length > 150) {
      throw new BadRequestException('El nombre de la opción no puede superar 150 caracteres.');
    }
    return etiqueta;
  }

  private validarValor(
    valor: unknown,
    linea?: number,
    resultado?: ResultadoImportacion,
  ): string {
    if (typeof valor !== 'string') {
      if (resultado && linea) {
        resultado.invalidos.push({
          linea,
          valor: '',
          motivo: 'No se pudo generar el valor interno de la opción.',
        });
        return '';
      }
      throw new BadRequestException('No se pudo generar el valor interno de la opción.');
    }

    const normalizado = normalizarValorOpcion(valor);
    if (!normalizado) {
      if (resultado && linea) {
        resultado.invalidos.push({
          linea,
          valor,
          motivo: 'El nombre debe incluir al menos una letra o un número.',
        });
        return '';
      }
      throw new BadRequestException('El nombre debe incluir al menos una letra o un número.');
    }
    // normalizarValorOpcion ya recorta a 80; un texto más largo se truncaría en silencio.
    if (valor.trim().length > 80 && normalizado.length >= 80) {
      if (resultado && linea) {
        resultado.invalidos.push({
          linea,
          valor,
          motivo: 'El valor interno supera 80 caracteres.',
        });
        return '';
      }
      throw new BadRequestException('El valor interno no puede superar 80 caracteres.');
    }
    return normalizado;
  }

  private validarId(id: string): number {
    const numero = Number(id);
    if (!Number.isInteger(numero) || numero < 1) {
      throw new BadRequestException('Identificador de opción inválido.');
    }
    return numero;
  }

  private serializar(row: OpcionRow): OpcionCampo {
    return {
      id: Number(row.id_opcion),
      campo: row.campo,
      valor: row.valor,
      etiqueta: row.etiqueta,
      orden: Number(row.orden),
    };
  }
}
