import { expect, test } from '@playwright/test';
import { API, sesionComo } from './soporte';
const RUTA = '/estudiante/iniciar_preinscripcion?nivel=PREGRADO';
const BOTON = 'Guardar para continuar después';

test.describe('Tarea 33: confirmaciones y errores de borrador', () => {
    for (const [status, cuerpo, mensaje] of [
        [401, {}, 'Tu sesión ha expirado'],
        [400, { codigo: 'BORRADOR_CAMPO_REQUERIDO', campos: [{ campo: 'perfil.tipoDocumento', motivo: 'FALTANTE' }] }, 'falta completar el tipo de documento de identidad'],
        [422, { codigo: 'BORRADOR_DATOS_INVALIDOS', campos: [{ campo: 'perfil.fechaNacimiento', motivo: 'INVALIDO' }] }, 'la fecha de nacimiento contiene un valor inválido'],
        [503, {}, 'El servicio de guardado no está disponible'],
        [500, { message: 'SELECT secreto FROM tabla; stacktrace' }, 'Ocurrió un inconveniente'],
    ] as const) {
        test(`HTTP ${status}: conserva datos y permite reintentar`, async ({ page }) => {
            await sesionComo(page, 'estudiante');
            await page.goto(RUTA);
            const nombres = page.locator('#campo-nombres');
            await nombres.fill('Prueba conservada');
            await page.route(`${API}/solicitudes/borrador`, async ruta => {
                if (ruta.request().method() === 'POST') return ruta.fulfill({ status, json: cuerpo });
                return ruta.fallback();
            });
            await page.getByRole('button', { name: BOTON }).click();
            const alerta = page.getByRole('alert').filter({ hasText: mensaje });
            await expect(alerta).toBeVisible();
            await expect(nombres).toHaveValue('Prueba conservada');
            await expect(page.getByRole('status').filter({ hasText: 'Borrador guardado' })).toHaveCount(0);
            await expect(alerta).not.toContainText(/SELECT|stacktrace/);
            // Reintento exitoso con el mismo formulario, sin volver a escribir.
            await page.route(`${API}/solicitudes/borrador`, ruta => ruta.request().method() === 'POST'
                ? ruta.fulfill({ status: 201, json: { ok: true, id_solicitud: 1, guardadoEn: new Date().toISOString() } }) : ruta.fallback());
            await alerta.getByRole('button', { name: 'Reintentar' }).click();
            await expect(page.getByRole('status').filter({ hasText: 'Tu borrador se guardó correctamente' })).toBeVisible();
            await expect(alerta).toHaveCount(0);
            await expect(nombres).toHaveValue('Prueba conservada');
        });
    }

    test('conexión fallida después de un éxito no deja visible la confirmación anterior', async ({ page }) => {
        await sesionComo(page, 'estudiante');
        await page.goto(RUTA);
        await page.locator('#campo-nombres').fill('Primera versión');
        await page.getByRole('button', { name: BOTON }).click();
        await expect(page.getByRole('status')).toContainText('Tu borrador se guardó correctamente');
        await page.locator('#campo-nombres').fill('Segunda versión');
        await expect(page.getByRole('status')).toHaveText('Tienes cambios sin guardar.');
        await page.route(`${API}/solicitudes/borrador`, ruta => ruta.request().method() === 'POST' ? ruta.abort('failed') : ruta.fallback());
        await page.getByRole('button', { name: BOTON }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'No pudimos conectar con el servidor' })).toBeVisible();
        await expect(page.getByRole('status')).not.toContainText('se guardó correctamente');
        await expect(page.locator('#campo-nombres')).toHaveValue('Segunda versión');
    });

    test('muestra Guardando mientras espera y no duplica el POST', async ({ page }) => {
        await sesionComo(page, 'estudiante');
        await page.goto(RUTA);
        await page.locator('#campo-nombres').fill('Prueba');
        let liberar!: () => void;
        const espera = new Promise<void>(r => { liberar = r; });
        let peticiones = 0;
        await page.route(`${API}/solicitudes/borrador`, async ruta => {
            if (ruta.request().method() !== 'POST') return ruta.fallback();
            peticiones++;
            await espera;
            await ruta.fulfill({ status: 201, json: { ok: true, id_solicitud: 1, guardadoEn: new Date().toISOString() } });
        });
        await page.getByRole('button', { name: BOTON }).click();
        try {
            await expect(page.getByRole('status')).toHaveText('Guardando tu borrador…');
            await expect(page.getByRole('button', { name: 'Guardando…', exact: true })).toBeDisabled();
            expect(peticiones).toBe(1);
        } finally { liberar(); }
        await expect(page.getByRole('status')).toContainText('Tu borrador se guardó correctamente');
    });

    test('Guardar y salir muestra el error dentro del diálogo y conserva el formulario', async ({ page }) => {
        await sesionComo(page, 'estudiante');
        await page.goto(RUTA);
        await page.locator('#campo-nombres').fill('Dato sin guardar');
        await page.route(`${API}/solicitudes/borrador`, ruta => ruta.request().method() === 'POST'
            ? ruta.fulfill({ status: 500, json: { message: 'SQL privado' } }) : ruta.fallback());
        await page.getByRole('navigation', { name: 'Ruta' }).getByRole('link', { name: 'Inicio' }).click();
        const dialogo = page.getByRole('dialog', { name: 'Tienes cambios sin guardar' });
        await dialogo.getByRole('button', { name: 'Guardar y salir' }).click();
        await expect(dialogo.getByRole('alert')).toContainText('Ocurrió un inconveniente');
        await dialogo.getByRole('button', { name: 'Seguir aquí' }).click();
        await expect(page.locator('#campo-nombres')).toHaveValue('Dato sin guardar');
        await expect(page).toHaveURL(RUTA);
    });
});
