import { expect, test } from '@playwright/test';
import { API, sesionComo } from './soporte';

const detalle = {
  id: '123', estadoSolicitud: 'EN_PROCESO', estadoAnalisis: 'pendiente',
  estudiante: { codigo: 'T00000001', nombre: 'Estudiante Prueba', nivel: 'PREGRADO', correo: 'prueba@example.org',
    tipoDocumento: 'CC', numeroDocumento: '1000000001', fechaNacimiento: '', programa: 'Ingeniería', facultad: '', telefono: '', ciudad: '', fechaSolicitud: '' },
  informacion: { nombres: 'Estudiante', apellidos: 'Prueba', codigoEstudiantil: 'T00000001', correo: 'prueba@example.org',
    tipoDocumento: 'CC', numeroDocumento: '1000000001', fechaNacimiento: '', genero: '', telefonoFijo: '', telefonoCelular: '',
    departamento: '', ciudad: '', direccion: '', modalidad: 'PRESENCIAL', programa: 'Ingeniería' },
  documentos: [], politicaReenvios: { usados: 0, limite: 3, zona: 'America/Bogota' },
};

test('el detalle se renderiza aunque la consulta redundante de solicitud quede pendiente', async ({ page }) => {
  await sesionComo(page, 'estudiante');
  let redundantes = 0;
  await page.route(`${API}/estudiante/solicitud`, () => { redundantes++; return new Promise<void>(() => {}); });
  await page.route(`${API}/estudiante/solicitud/analisis`, r => r.fulfill({ json: detalle }));
  await page.goto('/estudiante/preinscripcion');
  await expect(page.getByRole('heading', { name: 'Análisis documental pendiente' })).toBeVisible({timeout: 5000});
  expect(redundantes).toBe(0);
});

test('muestra la estructura y estado de carga sin un error falso mientras llegan los datos', async ({ page }) => {
  await sesionComo(page, 'estudiante');
  let liberar!: () => void;
  const espera = new Promise<void>(r => { liberar = r; });
  await page.route(`${API}/estudiante/solicitud/analisis`, async r => { await espera; await r.fulfill({ json: detalle }); });
  try {
    await page.goto('/estudiante/preinscripcion');
    await expect(page.getByRole('heading', { name: 'Detalle de mi preinscripción' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Cargando');
    await expect(page.getByText('No fue posible cargar la preinscripción. Intenta recargar la página.')).toHaveCount(0);
    liberar();
    await expect(page.getByRole('heading', { name: 'Análisis documental pendiente' })).toBeVisible();
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
  } finally { liberar(); }
});

for (const pendiente of ['sesión', 'detalle'] as const) {
  test(`sale de la carga y permite reintentar si queda pendiente la consulta de ${pendiente}`, async ({ page }) => {
    await sesionComo(page, 'estudiante');
    await page.clock.install();
    let liberar!: () => void;
    const espera = new Promise<void>(r => { liberar = r; });
    const rutaPendiente = pendiente === 'sesión' ? `${API}/auth/me` : `${API}/estudiante/solicitud/analisis`;
    await page.route(rutaPendiente, async r => { await espera; await r.abort().catch(() => {}); });
    try {
      const peticion = page.waitForRequest(r => r.url() === rutaPendiente);
      await page.goto('/estudiante/preinscripcion');
      await peticion; // La estructura puede existir antes de hidratar: esperar a que se inicie la consulta.
      await expect(page.getByRole('status')).toContainText('Cargando');
      if (pendiente === 'detalle') await expect(page.getByText('Ana Prueba', {exact: true})).toBeVisible();
      await page.clock.fastForward(15_001);
      await expect(page.locator('main').getByRole('alert')).toContainText('La consulta tardó demasiado');
      await expect(page.getByRole('button', {name: 'Reintentar'})).toBeVisible();
      await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
    } finally { liberar(); }
  });
}

test('un error de consulta se recupera sin duplicar el detalle al reintentar', async ({ page }) => {
  await sesionComo(page, 'estudiante');
  let fallar = true, consultas = 0;
  await page.route(`${API}/estudiante/solicitud/analisis`, r => {
    consultas++;
    return fallar ? r.fulfill({status: 503, json: {message: 'Base no disponible'}}) : r.fulfill({json: detalle});
  });
  await page.goto('/estudiante/preinscripcion');
  await expect(page.locator('main').getByRole('alert')).toContainText('No fue posible cargar');
  const antes = consultas;
  fallar = false;
  await page.getByRole('button', {name: 'Reintentar'}).click();
  await expect(page.getByRole('heading', {name: 'Análisis documental pendiente'})).toBeVisible();
  expect(consultas - antes).toBe(1);
});

test('sin una solicitud registrada redirige a bienvenida usando el 404 del detalle', async ({ page }) => {
  await sesionComo(page, 'estudiante');
  // La preinscripción debe llegar al detalle (ENVIADA); la bienvenida que recibe el 404
  // consulta de nuevo y allí ya no existe solicitud, así que permanece en bienvenida.
  await page.route(`${API}/solicitudes/estado`, ruta => {
    const referer = ruta.request().headers()['referer'] ?? '';
    const desdePreinscripcion = referer.includes('/estudiante/preinscripcion');
    return ruta.fulfill({
      status: 200,
      json: desdePreinscripcion
        ? { ok: true, estado: 'ENVIADA', destino: '/estudiante/preinscripcion', nivel: 'PREGRADO' }
        : { ok: true, estado: 'SIN_SOLICITUD', destino: '/estudiante/bienvenida' },
    });
  });
  await page.route(`${API}/estudiante/solicitud/analisis`, r => r.fulfill({status: 404, json: {message: 'No hay preinscripción registrada.'}}));
  await page.goto('/estudiante/preinscripcion');
  await expect(page).toHaveURL(/\/estudiante\/bienvenida$/);
});

test('sin sesión redirige al acceso y no consulta datos privados', async ({ page }) => {
  await sesionComo(page, null);
  let consultas = 0;
  await page.route(`${API}/estudiante/solicitud/analisis`, r => { consultas++; return r.fulfill({json: detalle}); });
  await page.goto('/estudiante/preinscripcion');
  await expect(page).toHaveURL(/\/$/);
  expect(consultas).toBe(0);
});

test('el funcionario se redirige antes de consultar el detalle del estudiante', async ({ page }) => {
  await sesionComo(page, 'funcionario');
  let consultas = 0;
  await page.route(`${API}/estudiante/solicitud/analisis`, r => { consultas++; return r.fulfill({json: detalle}); });
  await page.goto('/estudiante/preinscripcion');
  await expect(page).toHaveURL(/\/funcionario\/dashboard$/);
  expect(consultas).toBe(0);
});

test('una respuesta ilegible termina en un error recuperable, sin carga permanente', async ({ page }) => {
  await sesionComo(page, 'estudiante');
  await page.route(`${API}/estudiante/solicitud/analisis`, r => r.fulfill({contentType: 'application/json', body: '{incompleto'}));
  await page.goto('/estudiante/preinscripcion');
  await expect(page.locator('main').getByRole('alert')).toContainText('No fue posible cargar');
  await expect(page.getByRole('button', {name: 'Reintentar'})).toBeVisible();
});
