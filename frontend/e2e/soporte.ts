import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// Ayudantes compartidos por las pruebas: sesión simulada y revisión de accesibilidad.

export type Rol = "estudiante" | "funcionario";

export const API = "http://localhost:3000/api";

/** Usuarios sintéticos; no son los del backend. */
export const USUARIOS: Record<Rol, { id: number; username: string; name: string; role: Rol }> = {
    estudiante: { id: 1, username: "estudiante@prueba.co", name: "Ana Prueba", role: "estudiante" },
    funcionario: { id: 2, username: "funcionario@prueba.co", name: "Rafael Prueba", role: "funcionario" },
};

export const TEMAS = ["light", "dark"] as const;

/** 320 px equivale a un zoom del 400 % en 1280 (WCAG 1.4.10, reflujo). */
export const ANCHOS = [320, 360, 768, 1280] as const;

/** Simula el backend: la sesión (o su ausencia), el cierre de sesión y el chequeo de salud. */
export async function sesionComo(page: Page, rol: Rol | null, nombre?: string): Promise<void> {
    await page.route(`${API}/auth/me`, (ruta) =>
        rol
            ? ruta.fulfill({ status: 200, json: { user: { ...USUARIOS[rol], ...(nombre ? { name: nombre } : {}) } } })
            : ruta.fulfill({ status: 401, json: { message: "Sesión no válida o expirada" } }),
    );
    await page.route(`${API}/auth/logout`, (ruta) =>
        ruta.fulfill({ status: 201, json: { message: "Sesión cerrada correctamente" } }),
    );
    await page.route(`${API}/health`, (ruta) =>
        ruta.fulfill({
            status: 200,
            json: { status: "ok", service: "CheckU API", message: "Backend conectado correctamente" },
        }),
    );
    await page.route(`${API}/estudiante/solicitud`, (ruta) =>
        rol === "estudiante"
            ? ruta.fulfill({
                  status: 200,
                  json: {
                      tiene_solicitud: true,
                      solicitud: { id_solicitud: 1, tipo_solicitud: "PREGRADO", estado: "BORRADOR" },
                  },
              })
            : rol === "funcionario"
              ? ruta.fulfill({ status: 403, json: { message: "Acceso restringido a estudiantes" } })
              : ruta.fulfill({ status: 401, json: { message: "Sesión no válida o expirada" } }),
    );
    await page.route(`${API}/solicitudes/enviar`, (ruta) =>
        rol === "estudiante"
            ? ruta.fulfill({
                  status: 201,
                  json: {
                      ok: true,
                      id_solicitud: 1,
                      id_entrega: 1,
                      estado: "EN_PROCESO",
                      mensaje: "Preinscripción registrada correctamente. Pendiente de análisis.",
                  },
              })
            : rol === "funcionario"
              ? ruta.fulfill({ status: 403, json: { message: "Acceso restringido a estudiantes" } })
              : ruta.fulfill({ status: 401, json: { message: "Sesión no válida o expirada" } }),
    );
    await page.route(`${API}/solicitudes/borrador`, (ruta) =>
        rol === "estudiante"
            ? ruta.fulfill({
                  status: 201,
                  json: {
                      ok: true,
                      guardadoEn: new Date().toISOString(),
                  },
              })
            : rol === "funcionario"
              ? ruta.fulfill({ status: 403, json: { message: "Acceso restringido a estudiantes" } })
              : ruta.fulfill({ status: 401, json: { message: "Sesión no válida o expirada" } }),
    );
}

/** Revisa una página con axe (WCAG 2.2 A/AA) y que no tenga scroll horizontal. */
export async function revisarPagina(
    page: Page,
    ruta: string,
    tema: "light" | "dark",
    ancho: number,
): Promise<void> {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await page.goto(ruta);
    await page.locator('main#contenido:not([aria-busy="true"])').waitFor();

    await revisarAxe(page);

    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde, "scroll horizontal en píxeles").toBeLessThanOrEqual(0);
}

/** axe (WCAG 2.2 A/AA) sobre el estado actual de la página: sirve también con un diálogo o un menú abiertos. */
export async function revisarAxe(page: Page): Promise<void> {
    const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
    const resumen = violations.map((v) => ({ id: v.id, nodos: v.nodes.map((n) => n.target.join(" ")) }));
    expect(resumen, "violaciones de axe").toEqual([]);
}
