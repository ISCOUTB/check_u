import { BadRequestException } from '@nestjs/common';

export const MAXIMO_BYTES_CSV = 64 * 1024;
export const MAXIMO_ESTUDIANTES_CSV = 1000;
const ENCABEZADO = ['nombres', 'apellidos', 'codigo_estudiantil', 'rol'];

export interface FilaEstudianteCsv {
  linea: number;
  celdas: string[];
}

/** CSV de punto y coma, con BOM, CRLF y comillas escapadas. Conserva la línea inicial del registro. */
export function leerEstudiantesCsv(texto: string): FilaEstudianteCsv[] {
  if (Buffer.byteLength(texto, 'utf8') > MAXIMO_BYTES_CSV) {
    throw new BadRequestException('El CSV debe pesar como máximo 64 KiB.');
  }
  const contenido = texto.replace(/^\uFEFF/, '').replace(/\r\n|\r/g, '\n');
  const filas: FilaEstudianteCsv[] = [];
  let celdas: string[] = [];
  let valor = '';
  let estado: 'inicio' | 'texto' | 'comillas' | 'cerrada' = 'inicio';
  let linea = 1;
  let inicio = 1;

  function terminarCelda() {
    celdas.push(valor.trim());
    valor = '';
    estado = 'inicio';
  }
  function terminarFila() {
    terminarCelda();
    // Se omiten líneas en blanco. Una fila como ;;; se valida y reporta como incompleta.
    if (celdas.length > 1 || celdas[0] !== '')
      filas.push({ linea: inicio, celdas });
    celdas = [];
  }
  function errorComillas(): never {
    throw new BadRequestException(
      `CSV inválido en la línea ${linea}. Revisa las comillas del registro antes de importar.`,
    );
  }

  for (let i = 0; i < contenido.length; i++) {
    const caracter = contenido[i];
    if (estado === 'comillas') {
      if (caracter === '"') {
        if (contenido[i + 1] === '"') {
          valor += '"';
          i++;
        } else estado = 'cerrada';
      } else {
        valor += caracter;
        if (caracter === '\n') linea++;
      }
      continue;
    }
    if (caracter === ';') {
      terminarCelda();
    } else if (caracter === '\n') {
      terminarFila();
      linea++;
      inicio = linea;
    } else if (estado === 'cerrada') {
      if (caracter !== ' ' && caracter !== '\t') errorComillas();
    } else if (caracter === '"') {
      if (valor.trim() !== '') errorComillas();
      valor = '';
      estado = 'comillas';
    } else {
      valor += caracter;
      estado = 'texto';
    }
  }
  if (estado === 'comillas') errorComillas();
  terminarFila();
  const encabezado = filas.shift();
  if (
    !encabezado ||
    encabezado.celdas.length !== 4 ||
    !ENCABEZADO.every(
      (campo, i) => encabezado.celdas[i].toLowerCase() === campo,
    )
  ) {
    throw new BadRequestException(
      'El CSV debe comenzar con nombres;apellidos;codigo_estudiantil;rol, en ese orden y separado por punto y coma.',
    );
  }
  if (filas.length === 0)
    throw new BadRequestException(
      'Agrega al menos un estudiante debajo del encabezado.',
    );
  if (filas.length > MAXIMO_ESTUDIANTES_CSV)
    throw new BadRequestException(
      'El CSV admite como máximo 1000 estudiantes por importación.',
    );
  return filas;
}
