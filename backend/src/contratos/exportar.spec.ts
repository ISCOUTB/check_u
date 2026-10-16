import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import modulosFormatos from 'ajv-formats';
import { cargarEjemplos } from '../../test/soporte/ejemplos.js';
import { ESQUEMAS_CONTRATO, generarEsquemas } from './exportar.js';
import { CLASIFICACION_LEGADA, ETIQUETAS_CLASIFICACION, TIPO_DOCUMENTO_LEGADO } from './mapeo.js';

const CARPETA_ESQUEMAS = fileURLToPath(new URL('../../../contratos/esquemas/', import.meta.url));
const addFormats = modulosFormatos.default;

// Lo único que JSON Schema no puede expresar: "sin tipos repetidos" en documentos que difieren en
// la versión. Zod lo rechaza; ajv no. El trabajador de Python debe comprobarlo (docs/contratos.md).
const SOLO_ZOD = new Set(['submission/invalidos/documentos-repetidos.json']);

function leerExportado(archivo: string): unknown {
  return JSON.parse(readFileSync(join(CARPETA_ESQUEMAS, archivo), 'utf8')) as unknown;
}

describe('JSON Schema exportados', () => {
  const generados = generarEsquemas();

  it('contratos/esquemas/ tiene exactamente los archivos que genera Zod', () => {
    expect(readdirSync(CARPETA_ESQUEMAS).sort()).toEqual(Object.keys(generados).sort());
  });

  it.each(Object.keys(generados))('%s coincide con lo que genera Zod (corre npm run contratos:exportar)', (archivo) => {
    expect(leerExportado(archivo)).toEqual(generados[archivo]);
  });

  it('la regla de reenvío viaja en el JSON Schema como dos variantes', () => {
    const esquema = leerExportado('document-validation-result.schema.json') as { oneOf?: unknown[] };
    expect(esquema.oneOf).toHaveLength(2);
  });

  it('mapeo.json lleva las etiquetas y las equivalencias con los nombres viejos', () => {
    expect(leerExportado('mapeo.json')).toEqual({
      etiquetas_clasificacion: ETIQUETAS_CLASIFICACION,
      clasificacion_legada: CLASIFICACION_LEGADA,
      tipo_documento_legado: TIPO_DOCUMENTO_LEGADO,
    });
  });

  it('documentos-requeridos.json tiene 5 para pregrado y 3 para posgrado', () => {
    const requeridos = leerExportado('documentos-requeridos.json') as Record<string, string[]>;
    expect(requeridos.pregrado).toHaveLength(5);
    expect(requeridos.posgrado).toHaveLength(3);
  });
});

describe.each(Object.keys(ESQUEMAS_CONTRATO))('paridad Zod / JSON Schema: %s', (nombre) => {
  // allowUnionTypes: el draft 2020-12 admite listas de tipos (así exporta Zod la unión de value).
  const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true });
  addFormats(ajv);
  const validarAjv = ajv.compile(leerExportado(`${nombre}.schema.json`) as object);
  const zod = ESQUEMAS_CONTRATO[nombre];
  const { validos, invalidos } = cargarEjemplos(nombre);

  it.each([...validos.map((e) => ({ ...e, grupo: 'validos' })), ...invalidos.map((e) => ({ ...e, grupo: 'invalidos' }))])(
    '$grupo/$archivo da el mismo resultado',
    ({ grupo, archivo, datos }) => {
      const esperado = SOLO_ZOD.has(`${nombre}/${grupo}/${archivo}`) ? true : zod.safeParse(datos).success;
      expect(validarAjv(datos)).toBe(esperado);
    },
  );
});
