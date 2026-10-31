import { expect, test, type Page } from '@playwright/test';
import { API, DETALLE_FUNCIONARIA, revisarAxe, sesionComo } from './soporte';
const RUTA = '/estudiante/preinscripcion';
const BASE = {
    ...DETALLE_FUNCIONARIA,
    cancelacion: {
        permitida: true,
        canceladaEn: null as string | null,
        fechaActual: '2026-10-31',
        nombrePeriodo: 'Grados de noviembre',
        fechaCorte: '2026-11-03',
        diasRestantes: 3 as number | null,
    },
};
async function preparar(page: Page, estado = 'EN_PROCESO') {
    await sesionComo(page, 'estudiante');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let detalle = { ...structuredClone(BASE), estadoSolicitud: estado };
    let envios = 0;
    await page.route(`${API}/solicitudes/estado`, (r) =>
        r.fulfill({
            json: {
                ok: true,
                estado:
                    detalle.estadoSolicitud === 'CANCELADA'
                        ? 'SIN_SOLICITUD'
                        : 'ENVIADA',
                destino:
                    detalle.estadoSolicitud === 'CANCELADA'
                        ? '/estudiante/bienvenida'
                        : '/estudiante/home',
            },
        }),
    );
    for (const ruta of [
        '/estudiante/solicitud/analisis',
        '/estudiante/solicitudes/1/analisis',
    ])
        await page.route(`${API}${ruta}`, (r) => r.fulfill({ json: detalle }));
    await page.route(
        `${API}/estudiante/solicitudes/1/cancelacion`,
        async (r) => {
            envios++;
            expect(r.request().method()).toBe('POST');
            detalle = {
                ...detalle,
                estadoSolicitud: 'CANCELADA',
                cancelacion: {
                    ...detalle.cancelacion,
                    permitida: false,
                    canceladaEn: '2026-10-31T14:00:00Z',
                },
                documentos: detalle.documentos.map((d) => ({
                    ...d,
                    resubmission_allowed: false,
                })),
                politicaReenvios: { ...detalle.politicaReenvios, limite: 0 },
            };
            await r.fulfill({
                status: 201,
                json: {
                    ok: true,
                    id: '1',
                    estado: 'CANCELADA',
                    canceladaEn: detalle.cancelacion.canceladaEn,
                },
            });
        },
    );
    return { envios: () => envios, detalle: () => detalle };
}
for (const estado of [
    'BORRADOR',
    'POR_REVISAR',
    'VALIDA',
    'NO_VALIDA',
    'INCONSISTENTE',
    'CERRADA',
    'CANCELADA',
]) {
    test(`no ofrece cancelación en ${estado}`, async ({ page }) => {
        await preparar(page, estado);
        await page.goto(`${RUTA}?solicitud=1`);
        await expect(
            page.getByRole('heading', { name: 'Detalle de mi preinscripción' }),
        ).toBeVisible();
        await expect(
            page.getByRole('region', {
                name: 'Estado de la preinscripción',
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', {
                name: 'Cancelar preinscripción',
                exact: true,
            }),
        ).toHaveCount(0);
    });
}
for (const tema of ['light', 'dark'] as const)
    for (const ancho of [320, 1280]) {
        test(`confirmación y detalle accesibles sin desborde en ${tema} a ${ancho}px`, async ({
            page,
        }) => {
            await preparar(page);
            await page.setViewportSize({ width: ancho, height: 1000 });
            await page.emulateMedia({
                colorScheme: tema,
                reducedMotion: 'reduce',
            });
            await page.goto(RUTA);
            await page
                .getByRole('button', {
                    name: 'Cancelar preinscripción',
                    exact: true,
                })
                .click();
            const dialogo = page.getByRole('dialog', {
                name: 'Cancelar preinscripción',
                exact: true,
            });
            await expect(dialogo).toContainText(
                'Esta acción no se puede deshacer.',
            );
            await expect(dialogo).toContainText('Grados de noviembre');
            await expect(dialogo).toContainText('3 días');
            await expect(dialogo).toContainText('03/11/2026');
            await expect(dialogo).toContainText('revisión humana');
            await revisarAxe(page);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth - innerWidth,
                ),
            ).toBeLessThanOrEqual(0);
            await page
                .getByRole('button', { name: 'Conservar preinscripción' })
                .click();
            await revisarAxe(page);
        });
    }
test('rechazar o cerrar la confirmación conserva la solicitud y devuelve el foco', async ({
    page,
}) => {
    const app = await preparar(page);
    await page.goto(RUTA);
    const abrir = page.getByRole('button', {
        name: 'Cancelar preinscripción',
        exact: true,
    });
    await abrir.click();
    await page
        .getByRole('button', { name: 'Conservar preinscripción' })
        .click();
    await expect(abrir).toBeFocused();
    expect(app.envios()).toBe(0);
    await abrir.click();
    await page.keyboard.press('Escape');
    await expect(abrir).toBeFocused();
    expect(app.envios()).toBe(0);
});
test('confirmar cambia el detalle, bloquea reenvíos y conserva la consulta tras F5', async ({
    page,
}) => {
    const app = await preparar(page);
    await page.goto(RUTA);
    await page
        .getByRole('button', { name: 'Cancelar preinscripción', exact: true })
        .click();
    expect(app.envios()).toBe(0);
    await page
        .getByRole('button', { name: 'Confirmar cancelación', exact: true })
        .click();
    await expect(page).toHaveURL(`${RUTA}?solicitud=1`);
    await expect(
        page.getByRole('heading', {
            name: 'Preinscripción cancelada',
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Volver a cargar' }),
    ).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Historial de preinscripciones' })).toHaveCount(0);
    expect(app.envios()).toBe(1);
    await page.reload();
    await expect(
        page.getByRole('heading', {
            name: 'Preinscripción cancelada',
            exact: true,
        }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: /Ver análisis automático/ })
        .first()
        .click();
    await expect(page.getByRole('dialog')).toContainText(
        'Nombre completo del estudiante',
    );
});
test('no anuncia cancelación ni duplica clics mientras el servidor no confirma', async ({
    page,
}) => {
    await preparar(page);
    let envios = 0;
    let liberar!: () => void;
    const espera = new Promise<void>((r) => {
        liberar = r;
    });
    await page.route(
        `${API}/estudiante/solicitudes/1/cancelacion`,
        async (r) => {
            envios++;
            await espera;
            await r
                .fulfill({
                    status: 503,
                    json: { message: 'Servicio temporalmente no disponible.' },
                })
                .catch(() => {});
        },
    );
    try {
        await page.goto(RUTA);
        await page
            .getByRole('button', {
                name: 'Cancelar preinscripción',
                exact: true,
            })
            .click();
        await page
            .getByRole('button', { name: 'Confirmar cancelación', exact: true })
            .click();
        await expect(
            page.getByRole('button', { name: 'Cancelando...', exact: true }),
        ).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(
            page.getByRole('heading', {
                name: 'Preinscripción cancelada',
                exact: true,
            }),
        ).toHaveCount(0);
        expect(envios).toBe(1);
        liberar();
        await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
            'Servicio temporalmente',
        );
        await expect(
            page.getByRole('heading', {
                name: 'Preinscripción cancelada',
                exact: true,
            }),
        ).toHaveCount(0);
    } finally {
        liberar();
    }
});
test('el tiempo de espera informa un resultado desconocido y permite consultar de nuevo', async ({
    page,
}) => {
    await preparar(page);
    await page.clock.install();
    let liberar!: () => void;
    const espera = new Promise<void>((r) => {
        liberar = r;
    });
    await page.route(
        `${API}/estudiante/solicitudes/1/cancelacion`,
        async (r) => {
            await espera;
            await r.abort().catch(() => {});
        },
    );
    try {
        await page.goto(RUTA);
        await page
            .getByRole('button', {
                name: 'Cancelar preinscripción',
                exact: true,
            })
            .click();
        const envio = page.waitForRequest(
            `${API}/estudiante/solicitudes/1/cancelacion`,
        );
        await page
            .getByRole('button', { name: 'Confirmar cancelación', exact: true })
            .click();
        await envio;
        await page.clock.fastForward(15001);
        await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
            'Consulta el estado antes de reintentar',
        );
        await expect(
            page.getByRole('heading', {
                name: 'Preinscripción cancelada',
                exact: true,
            }),
        ).toHaveCount(0);
    } finally {
        liberar();
    }
});
for (const ruta of ['/estudiante/bienvenida', '/estudiante/home', `${RUTA}?solicitud=1`]) {
    test(`no muestra ni consulta el bloque de historial en ${ruta}`, async ({page}) => {
        await preparar(page, ruta.endsWith('/home') ? 'EN_PROCESO' : 'CANCELADA');
        const consultas: string[] = [];
        page.on('request', r => { if (r.url() === `${API}/estudiante/solicitudes`) consultas.push(r.url()); });
        await page.goto(ruta);
        await expect(page.getByRole('heading', {level:1})).toBeVisible();
        await expect(page.getByRole('region', {name:'Historial de preinscripciones'})).toHaveCount(0);
        expect(consultas).toEqual([]);
    });
}
test('un detalle histórico ajeno o inexistente no muestra la solicitud actual ni redirige', async ({
    page,
}) => {
    await preparar(page);
    await page.route(`${API}/estudiante/solicitudes/999/analisis`, (r) =>
        r.fulfill({
            status: 404,
            json: { message: 'Preinscripción no disponible.' },
        }),
    );
    await page.goto(`${RUTA}?solicitud=999`);
    await expect(page.locator('main').getByRole('alert')).toContainText(
        'No fue posible cargar',
    );
    await expect(
        page.getByRole('button', {
            name: 'Cancelar preinscripción',
            exact: true,
        }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(`${RUTA}?solicitud=999`);
});
for (const [dias, fechaCorte, fechaActual, texto] of [
    [1, '2026-11-01', '2026-10-31', '1 día'],
    [0, '2026-10-29', '2026-10-31', '0 días'],
] as const) {
    test(`muestra el plazo institucional ${texto} sin inventar tiempo adicional`, async ({
        page,
    }) => {
        const app = await preparar(page);
        await page.route(`${API}/estudiante/solicitud/analisis`, (r) =>
            r.fulfill({
                json: {
                    ...app.detalle(),
                    cancelacion: {
                        ...app.detalle().cancelacion,
                        diasRestantes: dias,
                        fechaCorte,
                        fechaActual,
                    },
                },
            }),
        );
        await page.goto(RUTA);
        await page
            .getByRole('button', {
                name: 'Cancelar preinscripción',
                exact: true,
            })
            .click();
        const dialogo = page.getByRole('dialog');
        await expect(dialogo).toContainText(texto);
        if (dias === 0)
            await expect(dialogo).toContainText(
                'El plazo para presentar los requisitos ya venció.',
            );
        await expect(
            dialogo.getByRole('button', { name: 'Confirmar cancelación' }),
        ).toBeEnabled();
    });
}
test('un periodo sin fechas no produce números ni fechas inventados en la confirmación', async ({
    page,
}) => {
    const app = await preparar(page);
    await page.route(`${API}/estudiante/solicitud/analisis`, (r) =>
        r.fulfill({
            json: {
                ...app.detalle(),
                cancelacion: {
                    ...app.detalle().cancelacion,
                    nombrePeriodo: null,
                    fechaCorte: null,
                    diasRestantes: null,
                },
            },
        }),
    );
    await page.goto(RUTA);
    await page
        .getByRole('button', { name: 'Cancelar preinscripción', exact: true })
        .click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('No se pudo determinar el plazo');
    await expect(
        dialogo.getByText('Fecha límite:', { exact: false }),
    ).toHaveCount(0);
});
