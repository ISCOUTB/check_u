import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { API, DETALLE_ESTUDIANTE, DETALLE_FUNCIONARIA, LISTADO_ESTUDIANTE, revisarAxe, sesionComo, TEMAS } from "./soporte";

// Tarea 50: el Paz y Salvo se consulta en ALMA (simulado) y su resultado se muestra en una tabla,
// igual en el inicio del estudiante, en su preinscripción y en el detalle de la funcionaria.

/** Resultado de Biblioteca con la forma del motor, escenario combinado (datos inventados). */
const COMBINADO = {
    estado: "no_cumple",
    paz_y_salvo: false,
    consultado_en: "2026-11-04T10:00:00-05:00",
    mensaje: "Tiene 1 préstamo(s) pendiente(s) de devolución. Tiene 1 multa(s) pendiente(s). Tiene 2 solicitud(es) pendiente(s) en Biblioteca.",
    fuente: "alma_simulada",
    identidad: { coincide: true, campos_distintos: [] },
    criterios: {
        prestamos: { resultado: "no_cumple", motivo: null, mensaje: "Tiene 1 préstamo(s) pendiente(s) de devolución.", pendientes: 1 },
        multas: { resultado: "no_cumple", motivo: null, mensaje: "Tiene 1 multa(s) pendiente(s).", pendientes: 1, valor_total: 15000, moneda: "COP" },
        solicitudes: { resultado: "no_cumple", motivo: null, mensaje: "Tiene 2 solicitud(es) pendiente(s) en Biblioteca.", pendientes: 2 },
        opcion_grado: { resultado: "no_evaluable", motivo: "source_pending", mensaje: "La fuente de datos de la opción de grado aún no está definida.", entregada: null, informativo: true },
    },
    acciones_requeridas: [
        "Devolver los préstamos pendientes en Biblioteca.",
        "Pagar los cargos pendientes en Biblioteca.",
        "Cerrar o cancelar las solicitudes pendientes en Biblioteca.",
    ],
};

const INCONSISTENTE = {
    ...COMBINADO,
    estado: "inconsistente",
    paz_y_salvo: null,
    mensaje: "Los datos de Biblioteca (ALMA) no coinciden con los registrados en CheckU: número de documento.",
    identidad: { coincide: false, campos_distintos: ["numero_documento"] },
    criterios: {},
    acciones_requeridas: [],
};

function documentoPaz(resultado: object | null, permitido = true, cambios: Record<string, unknown> = {}) {
    return {
        id: "12", nombre: "Paz y Salvo de Biblioteca", tipo: "paz_y_salvo_bib", orden: 1, version: 1,
        fileName: null, descripcion: null, archivoDisponible: false, resubmission_allowed: permitido,
        estado: "NO_VALIDO", origen: "CONSULTA", bibliotecaResultado: resultado,
        resultados: [{ estado: "no_valido", mensaje: (resultado as { mensaje: string } | null)?.mensaje ?? "Paz y Salvo no válido." }], analisis: null,
        ...cambios,
    };
}

/** Paz y Salvo subido en PDF antes de la Tarea 50: origen ARCHIVO, sin resultado de Biblioteca. */
const PAZ_EN_PDF = { origen: "ARCHIVO", fileName: "paz_y_salvo.pdf", descripcion: "paz_y_salvo.pdf", archivoDisponible: true };

/** Resolución manual de la funcionaria sobre una consulta sin respuesta de Biblioteca. */
const SIN_RESPUESTA = { ...COMBINADO, estado: "no_evaluable", paz_y_salvo: null, fuente: "sin_respuesta", mensaje: "No fue posible consultar a Biblioteca. Una funcionaria lo revisará.", criterios: {}, acciones_requeridas: [] };
const COMENTARIO_FUNCIONARIA = "Marcado como no válido por la funcionaria. Debe entregar el carné en Biblioteca.";
const RESUELTO_A_MANO = { resultados: [{ estado: "no_valido", mensaje: COMENTARIO_FUNCIONARIA }] };

/** Detalle del estudiante cuyo Paz y Salvo es una consulta a Biblioteca. */
function detalleEstudiante(resultado: object | null, cambios: Record<string, unknown> = {}) {
    return {
        ...structuredClone(DETALLE_ESTUDIANTE),
        documentos: [
            ...DETALLE_ESTUDIANTE.documentos.filter((d) => d.tipo !== "paz_y_salvo_bib"),
            documentoPaz(resultado, true, cambios),
        ],
    };
}

async function prepararEstudiante(
    page: Page,
    resultado: object | null,
    { cambios = {}, fallarPrimera = false }: { cambios?: Record<string, unknown>; fallarPrimera?: boolean } = {},
) {
    await sesionComo(page, "estudiante");
    const detalle = detalleEstudiante(resultado, cambios);
    await page.route(`${API}/estudiante/solicitudes`, (r) =>
        r.fulfill({ json: { solicitudes: [{ ...LISTADO_ESTUDIANTE.solicitudes[0], id: "1", estado: "NO_VALIDA" }] } }),
    );
    for (const ruta of ["/estudiante/solicitud/analisis", "/estudiante/solicitudes/1/analisis"])
        await page.route(`${API}${ruta}`, (r) => r.fulfill({ json: detalle }));
    const cuerpos: unknown[] = [];
    await page.route(`${API}/estudiante/solicitudes/1/paz-y-salvo/consulta`, async (r) => {
        cuerpos.push(r.request().postDataJSON());
        if (fallarPrimera && cuerpos.length === 1) return r.abort("failed");
        await r.fulfill({ status: 201, json: { ok: true, id_solicitud: 1, id_entrega: 2, estado: "VALIDA" } });
    });
    return cuerpos;
}

async function revisarTabla(page: Page) {
    const tabla = page.getByRole("table", { name: "Consulta de Paz y Salvo en Biblioteca" }).first();
    await expect(tabla).toBeVisible();
    for (const encabezado of ["Tipo de obligación", "Detalle", "Cantidad", "Estado"])
        await expect(tabla.getByRole("columnheader", { name: encabezado })).toBeVisible();
    await expect(tabla.getByRole("row", { name: /Préstamos activos/ })).toContainText("1");
    await expect(tabla.getByRole("row", { name: /Multas/ })).toContainText("$15.000 COP");
    await expect(tabla.getByRole("row", { name: /Solicitudes pendientes/ })).toContainText("2");
    await expect(tabla.getByRole("row", { name: /Opción de grado \(informativo\)/ })).toBeVisible();
    return tabla;
}

for (const tema of TEMAS)
    test(`inicio del estudiante: tabla de Biblioteca y «Consultar de nuevo» (${tema})`, async ({ page }) => {
        const cuerpos = await prepararEstudiante(page, COMBINADO);
        await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
        await page.setViewportSize({ width: 1280, height: 1000 });
        await page.goto("/estudiante/home");
        const tarjeta = page.locator("#mi-solicitud");
        await revisarTabla(page);
        await expect(tarjeta.getByRole("button", { name: /Subir nueva versión: Paz y Salvo/ })).toHaveCount(0);
        // axe sobre la tarjeta: el botón «Solicitudes» del inicio (Tarea 46) ya falla en main.
        const { violations } = await new AxeBuilder({ page })
            .include("#mi-solicitud")
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
        expect(violations.map((v) => v.id)).toEqual([]);
        await tarjeta.getByRole("button", { name: "Consultar de nuevo: Paz y Salvo de Biblioteca" }).click();
        await expect.poll(() => cuerpos.length).toBe(1);
        expect((cuerpos[0] as { clave: string }).clave).toMatch(/^[\w-]{8,128}$/);
    });

test("inicio a 320 px: la tabla no desborda la página", async ({ page }) => {
    await prepararEstudiante(page, COMBINADO);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/estudiante/home");
    await revisarTabla(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("un resultado inconsistente muestra el motivo, sin tabla", async ({ page }) => {
    await prepararEstudiante(page, INCONSISTENTE);
    await page.goto("/estudiante/home");
    const tarjeta = page.locator("#mi-solicitud");
    await expect(tarjeta).toContainText("no coinciden con los registrados en CheckU");
    await expect(page.getByRole("table", { name: "Consulta de Paz y Salvo en Biblioteca" })).toHaveCount(0);
});

test("preinscripción del estudiante: la tabla está en el análisis y «Consultar de nuevo» reemplaza «Volver a cargar»", async ({ page }) => {
    const cuerpos = await prepararEstudiante(page, COMBINADO);
    await page.goto("/estudiante/preinscripcion?solicitud=1");
    await page.locator("article", { hasText: "Paz y Salvo de Biblioteca" }).getByRole("button", { name: "Ver análisis automático" }).click();
    const dialogo = page.getByRole("dialog");
    await revisarTabla(page);
    await revisarAxe(page);
    await dialogo.getByRole("button", { name: /Cerrar/ }).first().click();
    await page.getByRole("button", { name: "Consultar de nuevo: Paz y Salvo de Biblioteca" }).click();
    await expect.poll(() => cuerpos.length).toBe(1);
});

test("detalle de la funcionaria: misma tabla y su propio «Consultar de nuevo»", async ({ page }) => {
    await sesionComo(page, "funcionario");
    const detalle = { ...structuredClone(DETALLE_FUNCIONARIA), estadoSolicitud: "NO_VALIDA", documentos: [...DETALLE_FUNCIONARIA.documentos, documentoPaz(COMBINADO)] };
    await page.route(`${API}/funcionario/solicitudes/1`, (r) => r.fulfill({ json: detalle }));
    let llamadas = 0;
    await page.route(`${API}/funcionario/solicitudes/1/paz-y-salvo/consulta`, async (r) => {
        llamadas++;
        expect(r.request().method()).toBe("POST");
        await r.fulfill({ status: 201, json: { ok: true, estadoSolicitud: "VALIDA" } });
    });
    await page.goto("/funcionario/detalle_preinscripcion/1");
    await revisarTabla(page);
    await revisarAxe(page);
    await page.getByRole("button", { name: "Consultar de nuevo: Paz y Salvo de Biblioteca" }).click();
    await expect.poll(() => llamadas).toBe(1);
    await expect(page.getByRole("status")).toContainText("Consulta de Biblioteca actualizada");
});

// Revisión final (Tarea 50): Paz y Salvo en PDF de solicitudes anteriores, resolución manual y reintentos.

test("un Paz y Salvo en PDF de antes de la Tarea 50 se vuelve a consultar, no se sube", async ({ page }) => {
    const cuerpos = await prepararEstudiante(page, null, { cambios: PAZ_EN_PDF });
    await page.goto("/estudiante/home");
    const tarjeta = page.locator("#mi-solicitud");
    await expect(tarjeta.getByRole("button", { name: "Consultar de nuevo: Paz y Salvo de Biblioteca" })).toBeVisible();
    await expect(tarjeta.getByRole("button", { name: /Subir nueva versión: Paz y Salvo/ })).toHaveCount(0);
    await page.goto("/estudiante/preinscripcion?solicitud=1");
    const articulo = page.locator("article", { hasText: "Paz y Salvo de Biblioteca" });
    await expect(articulo.getByRole("button", { name: "Volver a cargar" })).toHaveCount(0);
    await articulo.getByRole("button", { name: "Consultar de nuevo: Paz y Salvo de Biblioteca" }).click();
    await expect.poll(() => cuerpos.length).toBe(1);
});

test("la funcionaria también vuelve a consultar un Paz y Salvo en PDF de antes de la Tarea 50", async ({ page }) => {
    await sesionComo(page, "funcionario");
    const detalle = { ...structuredClone(DETALLE_FUNCIONARIA), estadoSolicitud: "NO_VALIDA", documentos: [...DETALLE_FUNCIONARIA.documentos, documentoPaz(null, true, PAZ_EN_PDF)] };
    await page.route(`${API}/funcionario/solicitudes/1`, (r) => r.fulfill({ json: detalle }));
    await page.goto("/funcionario/detalle_preinscripcion/1");
    await expect(page.getByRole("button", { name: "Consultar de nuevo: Paz y Salvo de Biblioteca" })).toBeVisible();
});

test("la resolución manual de la funcionaria se ve junto a la tabla en el inicio y en su detalle", async ({ page }) => {
    await prepararEstudiante(page, SIN_RESPUESTA, { cambios: RESUELTO_A_MANO });
    await page.goto("/estudiante/home");
    await expect(page.locator("#mi-solicitud")).toContainText(COMENTARIO_FUNCIONARIA);
    await sesionComo(page, "funcionario");
    const detalle = { ...structuredClone(DETALLE_FUNCIONARIA), estadoSolicitud: "NO_VALIDA", documentos: [...DETALLE_FUNCIONARIA.documentos, documentoPaz(SIN_RESPUESTA, true, RESUELTO_A_MANO)] };
    await page.route(`${API}/funcionario/solicitudes/1`, (r) => r.fulfill({ json: detalle }));
    await page.goto("/funcionario/detalle_preinscripcion/1");
    await expect(page.locator("article", { hasText: "Paz y Salvo de Biblioteca" })).toContainText(COMENTARIO_FUNCIONARIA);
});

for (const vista of ["/estudiante/home", "/estudiante/preinscripcion?solicitud=1"])
    test(`un reintento de «Consultar de nuevo» tras un fallo de red reutiliza la clave (${vista})`, async ({ page }) => {
        const cuerpos = await prepararEstudiante(page, COMBINADO, { fallarPrimera: true });
        await page.goto(vista);
        const boton = page.getByRole("button", { name: "Consultar de nuevo: Paz y Salvo de Biblioteca" });
        await boton.click();
        await expect.poll(() => cuerpos.length).toBe(1);
        await expect(boton).toBeEnabled();
        await boton.click();
        await expect.poll(() => cuerpos.length).toBe(2);
        const [primera, segunda] = cuerpos as { clave: string }[];
        expect(segunda.clave).toBe(primera.clave);
    });

// Tarea 50 (opción A): la funcionaria resuelve a mano un Paz y Salvo Inconsistente con ALMA.
test("la funcionaria puede marcar un Paz y Salvo Inconsistente", async ({ page }) => {
    await sesionComo(page, "funcionario");
    const paz = documentoPaz(INCONSISTENTE, true, { estado: "INCONSISTENTE", resultados: [{ estado: "inconsistente", mensaje: INCONSISTENTE.mensaje }] });
    const detalle = { ...structuredClone(DETALLE_FUNCIONARIA), estadoSolicitud: "INCONSISTENTE", documentos: [...DETALLE_FUNCIONARIA.documentos, paz] };
    await page.route(`${API}/funcionario/solicitudes/1`, (r) => r.fulfill({ json: detalle }));
    const cuerpos: unknown[] = [];
    await page.route(`${API}/funcionario/documentos/12/resolucion`, async (r) => {
        cuerpos.push(r.request().postDataJSON());
        await r.fulfill({ status: 201, json: { ok: true, estadoSolicitud: "VALIDA" } });
    });
    await page.goto("/funcionario/detalle_preinscripcion/1");
    await expect(page.getByRole("button", { name: "Marcar no válido: Paz y Salvo de Biblioteca" })).toBeVisible();
    await page.getByRole("button", { name: "Marcar válido: Paz y Salvo de Biblioteca" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect.poll(() => cuerpos.length).toBe(1);
    expect(cuerpos[0]).toMatchObject({ resultado: "VALIDO" });
});
