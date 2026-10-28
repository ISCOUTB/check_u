import { expect, test } from '@playwright/test';
import { API, revisarAxe, sesionComo } from './soporte';
const RUTA = '/estudiante/iniciar_preinscripcion?nivel=PREGRADO';
const PERIODO = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Grados de diciembre de 2026',
    fechaInicio: '2026-11-01', fechaFin: '2026-11-30', fechaGraduacion: '2026-12-15', fechaCorte: '2026-11-23', estado: 'ABIERTO' };
const FUTURO = { ...PERIODO, id: '22222222-2222-4222-8222-222222222222', nombre: 'Grados de marzo de 2027',
    fechaInicio: '2027-02-01', fechaFin: '2027-02-28', fechaCorte: '2027-02-21' };

test('Tarea 35: disponible antes de guardar, asignado después y conservado tras F5', async ({ page }) => {
    await sesionComo(page, 'estudiante');
    let borrador: Record<string, unknown> | null = null;
    const periodos = () => ({ fechaActual: '2026-11-22', periodoAsignado: borrador ? PERIODO : null,
        periodoDisponible: borrador ? null : PERIODO, proximosPeriodos: [FUTURO] });
    await page.route(`${API}/solicitudes/borrador`, async route => {
        if (route.request().method() === 'POST') {
            const datos = route.request().postDataJSON();
            expect(datos).not.toHaveProperty('id_periodo');
            expect(datos).not.toHaveProperty('periodos');
            borrador = { ...datos, guardadoEn: '2026-11-22T17:00:00.000Z' };
            return route.fulfill({ status: 201, json: { ok: true, id_solicitud: 1, guardadoEn: borrador.guardadoEn, periodos: periodos() } });
        }
        return route.fulfill({ json: { ok: true, id_solicitud: borrador ? 1 : null, estado: borrador ? 'BORRADOR' : null,
            borrador, periodos: periodos() } });
    });
    await page.goto(RUTA);
    const seccion = page.locator('section[aria-label="Periodo de inscripción"]');
    await page.getByRole('button', { name: 'Ver información del periodo de inscripción' }).click();
    await expect(seccion).toContainText('Se asignará automáticamente al guardar');
    await expect(seccion).toContainText('23/11/2026');
    await expect(seccion).toContainText(FUTURO.nombre);
    await expect(seccion.getByRole('combobox')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver información del periodo de inscripción' })).toBeFocused();
    await page.locator('#campo-nombres').fill('Prueba de periodo');
    await page.getByRole('button', { name: 'Guardar para continuar después' }).click();
    await expect(seccion).toContainText(PERIODO.nombre);
    await page.getByRole('button', { name: 'Ver información del periodo de inscripción' }).click();
    await expect(page.getByRole('dialog')).toContainText('Periodo de inscripción asignado');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(seccion).toContainText(PERIODO.nombre);
    await page.getByRole('button', { name: 'Ver información del periodo de inscripción' }).click();
    await expect(page.getByRole('dialog')).toContainText('Periodo de inscripción asignado');
    await page.keyboard.press('Escape');
    await expect(page.locator('#campo-nombres')).toHaveValue('Prueba de periodo');
});

test('Tarea 35: futuros informativos y guardado sin periodo conserva el formulario', async ({ page }) => {
    await sesionComo(page, 'estudiante');
    await page.route(`${API}/solicitudes/borrador`, route => route.request().method() === 'POST'
        ? route.fulfill({ status: 409, json: { codigo: 'SIN_PERIODO_DISPONIBLE', message: 'SQL no debe mostrarse' } })
        : route.fulfill({ json: { ok: true, estado: null, borrador: null, periodos: { fechaActual: '2026-11-23',
            periodoAsignado: null, periodoDisponible: null, proximosPeriodos: [FUTURO] } } }));
    await page.goto(RUTA);
    const seccion = page.locator('section[aria-label="Periodo de inscripción"]');
    await expect(seccion).toContainText('Sin periodo disponible');
    await page.getByRole('button', { name: 'Ver información del periodo de inscripción' }).click();
    await expect(seccion).toContainText('Actualmente no hay un periodo');
    await expect(seccion).toContainText(FUTURO.nombre);
    await expect(seccion.getByRole('combobox')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('#campo-nombres').fill('Conservar información');
    await page.getByRole('button', { name: 'Guardar para continuar después' }).click();
    const alerta = page.getByRole('alert').filter({ hasText: 'Actualmente no hay un periodo' });
    await expect(alerta).toBeVisible();
    await expect(alerta).not.toContainText('SQL');
    await expect(page.locator('#campo-nombres')).toHaveValue('Conservar información');
    await expect(page.getByRole('status').filter({ hasText: 'Tu borrador se guardó correctamente' })).toHaveCount(0);
});
for (const tema of ['light', 'dark'] as const) {
    test(`Tarea 35: periodo cerrado accesible y sin desborde a 320 px en ${tema}`, async ({ page }) => {
        await sesionComo(page, 'estudiante');
        await page.setViewportSize({ width: 320, height: 900 });
        await page.emulateMedia({ colorScheme: tema });
        await page.route(`${API}/solicitudes/borrador`, route => route.fulfill({ json: { ok: true, estado: null, borrador: null,
            periodos: { fechaActual: '2026-12-01', periodoAsignado: { ...PERIODO, estado: 'CERRADO' },
                periodoDisponible: null, proximosPeriodos: [] } } }));
        await page.goto(RUTA);
        const seccion = page.locator('section[aria-label="Periodo de inscripción"]');
        await expect(page.getByRole('dialog')).not.toBeVisible();
        await page.getByRole('button', { name: 'Ver información del periodo de inscripción' }).click();
        await expect(seccion).toContainText('Tu solicitud conserva su asignación');
        await expect(seccion).toContainText('No hay próximos periodos');
        await revisarAxe(page);
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.mouse.click(1, 1);
        await expect(page.getByRole('dialog')).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Ver información del periodo de inscripción' })).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    });
}
test('Tarea 35: fallo de consulta sin fechas inventadas', async ({ page }) => {
    await sesionComo(page, 'estudiante');
    await page.route(`${API}/solicitudes/borrador`, route => route.fulfill({ status: 503, json: { message: 'Error SQL' } }));
    await page.goto(RUTA);
    await expect(page.getByRole('alert').filter({ hasText: 'No fue posible cargar tu preinscripción' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Periodo de inscripción asignado' })).toHaveCount(0);
    await expect(page.getByText(PERIODO.nombre)).toHaveCount(0);
});
