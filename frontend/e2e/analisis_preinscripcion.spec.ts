import { expect, test } from '@playwright/test';
import { API, sesionComo, revisarAxe } from './soporte';
import { enviarPreinscripcion } from '@/app/estudiante/iniciar_preinscripcion/api';
import { borradorVacio } from '@/app/estudiante/iniciar_preinscripcion/tipos';
import { documentosRequeridos } from '@/app/estudiante/documentos-requeridos';

const detalle = {
  id: '123', estadoSolicitud: 'EN_PROCESO', estadoAnalisis: 'registrado',
  estudiante: { codigo: 'T00000001', nombre: 'Estudiante Prueba', nivel: 'PREGRADO', correo: 'prueba@example.org',
    tipoDocumento: 'CC', numeroDocumento: '1000000001', fechaNacimiento: '', programa: 'Ingeniería', facultad: '', telefono: '', ciudad: '', fechaSolicitud: '' },
  informacion: { nombres: 'Estudiante', apellidos: 'Prueba', codigoEstudiantil: 'T00000001', correo: 'prueba@example.org',
    tipoDocumento: 'CC', numeroDocumento: '1000000001', fechaNacimiento: '', genero: '', telefonoFijo: '', telefonoCelular: '',
    departamento: '', ciudad: '', direccion: '', modalidad: 'PRESENCIAL', programa: 'Ingeniería' },
  documentos: [ { id: '7', tipo: 'academic_evaluation', nombre: 'Evaluación de Grado (Banner)', descripcion: 'evaluacion-prueba.pdf',
    resultados: [{ estado: 'por_revisar', mensaje: 'Consulta las observaciones del análisis documental.' }], resubmission_allowed: false,
    analisis: { extracted_data: { code_student: { value: 'T00000001', confidence: 1 } },
      rules: [{ rule: 'creditos', result: 'no_evaluable', message: 'Requiere revisión humana.' }], errors: [] } },
    { id: '8', tipo: 'paz_y_salvo_bib', nombre: 'Paz y Salvo de Biblioteca', descripcion: 'biblioteca-prueba.pdf',
      resultados: [{ estado: 'por_revisar', mensaje: 'Validación pendiente de integración. Requiere revisión humana.' }], resubmission_allowed: false,
      analisis: { extracted_data: {}, rules: [], errors: [] } } ],
  politicaReenvios: { usados: 0, limite: 0, zona: 'America/Bogota' },
};

test('envía los bytes PDF en multipart y reintenta tras un fallo sin simular éxito', async () => {
  const original = globalThis.fetch;
  const b = borradorVacio('PREGRADO', 'multipart@example.org');
  for (const d of documentosRequeridos('PREGRADO', false)) b.documentos[d.id] = {
    id: d.id, nombre: `${d.id}.pdf`, tamano: 8, archivo: new File(['%PDF-1.4'], `${d.id}.pdf`, { type: 'application/pdf' }),
  };
  let llamadas = 0;
  globalThis.fetch = async (_url, opciones) => {
    llamadas++;
    expect(opciones?.credentials).toBe('include');
    expect(opciones?.headers).toBeUndefined();
    const form = opciones?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.getAll('documentos')).toHaveLength(5);
    expect(await (form.getAll('documentos')[0] as File).text()).toBe('%PDF-1.4');
    expect(String(form.get('datos'))).not.toContain('"archivo"');
    return llamadas === 1 ? Response.json({ message: 'interno SQL' }, { status: 503 }) : Response.json({ ok: true });
  };
  try {
    const primero = await enviarPreinscripcion(b, 'multipart-clave', 'ninguno');
    expect(primero.ok).toBe(false); expect(JSON.stringify(primero)).not.toContain('SQL');
    expect(await enviarPreinscripcion(b, 'multipart-clave', 'ninguno')).toEqual({ ok: true });
    expect(llamadas).toBe(2);
  } finally { globalThis.fetch = original; }
});

test('exige volver a seleccionar los PDF de un borrador recargado', async () => {
  const b = borradorVacio('PREGRADO', 'solo-metadatos@example.org');
  for (const d of documentosRequeridos('PREGRADO', false)) b.documentos[d.id] = { id: d.id, nombre: 'prueba.pdf', tamano: 8 };
  const r = await enviarPreinscripcion(b, 'sin-pdf-clave', 'ninguno');
  expect(r.ok).toBe(false); expect(JSON.stringify(r)).toContain('Selecciona nuevamente');
});

for (const tema of ['light', 'dark'] as const) {
  test(`consulta resultados después de recargar, muestra campos persistidos y no inventa datos en ${tema}`, async ({ page }) => {
    await sesionComo(page, 'estudiante');
    await page.emulateMedia({ colorScheme: tema });
    await page.setViewportSize({ width: 360, height: 900 });
    await page.route(`${API}/estudiante/solicitud`, r => r.fulfill({ json: { tiene_solicitud: true, solicitud: { id_solicitud: 123, tipo_solicitud: 'PREGRADO', estado: 'EN_PROCESO' } } }));
    let consultas = 0;
    await page.route(`${API}/estudiante/solicitud/analisis`, r => { consultas++; return r.fulfill({ json: detalle }); });
    await page.goto('/estudiante/preinscripcion');
    await expect(page.getByRole('heading', { name: 'Detalle de mi preinscripción' })).toBeVisible();
    await expect(page.getByText('Validación pendiente de integración.', { exact: false })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Detalle de mi preinscripción' })).toBeVisible();
    expect(consultas).toBeGreaterThanOrEqual(2);
    await page.getByRole('button', { name: 'Ver análisis automático' }).first().click();
    await expect(page.getByRole('dialog')).toContainText('T00000001');
    await expect(page.getByRole('dialog')).toContainText('Requiere revisión humana');
    await expect(page.getByRole('dialog')).not.toContainText('287');
    await revisarAxe(page);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });
}

test('sin resultados muestra pendiente, nunca todos válidos', async ({ page }) => {
  await sesionComo(page, 'estudiante');
  await page.route(`${API}/estudiante/solicitud`, r => r.fulfill({ json: { tiene_solicitud: true, solicitud: { estado: 'EN_PROCESO' } } }));
  await page.route(`${API}/estudiante/solicitud/analisis`, r => r.fulfill({ json: { ...detalle, estadoAnalisis: 'pendiente', documentos: [] } }));
  await page.goto('/estudiante/preinscripcion');
  await expect(page.getByRole('heading', { name: 'Análisis documental pendiente' })).toBeVisible();
  await expect(page.getByText('Todos los documentos fueron validados correctamente.')).toHaveCount(0);
});
