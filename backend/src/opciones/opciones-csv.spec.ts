import { parsearCsvOpciones } from './opciones-csv.js';

describe('parsearCsvOpciones', () => {
  it('lee una opción por línea y omite la fila de encabezado', () => {
    const { filas, vacias } = parsearCsvOpciones(
      '\uFEFFEtiqueta\r\nCédula de ciudadanía\r\nPasaporte\r\n',
    );

    expect(vacias).toEqual([]);
    expect(filas).toEqual([
      { linea: 2, etiqueta: 'Cédula de ciudadanía' },
      { linea: 3, etiqueta: 'Pasaporte' },
    ]);
  });

  it('acepta punto y coma, comillas y comas dentro del nombre', () => {
    const { filas } = parsearCsvOpciones(
      'etiqueta;valor\n"Ingeniería, industrial";ING_INDUSTRIAL\n"Opción ""especial""";ESPECIAL\n',
    );

    expect(filas).toEqual([
      { linea: 2, etiqueta: 'Ingeniería, industrial', valor: 'ING_INDUSTRIAL' },
      { linea: 3, etiqueta: 'Opción "especial"', valor: 'ESPECIAL' },
    ]);
  });

  it('reporta las líneas con separadores pero sin datos', () => {
    const { filas, vacias } = parsearCsvOpciones('Etiqueta\n\nFísica\n;\n');

    expect(vacias).toEqual([4]);
    expect(filas).toEqual([{ linea: 3, etiqueta: 'Física' }]);
  });

  it('no confunde un valor llamado "valor" con un encabezado cuando no es la primera fila', () => {
    const { filas } = parsearCsvOpciones('Otra\nvalor\n');

    expect(filas).toEqual([
      { linea: 1, etiqueta: 'Otra' },
      { linea: 2, etiqueta: 'valor' },
    ]);
  });
});
