import { expect, test, type Page } from "@playwright/test";
import { abrirFormulario, captura, entrar, ESTUDIANTE, FUNCIONARIA, reiniciar, sembrar, sesion, sql, type SolicitudSembrada } from "./soporte";

// Escenarios 9, 10 y 11 de la #133: dashboard, periodos y filtros de la funcionaria.
// Las solicitudes de otros estudiantes se siembran por SQL porque el login solo admite un estudiante.

const A = "Periodo A";
const B = "Periodo B";
const SIEMBRA: SolicitudSembrada[] = [
    { correo: "e1", nivel: "PREGRADO", estado: "VALIDA", periodo: A, hace: 1 },
    { correo: "e2", nivel: "PREGRADO", estado: "VALIDA", periodo: A, hace: 5 },
    { correo: "e3", nivel: "PREGRADO", estado: "NO_VALIDA", periodo: A, hace: 5 },
    { correo: "e4", nivel: "PREGRADO", estado: "INCONSISTENTE", periodo: A, hace: 9 },
    { correo: "e5", nivel: "PREGRADO", estado: "POR_REVISAR", periodo: A, hace: 9 },
    { correo: "e6", nivel: "PREGRADO", estado: "ACEPTADA", periodo: A, hace: 9 },
    { correo: "e7", nivel: "PREGRADO", estado: "CERRADA", periodo: A, hace: 9 },
    { correo: "e8", nivel: "PREGRADO", estado: "CANCELADA", periodo: A, hace: 9 },
    { correo: "e9", nivel: "POSGRADO", estado: "VALIDA", periodo: A, hace: 2 },
    { correo: "e10", nivel: "POSGRADO", estado: "NO_VALIDA", periodo: A, hace: 2 },
    { correo: "e11", nivel: "PREGRADO", estado: "NO_VALIDA", periodo: B, hace: 3 },
];

function sembrarDashboard(): void {
    sql(`INSERT INTO periodos_grado (nombre, fecha_inicio, fecha_fin, fecha_graduacion) VALUES
        ('${A}', CURRENT_DATE - 30, CURRENT_DATE + 40, CURRENT_DATE + 60),
        ('${B}', CURRENT_DATE - 25, CURRENT_DATE + 45, CURRENT_DATE + 65);`);
    sembrar(SIEMBRA);
}

async function abrirDashboard(page: Page): Promise<void> {
    await entrar(page, FUNCIONARIA);
    await expect(page).toHaveURL(/\/funcionario\/dashboard/);
    await expect(page.locator("#periodo-grado option").nth(1)).toBeAttached();
    const boton = page.getByRole("button", { name: "Mostrar filtros" });
    if (await boton.count()) await boton.click();
}

async function elegirPeriodo(page: Page, nombre: string): Promise<void> {
    await page.locator("#periodo-grado").selectOption({ label: await page.locator("#periodo-grado option", { hasText: nombre }).innerText() });
}

function filas(page: Page) {
    return page.getByRole("region", { name: "Tabla de solicitudes de grado" }).locator("tbody tr");
}

/** Lo que dice la BD: lo que debe mostrar el dashboard (sin borradores ni canceladas). */
function enBd(periodo: string, nivel: string, estado?: string): number {
    return Number(
        sql(`SELECT count(*) FROM solicitud_grado s JOIN periodos_grado p ON p.id=s.id_periodo
             WHERE p.nombre='${periodo}' AND s.tipo_solicitud='${nivel}' AND s.estado NOT IN ('BORRADOR','CANCELADA')
             ${estado ? `AND s.estado='${estado}'` : ""}`)[0],
    );
}

test.describe("Escenario 9: dashboard de la funcionaria", () => {
    test.beforeEach(async () => {
        await reiniciar();
        sembrarDashboard();
    });

    test("E9 los indicadores coinciden con las solicitudes de la base de datos", async ({ page }) => {
        await abrirDashboard(page);
        await elegirPeriodo(page, A);
        await expect(filas(page)).toHaveCount(enBd(A, "PREGRADO"));
        await captura(page, "09-a-dashboard-pregrado-periodo-a");
        const contadores: Record<string, string> = { "Válidas": "VALIDA", "No válidas": "NO_VALIDA", Inconsistentes: "INCONSISTENTE", "Por revisar": "POR_REVISAR", Aceptadas: "ACEPTADA", Anuladas: "CERRADA" };
        for (const [titulo, estado] of Object.entries(contadores)) {
            const contador = page.locator("button[data-estado]").filter({ hasText: new RegExp(`^${titulo}`) });
            await expect.soft(contador, `Contador ${titulo}`).toContainText(String(enBd(A, "PREGRADO", estado)));
        }
        await page.locator("#nivel-academico").selectOption("POSGRADO");
        await expect(filas(page)).toHaveCount(enBd(A, "POSGRADO"));
        await captura(page, "09-b-dashboard-posgrado-periodo-a");
        await elegirPeriodo(page, B);
        await page.locator("#nivel-academico").selectOption("PREGRADO");
        await expect(filas(page)).toHaveCount(enBd(B, "PREGRADO"));
        await expect(page.getByText("Distribución de solicitudes").first()).toBeVisible();
        await captura(page, "09-c-dashboard-pregrado-periodo-b");
    });
});

test.describe("Escenario 11: filtrado de solicitudes", () => {
    test.beforeEach(async () => {
        await reiniciar();
        sembrarDashboard();
    });

    test("E11 los filtros funcionan solos y combinados", async ({ page }) => {
        await abrirDashboard(page);
        // Periodo
        await elegirPeriodo(page, B);
        await expect(filas(page)).toHaveCount(1);
        await elegirPeriodo(page, A);
        // Nivel
        await page.locator("#nivel-academico").selectOption("POSGRADO");
        await expect(filas(page)).toHaveCount(2);
        await page.locator("#nivel-academico").selectOption("PREGRADO");
        await expect(filas(page)).toHaveCount(7);
        // Estado
        await page.getByRole("button", { name: "No válidas", exact: true }).click();
        await expect(filas(page)).toHaveCount(1);
        await captura(page, "11-a-filtro-estado");
        await page.getByRole("button", { name: "Todas", exact: true }).click();
        // Rango de fechas: del día -6 al -4 hay dos solicitudes de pregrado (enviadas hace 5 días).
        const dia = (hace: number) => sql(`SELECT ((now() AT TIME ZONE 'America/Bogota')::date - ${hace})::text`)[0];
        await page.getByLabel("Fecha inicial").fill(dia(6));
        await page.getByLabel("Fecha final").fill(dia(4));
        await page.getByRole("button", { name: "Aplicar fechas" }).click();
        await expect(filas(page)).toHaveCount(2);
        await captura(page, "11-b-filtro-rango");
        // Combinados: periodo + nivel + rango + estado.
        await page.getByRole("button", { name: "Válidas", exact: true }).click();
        await expect(filas(page)).toHaveCount(1);
        await captura(page, "11-c-filtros-combinados");
        await page.getByRole("button", { name: "Limpiar fechas" }).click();
        await expect(filas(page)).toHaveCount(2);
        // Sin periodo: documenta si se puede consultar sin elegirlo.
        await page.locator("#periodo-grado").selectOption("");
        await captura(page, "11-d-sin-periodo");
        await expect.soft(page.getByRole("heading", { name: "Selecciona un periodo" }), "La #133 pide usar cada filtro individualmente; sin periodo no hay resultados.").toHaveCount(0);
    });
});

test.describe("Escenario 10: administración de periodos", () => {
    test.beforeEach(reiniciar);

    async function formulario(page: Page, datos: { nombre: string; inicio: string; fin: string; graduacion: string }) {
        await page.getByLabel("Nombre del periodo").fill(datos.nombre);
        await page.getByLabel("Fecha de inicio").fill(datos.inicio);
        await page.getByLabel("Fecha de finalización").fill(datos.fin);
        await page.getByLabel("Fecha de graduación").fill(datos.graduacion);
    }
    const mensaje = (page: Page) => page.locator("#mensaje-periodo");

    test("E10 crea, edita y valida los periodos", async ({ page, browser }) => {
        await abrirDashboard(page);
        if (await page.getByLabel("Nombre del periodo").isHidden()) await page.getByRole("button", { name: /periodos/i }).first().click();

        // Crear con datos válidos.
        await formulario(page, { nombre: "Grados 2027-1", inicio: "2027-01-10", fin: "2027-03-01", graduacion: "2027-04-01" });
        await page.getByRole("button", { name: "Registrar periodo" }).click();
        await expect(mensaje(page)).toHaveAttribute("role", "status");
        await captura(page, "10-a-periodo-creado");
        expect(sql("SELECT nombre, estado FROM periodos_grado WHERE nombre='Grados 2027-1'")[0]).toBe("Grados 2027-1|ABIERTO");

        // Fechas inválidas.
        await formulario(page, { nombre: "Fin antes de inicio", inicio: "2027-06-10", fin: "2027-06-01", graduacion: "2027-08-01" });
        await page.getByRole("button", { name: "Registrar periodo" }).click();
        await expect(mensaje(page)).toContainText("anterior a la fecha de finalización");
        await captura(page, "10-b-fin-antes-de-inicio");
        await formulario(page, { nombre: "Graduación antes de fin", inicio: "2027-06-01", fin: "2027-07-01", graduacion: "2027-06-15" });
        await page.getByRole("button", { name: "Registrar periodo" }).click();
        await expect(mensaje(page)).toContainText("posterior a la fecha de finalización");
        await captura(page, "10-c-graduacion-antes-de-fin");

        // Duplicado: mismas fechas de recepción.
        await formulario(page, { nombre: "Copia", inicio: "2027-01-10", fin: "2027-03-01", graduacion: "2027-05-01" });
        await page.getByRole("button", { name: "Registrar periodo" }).click();
        await expect(mensaje(page)).toContainText("Ya existe un periodo");
        await captura(page, "10-d-periodo-duplicado");

        // Duplicado de nombre con otras fechas (se documenta qué hace).
        await formulario(page, { nombre: "Grados 2027-1", inicio: "2027-09-01", fin: "2027-10-01", graduacion: "2027-11-01" });
        await page.getByRole("button", { name: "Registrar periodo" }).click();
        await expect(mensaje(page)).toContainText("Ya existe un periodo");
        await captura(page, "10-e-nombre-duplicado");
        expect(sql("SELECT count(*) FROM periodos_grado WHERE nombre='Grados 2027-1'")[0], "No debe haber dos periodos con el mismo nombre.").toBe("1");

        // Editar y cerrar: el cambio se refleja en la lista y en la BD.
        const lista = page.getByRole("list", { name: "Periodos de grado registrados" });
        await lista.locator("li", { hasText: "Grados de prueba" }).getByRole("button", { name: /Editar/ }).click();
        await page.getByLabel("Nombre del periodo").fill("Grados de prueba editado");
        await page.getByLabel("Estado del periodo").selectOption("CERRADO");
        await page.getByRole("button", { name: "Guardar cambios" }).click();
        await expect(lista).toContainText("Grados de prueba editado · CERRADO");
        await captura(page, "10-f-periodo-editado");
        expect(sql("SELECT estado FROM periodos_grado WHERE nombre='Grados de prueba editado'")[0]).toBe("CERRADO");

        // Se refleja en el sistema: con el periodo cerrado, el estudiante no tiene dónde inscribirse.
        const estudiante = await sesion(browser, ESTUDIANTE);
        await abrirFormulario(estudiante, "pregrado");
        await expect(estudiante.getByText("Sin periodo disponible")).toBeVisible();
        await captura(estudiante, "10-g-estudiante-sin-periodo-abierto", false);

        // Y al reabrirlo y cambiar sus fechas, el estudiante ve el periodo actualizado.
        await lista.locator("li", { hasText: "Grados de prueba editado" }).getByRole("button", { name: /Editar/ }).click();
        await page.getByLabel("Estado del periodo").selectOption("ABIERTO");
        await page.getByRole("button", { name: "Guardar cambios" }).click();
        await expect(lista).toContainText("Grados de prueba editado · ABIERTO");
        await abrirFormulario(estudiante, "pregrado");
        await expect(estudiante.getByText("Grados de prueba editado").first()).toBeVisible();
        await captura(estudiante, "10-h-estudiante-con-periodo-editado", false);
    });
});
