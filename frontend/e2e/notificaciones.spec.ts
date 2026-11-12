import { test, expect } from "@playwright/test";
import { API, conSolicitudReciente, sesionComo, revisarAxe } from "./soporte";

const comentarioCompleto = "Primera línea del comentario.\nSegunda línea con el mensaje completo.";
const avisos = [
    {
        id: "4",
        solicitudId: "1",
        documentoId: "10",
        tipo: "error",
        titulo: "No válido",
        msg: "Documento de identidad: no fue posible verificar la estructura. Sube un documento legible.",
        generado_por: "motor",
        leida: false,
    },
    {
        id: "3",
        tipo: "warning",
        titulo: "Plazo por vencer",
        msg: "Te queda poco tiempo para presentar toda la documentación (3 días).",
        generado_por: "system",
        leida: false,
    },
    {
        id: "2",
        tipo: "success",
        titulo: "Válido",
        msg: "Evaluación Banner: cumples con los requisitos académicos comprobados.",
        generado_por: "motor",
        leida: true,
    },
    {
        id: "1",
        solicitudId: "1",
        tipo: "info",
        titulo: "Nuevo comentario",
        msg: "La funcionaria te dejó un comentario: Revisa tus datos…",
        generado_por: "funcionario",
        leida: false,
    },
].map((n) => ({
    ...n,
    fecha: "2026-10-28",
    hora: "10:30:00",
    creadoEn: "2026-10-28T15:30:00.000Z",
}));

for (const tema of ["light", "dark"] as const)
    for (const ancho of [320, 1280]) {
        test(`avisos reales por tipo y actor, accesibles en ${tema} a ${ancho}px`, async ({
            page,
        }) => {
            await sesionComo(page, "estudiante");
            await page.emulateMedia({ colorScheme: tema });
            await page.setViewportSize({ width: ancho, height: 1000 });
            await page.route(`${API}/estudiante/notificaciones`, (r) =>
                r.fulfill({ json: { notificaciones: avisos, noLeidas: 3 } }),
            );
            await page.route(`${API}/estudiante/notificaciones?completas=1`, (r) =>
                r.fulfill({ json: {
                    notificaciones: avisos.map((n) => n.id === "1" ? { ...n, msg: comentarioCompleto } : n),
                    noLeidas: 3,
                } }),
            );
            await page.goto("/estudiante/home");
            const panel = page.getByRole("region", {
                name: "Notificaciones",
                exact: true,
            });
            await expect(panel).toContainText("3 sin leer");
            await expect(panel.getByRole("listitem")).toHaveCount(3);
            await expect(
                panel.getByRole("heading", { name: "No válido", exact: true }),
            ).toBeVisible();
            await expect(panel).toContainText("Análisis documental");
            await expect(panel).toContainText("Sistema");
            await panel
                .getByRole("link", { name: "Ver todas las notificaciones" })
                .click();
            await expect(page).toHaveURL(/\/estudiante\/notificaciones$/);
            const historial = page.getByRole("region", { name: "Historial de notificaciones" });
            await expect(historial.getByRole("listitem")).toHaveCount(4);
            await expect(historial).toContainText("Oficina de grados");
            await expect(historial.getByRole("heading", { level: 3 })).toHaveText([
                "No válido", "Plazo por vencer", "Válido", "Nuevo comentario",
            ]);
            await expect(historial.getByText("Primera línea del comentario.", { exact: false })).toHaveJSProperty("textContent", comentarioCompleto);
            await expect(historial.getByRole("link", { name: "Ver documento" })).toHaveAttribute("href", "/estudiante/preinscripcion?solicitud=1&documento=10");
            await expect(historial.getByRole("link", { name: "Ver solicitud" })).toHaveAttribute("href", "/estudiante/preinscripcion?solicitud=1");
            await expect(historial.locator("time").first()).toContainText("10:30");
            for (const tipo of ["success", "warning", "error", "info"])
                await expect(
                    historial.locator(`[data-tipo="${tipo}"]`),
                ).toHaveCount(1);
            await revisarAxe(page);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth - innerWidth,
                ),
            ).toBeLessThanOrEqual(0);
        });
    }

test("el resumen enlaza al mensaje completo con un ancla única", async ({ page }) => {
    await sesionComo(page, "estudiante");
    const aviso = avisos[3];
    await page.route(`${API}/estudiante/notificaciones`, (r) =>
        r.fulfill({ json: { notificaciones: [aviso], noLeidas: 1 } }),
    );
    await page.route(`${API}/estudiante/notificaciones?completas=1`, (r) =>
        r.fulfill({ json: { notificaciones: [{ ...aviso, msg: comentarioCompleto }], noLeidas: 1 } }),
    );
    await page.goto("/estudiante/home");
    const panel = page.getByRole("region", {
        name: "Notificaciones",
        exact: true,
    });
    const enlace = panel.getByRole("link", {
        name: "Ver notificación completa: Nuevo comentario",
    });
    await expect(enlace).toHaveAttribute("href", "/estudiante/notificaciones#notificacion-1");
    await enlace.click();
    await expect(page).toHaveURL(/\/estudiante\/notificaciones#notificacion-1$/);
    const completo = page.locator("#notificacion-1");
    await expect(completo).toContainText(comentarioCompleto);
    await expect(completo).toBeFocused();
});

test("un estado vacío no inventa avisos del OCR ni de la funcionaria", async ({
    page,
}) => {
    await sesionComo(page, "estudiante");
    await page.goto("/estudiante/home");
    const panel = page.getByRole("region", {
        name: "Notificaciones",
        exact: true,
    });
    await expect(panel).toContainText("No tienes notificaciones.");
    await expect(panel.getByRole("listitem")).toHaveCount(0);
    await page.route(`${API}/estudiante/notificaciones?completas=1`, (r) =>
        r.fulfill({ json: { notificaciones: [], noLeidas: 0 } }),
    );
    const menu = page.getByRole("navigation", { name: "Principal", exact: true });
    await menu.getByRole("button").press("Enter");
    await menu.getByRole("link", { name: "Notificaciones", exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/estudiante\/notificaciones$/);
    await expect(page.getByRole("region", { name: "Historial de notificaciones" }))
        .toContainText("No tienes notificaciones.");
});

test("marca como leída solo después de confirmarlo y conserva el estado tras recargar", async ({
    page,
}) => {
    await sesionComo(page, "estudiante");
    let leida = false;
    await page.route(`${API}/estudiante/notificaciones`, (r) =>
        r.fulfill({
            json: {
                notificaciones: [{ ...avisos[0], leida }],
                noLeidas: leida ? 0 : 1,
            },
        }),
    );
    let confirmar!: () => void;
    const espera = new Promise<void>((r) => {
        confirmar = r;
    });
    await page.route(`${API}/estudiante/notificaciones/4/leida`, async (r) => {
        expect(r.request().method()).toBe("PATCH");
        await espera;
        leida = true;
        await r.fulfill({ json: { id: "4", leida: true } });
    });
    try {
        await page.goto("/estudiante/home");
        const panel = page.getByRole("region", {
            name: "Notificaciones",
            exact: true,
        });
        await expect(panel).toContainText("1 sin leer");
        await panel
            .getByRole("button", { name: "Marcar como leída: No válido" })
            .click();
        await expect(panel).toContainText("1 sin leer");
        confirmar();
        await expect(panel).toContainText("0 sin leer");
        await expect(
            panel.getByRole("button", { name: "Marcar como leída: No válido" }),
        ).toHaveCount(0);
        await page.reload();
        await expect(panel).toContainText("0 sin leer");
        await expect(panel.getByText("Leída", { exact: true })).toBeVisible();
    } finally {
        confirmar();
    }
});

test("un fallo al marcar no simula éxito ni borra la notificación", async ({
    page,
}) => {
    await sesionComo(page, "estudiante");
    await page.route(`${API}/estudiante/notificaciones`, (r) =>
        r.fulfill({ json: { notificaciones: [avisos[0]], noLeidas: 1 } }),
    );
    await page.route(`${API}/estudiante/notificaciones/4/leida`, (r) =>
        r.fulfill({ status: 503, json: { message: "Error interno" } }),
    );
    await page.goto("/estudiante/home");
    const panel = page.getByRole("region", {
        name: "Notificaciones",
        exact: true,
    });
    await panel
        .getByRole("button", { name: "Marcar como leída: No válido" })
        .click();
    await expect(panel.getByRole("alert")).toContainText(
        "No fue posible marcar",
    );
    await expect(panel).toContainText("1 sin leer");
    await expect(
        panel.getByRole("button", { name: "Marcar como leída: No válido" }),
    ).toBeEnabled();
});

test("un error de notificaciones no bloquea el home y permite reintentar", async ({
    page,
}) => {
    await sesionComo(page, "estudiante");
    await conSolicitudReciente(page);
    let fallar = true;
    await page.route(`${API}/estudiante/notificaciones`, (r) =>
        fallar
            ? r.fulfill({ status: 503, json: { message: "SQL privado" } })
            : r.fulfill({ json: { notificaciones: avisos, noLeidas: 3 } }),
    );
    await page.goto("/estudiante/home");
    const panel = page.getByRole("region", {
        name: "Notificaciones",
        exact: true,
    });
    await expect(panel.getByRole("alert")).toContainText(
        "No fue posible consultar",
    );
    await expect(panel).not.toContainText("SQL privado");
    await expect(
        page.getByRole("heading", {
            name: "Mi solicitud de grado", exact: true,
        }),
    ).toBeVisible();
    fallar = false;
    await panel
        .getByRole("button", { name: "Reintentar notificaciones" })
        .click();
    await expect(panel).toContainText("3 sin leer");
});

test("una consulta detenida termina con un mensaje y mantiene el resto del home disponible", async ({
    page,
}) => {
    await sesionComo(page, "estudiante");
    await conSolicitudReciente(page);
    await page.clock.install();
    let liberar!: () => void;
    const espera = new Promise<void>((r) => {
        liberar = r;
    });
    await page.route(`${API}/estudiante/notificaciones`, async (r) => {
        await espera;
        await r.abort().catch(() => {});
    });
    try {
        const peticion = page.waitForRequest(
            (r) => r.url() === `${API}/estudiante/notificaciones`,
        );
        await page.goto("/estudiante/home");
        await peticion;
        await page.clock.fastForward(8001);
        const panel = page.getByRole("region", {
            name: "Notificaciones",
            exact: true,
        });
        await expect(panel.getByRole("alert")).toContainText("tardó demasiado");
        await expect(
            page.getByRole("heading", {
                name: "Mi solicitud de grado", exact: true,
            }),
        ).toBeVisible();
    } finally {
        liberar();
    }
});

test("el texto guardado se muestra como texto, sin ejecutar HTML", async ({
    page,
}) => {
    await sesionComo(page, "estudiante");
    const msg = '<img src=x onerror="window.__inyectado=true">';
    await page.route(`${API}/estudiante/notificaciones`, (r) =>
        r.fulfill({
            json: { notificaciones: [{ ...avisos[0], msg }], noLeidas: 1 },
        }),
    );
    await page.goto("/estudiante/home");
    const panel = page.getByRole("region", {
        name: "Notificaciones",
        exact: true,
    });
    await expect(panel).toContainText(msg);
    expect(
        await page.evaluate(() => Object.hasOwn(window, "__inyectado")),
    ).toBe(false);
});

test("un listado malformado presenta error en lugar de inventar notificaciones", async ({
    page,
}) => {
    await sesionComo(page, "estudiante");
    await page.route(`${API}/estudiante/notificaciones`, (r) =>
        r.fulfill({
            json: { notificaciones: [{ titulo: "Sin datos requeridos" }] },
        }),
    );
    await page.goto("/estudiante/home");
    const panel = page.getByRole("region", {
        name: "Notificaciones",
        exact: true,
    });
    await expect(panel.getByRole("alert")).toContainText("inválida");
    await expect(panel.getByRole("listitem")).toHaveCount(0);
});


test("la página completa permite reintentar y refleja la lectura al volver al inicio", async ({ page }) => {
    await sesionComo(page, "estudiante");
    let fallar = true;
    let leida = false;
    const respuesta = () => ({ notificaciones: [{ ...avisos[0], leida }], noLeidas: leida ? 0 : 1 });
    await page.route(`${API}/estudiante/notificaciones`, (r) => r.fulfill({ json: respuesta() }));
    await page.route(`${API}/estudiante/notificaciones?completas=1`, (r) =>
        fallar ? r.fulfill({ status: 503 }) : r.fulfill({ json: respuesta() }),
    );
    await page.route(`${API}/estudiante/notificaciones/4/leida`, (r) => {
        leida = true;
        return r.fulfill({ json: { id: "4", leida: true } });
    });
    await page.goto("/estudiante/notificaciones");
    const historial = page.getByRole("region", { name: "Historial de notificaciones" });
    await expect(historial.getByRole("alert")).toContainText("No fue posible consultar");
    fallar = false;
    await historial.getByRole("button", { name: "Reintentar notificaciones" }).click();
    await historial.getByRole("button", { name: "Marcar como leída: No válido" }).press("Enter");
    await expect(historial).toContainText("0 sin leer");
    await page.getByRole("link", { name: "Inicio", exact: true }).click();
    await expect(page.getByRole("region", { name: "Notificaciones", exact: true })).toContainText("0 sin leer");
});

test("la página de notificaciones redirige a la funcionaria sin consultar el historial", async ({ page }) => {
    await sesionComo(page, "funcionario");
    let consultas = 0;
    await page.route(`${API}/estudiante/notificaciones?completas=1`, (r) => {
        consultas++;
        return r.abort();
    });
    await page.goto("/estudiante/notificaciones");
    await expect(page).toHaveURL(/\/funcionario\/dashboard$/);
    expect(consultas).toBe(0);
});

test("el enlace de documento lleva el foco al documento de la solicitud", async ({ page }) => {
    await sesionComo(page, "estudiante");
    await page.route(`${API}/estudiante/notificaciones?completas=1`, (r) =>
        r.fulfill({ json: { notificaciones: [avisos[0]], noLeidas: 1 } }),
    );
    await page.route(`${API}/estudiante/solicitudes/1/analisis`, (r) =>
        r.fulfill({ json: DETALLE_ESTUDIANTE }),
    );
    await page.goto("/estudiante/notificaciones");
    await page.getByRole("link", { name: "Ver documento" }).click();
    await expect(page.locator("#documento-10")).toBeFocused();
});
