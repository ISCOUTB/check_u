import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { crearDbBorrador } from '../../test/soporte/db-borrador.js';
import type { DatabaseService } from '../database/database.service.js';
import { OpcionesService } from './opciones.service.js';

describe('OpcionesService', () => {
  let service: OpcionesService;
  let reiniciar!: () => Promise<void>;

  beforeAll(async () => {
    const { db, servicio } = await crearDbBorrador();
    service = new OpcionesService(servicio as unknown as DatabaseService);
    reiniciar = async () => {
      await db.exec('TRUNCATE opciones_campo RESTART IDENTITY');
    };
  }, 30_000);

  beforeEach(async () => {
    await reiniciar();
  });

  it('crea opciones al final del campo y normaliza el valor interno', async () => {
    const primera = await service.crear({ campo: 'TIPO_DOCUMENTO', etiqueta: 'Cédula de ciudadanía' });
    const segunda = await service.crear({ campo: 'TIPO_DOCUMENTO', etiqueta: 'Pasaporte' });

    expect(primera).toMatchObject({
      campo: 'TIPO_DOCUMENTO',
      valor: 'CEDULA_DE_CIUDADANIA',
      etiqueta: 'Cédula de ciudadanía',
      orden: 1,
    });
    expect(segunda.orden).toBe(2);
    await expect(service.listar('TIPO_DOCUMENTO')).resolves.toHaveLength(2);
  });

  it('rechaza nombres repetidos sin distinguir mayúsculas', async () => {
    await service.crear({ campo: 'GENERO', etiqueta: 'Otro' });

    await expect(service.crear({ campo: 'GENERO', etiqueta: '  OTRO ' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza un campo desconocido', async () => {
    await expect(service.crear({ campo: 'CIUDAD', etiqueta: 'Cartagena' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reordena solo con la lista completa del campo', async () => {
    const a = await service.crear({ campo: 'PROGRAMA', etiqueta: 'Programa A' });
    const b = await service.crear({ campo: 'PROGRAMA', etiqueta: 'Programa B' });
    const c = await service.crear({ campo: 'PROGRAMA', etiqueta: 'Programa C' });

    const reordenadas = await service.reordenar('PROGRAMA', [c.id, a.id, b.id]);
    expect(reordenadas.map((opcion) => opcion.etiqueta)).toEqual([
      'Programa C',
      'Programa A',
      'Programa B',
    ]);
    expect(reordenadas.map((opcion) => opcion.orden)).toEqual([1, 2, 3]);

    await expect(service.reordenar('PROGRAMA', [a.id, b.id])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('elimina una opción y responde 404 si ya no existe', async () => {
    const opcion = await service.crear({ campo: 'TIPO_DISCAPACIDAD', etiqueta: 'Auditiva' });

    await expect(service.eliminar(String(opcion.id))).resolves.toEqual({ ok: true, id: opcion.id });
    await expect(service.eliminar(String(opcion.id))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('importa CSV y reporta duplicados, vacías e inválidas', async () => {
    await service.crear({ campo: 'OPCION_GRADO', etiqueta: 'Trabajo de grado' });

    const resultado = await service.importar(
      'OPCION_GRADO',
      'Etiqueta\nPráctica profesional\nTrabajo de grado\n\nPráctica profesional\n;\n' + 'x'.repeat(151),
    );

    expect(resultado.creadas).toBe(1);
    expect(resultado.duplicados).toEqual([
      { linea: 3, valor: 'Trabajo de grado' },
      { linea: 5, valor: 'Práctica profesional' },
    ]);
    expect(resultado.vacias).toContain(6);
    expect(resultado.invalidos).toHaveLength(1);
    expect(resultado.invalidos[0].motivo).toContain('150');

    const opciones = await service.listar('OPCION_GRADO');
    expect(opciones.map((opcion) => opcion.etiqueta)).toEqual([
      'Trabajo de grado',
      'Práctica profesional',
    ]);
  });

  it('acepta un segundo valor explícito en el CSV', async () => {
    const resultado = await service.importar(
      'GENERO',
      'etiqueta;valor\nFemenino;F\nPrefiero no decir;NO_DICE\n',
    );

    expect(resultado.creadas).toBe(2);
    const opciones = await service.listar('GENERO');
    expect(opciones.map((opcion) => opcion.valor)).toEqual(['F', 'NO_DICE']);
  });
});
