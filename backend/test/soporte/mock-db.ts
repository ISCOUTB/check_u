import type { PoolClient, QueryResult } from 'pg';

export function crearMockDatabaseService() {
  const estado = {
    solicitudes: [
      {
        id_solicitud: 1,
        id_estudiante: 1,
        tipo_solicitud: 'PREGRADO',
        estado: 'BORRADOR',
      },
    ],
    usuarios: [
      {
        id_usuario: 1,
        nombres: 'Lisandro',
        apellidos: 'Zapata',
        codigo_estudiante: 'T00000001',
      },
    ],
    perfil: [
      {
        id_usuario: 1,
        tipo_documento_identidad: 'CC',
        numero_documento: '1047123456',
      },
    ],
    programas: [
      {
        id_solicitud: 1,
        orden: 1,
        programa: 'Ingeniería de Sistemas',
        modalidad: 'PRESENCIAL',
        tipo_opcion_grado: 'TRABAJO_DE_GRADO',
      },
    ],
    pregrado: [
      {
        id_solicitud: 1,
        conoce_registro_saber_pro: false,
        numero_registro_saber_pro: null,
      },
    ],
    posgrado: [] as Array<{
      id_solicitud: number;
      nivel_estudios_alcanzado: string;
      titulo_obtenido: string;
    }>,
    documentos: [
      { id_documento: 1, id_solicitud: 1, id_entrega: null as number | null, tipo_documento: 'identification', estado: 'CARGADO' },
      { id_documento: 2, id_solicitud: 1, id_entrega: null as number | null, tipo_documento: 'academic_evaluation', estado: 'CARGADO' },
      { id_documento: 3, id_solicitud: 1, id_entrega: null as number | null, tipo_documento: 'paz_y_salvo_bib', estado: 'CARGADO' },
      { id_documento: 4, id_solicitud: 1, id_entrega: null as number | null, tipo_documento: 'estampilla_pro_cultura', estado: 'CARGADO' },
      { id_documento: 5, id_solicitud: 1, id_entrega: null as number | null, tipo_documento: 'saber_pro', estado: 'CARGADO' },
    ],
    entregas: [] as Array<{
      id_entrega: number;
      id_solicitud: number;
      numero_entrega: number;
      tipo_entrega: string;
    }>,
  };

  const normalizarQuery = (text: string) => text.replace(/\s+/g, ' ').trim();

  const ejecutarQuery = async (text: string, params?: unknown[]): Promise<QueryResult> => {
    const q = normalizarQuery(text);

    if (q.includes('FROM solicitud_grado') && q.includes('WHERE id_estudiante = $1')) {
      const idEst = params?.[0] as number;
      const fila = estado.solicitudes.find((s) => s.id_estudiante === idEst);
      return { rows: fila ? [fila] : [], rowCount: fila ? 1 : 0 } as QueryResult;
    }

    if (q.includes('FROM usuarios') && q.includes('WHERE id_usuario = $1')) {
      const idUsu = params?.[0] as number;
      const fila = estado.usuarios.find((u) => u.id_usuario === idUsu);
      return { rows: fila ? [fila] : [], rowCount: fila ? 1 : 0 } as QueryResult;
    }

    if (q.includes('FROM perfil_estudiante') && q.includes('WHERE id_usuario = $1')) {
      const idUsu = params?.[0] as number;
      const fila = estado.perfil.find((p) => p.id_usuario === idUsu);
      return { rows: fila ? [fila] : [], rowCount: fila ? 1 : 0 } as QueryResult;
    }

    if (q.includes('FROM solicitud_programa') && q.includes('WHERE id_solicitud = $1')) {
      const idSol = params?.[0] as number;
      const filas = estado.programas.filter((p) => p.id_solicitud === idSol);
      return { rows: filas, rowCount: filas.length } as QueryResult;
    }

    if (q.includes('FROM informacion_pregrado') && q.includes('WHERE id_solicitud = $1')) {
      const idSol = params?.[0] as number;
      const filas = estado.pregrado.filter((p) => p.id_solicitud === idSol);
      return { rows: filas, rowCount: filas.length } as QueryResult;
    }

    if (q.includes('FROM informacion_posgrado') && q.includes('WHERE id_solicitud = $1')) {
      const idSol = params?.[0] as number;
      const filas = estado.posgrado.filter((p) => p.id_solicitud === idSol);
      return { rows: filas, rowCount: filas.length } as QueryResult;
    }

    if (q.includes('FROM documentos') && q.includes('WHERE id_solicitud = $1')) {
      const idSol = params?.[0] as number;
      const filas = estado.documentos.filter((d) => d.id_solicitud === idSol && (d.id_entrega === null || d.estado === 'CARGADO'));
      return { rows: filas, rowCount: filas.length } as QueryResult;
    }

    if (q.includes('INSERT INTO entregas')) {
      const idSol = params?.[0] as number;
      const nuevaEntrega = {
        id_entrega: estado.entregas.length + 1,
        id_solicitud: idSol,
        numero_entrega: 1,
        tipo_entrega: 'INICIAL',
      };
      estado.entregas.push(nuevaEntrega);
      return { rows: [{ id_entrega: nuevaEntrega.id_entrega }], rowCount: 1 } as QueryResult;
    }

    if (q.includes('UPDATE documentos') && q.includes("SET id_entrega = $1, estado = 'POR_VALIDAR'")) {
      const idEntrega = params?.[0] as number;
      const idSol = params?.[1] as number;
      let actualizados = 0;
      for (const d of estado.documentos) {
        if (d.id_solicitud === idSol && d.id_entrega === null) {
          d.id_entrega = idEntrega;
          d.estado = 'POR_VALIDAR';
          actualizados++;
        }
      }
      return { rows: [], rowCount: actualizados, command: 'UPDATE', oid: 0, fields: [] } as QueryResult;
    }

    if (q.includes('UPDATE solicitud_grado') && q.includes("SET estado = 'EN_PROCESO'")) {
      const idSol = params?.[0] as number;
      const fila = estado.solicitudes.find((s) => s.id_solicitud === idSol);
      if (fila) fila.estado = 'EN_PROCESO';
      return { rows: [], rowCount: fila ? 1 : 0, command: 'UPDATE', oid: 0, fields: [] } as QueryResult;
    }

    return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] } as QueryResult;
  };

  const clientMock = {
    query: vi.fn().mockImplementation(ejecutarQuery),
  } as unknown as PoolClient;

  return {
    estado,
    query: vi.fn().mockImplementation(ejecutarQuery),
    transaction: vi.fn().mockImplementation(async (cb: (c: PoolClient) => Promise<unknown>) => cb(clientMock)),
  };
}
