import { BadRequestException } from '@nestjs/common';
import { PERFIL, proyeccion, validarBorrador } from './borrador.js';

describe('validarBorrador: discapacidad y asistencia (Tarea 37)', () => {
  const errorDe = (payload: unknown) => {
    try {
      validarBorrador(payload);
    } catch (error) {
      return error as BadRequestException;
    }
    throw new Error('La validación debió fallar');
  };

  it('acepta una respuesta afirmativa con su tipo y detalles', () => {
    const datos = validarBorrador({
      perfil: {
        tieneDiscapacidad: true,
        tipoDiscapacidad: 'FISICA',
        detallesAsistencia: 'Requiere acceso sin escaleras.',
      },
    });

    expect(datos.perfil).toEqual({
      tieneDiscapacidad: true,
      tipoDiscapacidad: 'FISICA',
      detallesAsistencia: 'Requiere acceso sin escaleras.',
    });
  });

  it('acepta una respuesta afirmativa sin detalles: son opcionales', () => {
    const datos = validarBorrador({
      perfil: { tieneDiscapacidad: true, tipoDiscapacidad: 'OTRA' },
    });

    expect(datos.perfil).toMatchObject({
      tieneDiscapacidad: true,
      tipoDiscapacidad: 'OTRA',
    });
  });

  it.each([undefined, ''])(
    'exige el tipo de discapacidad cuando la respuesta es Sí (tipo %s)',
    (tipoDiscapacidad) => {
      const error = errorDe({
        perfil: { tieneDiscapacidad: true, tipoDiscapacidad },
      });

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        codigo: 'BORRADOR_CAMPO_REQUERIDO',
        campos: [{ campo: 'perfil.tipoDiscapacidad', motivo: 'FALTANTE' }],
        message: expect.stringContaining('el tipo de discapacidad'),
      });
    },
  );

  it('rechaza un tipo de discapacidad que no está en el catálogo', () => {
    const error = errorDe({
      perfil: { tieneDiscapacidad: true, tipoDiscapacidad: 'OTRA_COSA' },
    });

    expect(error.getResponse()).toMatchObject({
      codigo: 'BORRADOR_DATOS_INVALIDOS',
      campos: [{ campo: 'perfil.tipoDiscapacidad', motivo: 'INVALIDO' }],
    });
  });

  it.each([false, null])(
    'al responder No (%s) descarta tipo y detalles aunque vengan cargados',
    (tieneDiscapacidad) => {
      const datos = validarBorrador({
        perfil: {
          tieneDiscapacidad,
          tipoDiscapacidad: 'SENSORIAL',
          detallesAsistencia: 'Valor residual',
        },
      });

      expect(datos.perfil).toMatchObject({
        tieneDiscapacidad,
        tipoDiscapacidad: '',
        detallesAsistencia: '',
      });
    },
  );

  it('un guardado parcial del perfil no toca los campos de discapacidad', () => {
    const datos = validarBorrador({ perfil: { ciudad: 'Cartagena' } });

    expect(datos.perfil).toEqual({ ciudad: 'Cartagena' });
    expect(datos.perfil).not.toHaveProperty('tieneDiscapacidad');
    expect(datos.perfil).not.toHaveProperty('tipoDiscapacidad');
    expect(datos.perfil).not.toHaveProperty('detallesAsistencia');
  });

  it('un guardado parcial descarta campos dependientes enviados sin la respuesta principal', () => {
    const datos = validarBorrador({
      perfil: {
        ciudad: 'Cartagena',
        tipoDiscapacidad: 'FISICA',
        detallesAsistencia: 'Sin respuesta principal',
      },
    });

    expect(datos.perfil).toEqual({ ciudad: 'Cartagena' });
  });

  it('el perfil proyectado para la API incluye las tres columnas nuevas', () => {
    expect(PERFIL).toMatchObject({
      tieneDiscapacidad: 'tiene_discapacidad',
      tipoDiscapacidad: 'tipo_discapacidad',
      detallesAsistencia: 'detalles_necesidades_asistencia',
    });
    expect(proyeccion(PERFIL)).toContain(
      'detalles_necesidades_asistencia AS "detallesAsistencia"',
    );
  });
});
