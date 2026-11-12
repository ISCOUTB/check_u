import { expect, test } from "@playwright/test";
import { API, sesionComo } from "./soporte";

const RUTA = "/estudiante/iniciar_preinscripcion?nivel=PREGRADO";

const IDENTIDAD = {
    nombres: "Ana María",
    apellidos: "Pérez Gómez",
    correo: "ana.perez@utb.edu.co",
    codigoEstudiantil: "T00071293",
};

/** Tarea 68: la identidad sale de `usuarios`, no de la sesión ni del borrador guardado. */
test("Tarea 68: precarga nombres, correo y código desde usuarios", async ({ page }) => {
    await sesionComo(page, "estudiante");
    await page.route(`${API}/solicitudes/borrador`, route =>
        route.request().method() === "GET"
            ? route.fulfill({ json: {
                  ok: true,
                  id_solicitud: null,
                  estado: null,
                  borrador: null,
                  estudiante: IDENTIDAD,
                  periodos: { fechaActual: "2026-11-22", periodoAsignado: null, periodoDisponible: null, proximosPeriodos: [] },
              } })
            : route.fulfill({ status: 201, json: { ok: true, id_solicitud: 1, guardadoEn: new Date().toISOString() } }),
    );
    await page.goto(RUTA);

    const nombres = page.getByLabel("Nombres (obligatorio)");
    const apellidos = page.getByLabel("Apellidos (obligatorio)");
    const correo = page.getByLabel("Correo institucional");
    const codigo = page.getByLabel("Código estudiantil (obligatorio)");

    await expect(nombres).toHaveValue(IDENTIDAD.nombres);
    await expect(apellidos).toHaveValue(IDENTIDAD.apellidos);
    // El correo registrado reemplaza al usuario de la sesión.
    await expect(correo).toHaveValue(IDENTIDAD.correo);
    await expect(codigo).toHaveValue(IDENTIDAD.codigoEstudiantil);

    await expect(nombres).toBeEditable();
    await expect(apellidos).toBeEditable();
    await expect(correo).not.toBeEditable();
    await expect(codigo).not.toBeEditable();
    await expect(codigo).toHaveAccessibleDescription(/no se puede cambiar/);

    await nombres.fill("Ana M.");
    await expect(nombres).toHaveValue("Ana M.");
    await expect(codigo).toHaveValue(IDENTIDAD.codigoEstudiantil);
});

test("Tarea 68: el código se completa cuando usuarios aún no lo tiene", async ({ page }) => {
    await sesionComo(page, "estudiante");
    await page.route(`${API}/solicitudes/borrador`, route =>
        route.fulfill({ json: {
            ok: true,
            id_solicitud: null,
            estado: null,
            borrador: null,
            estudiante: { ...IDENTIDAD, codigoEstudiantil: null },
            periodos: { fechaActual: "2026-11-22", periodoAsignado: null, periodoDisponible: null, proximosPeriodos: [] },
        } }),
    );
    await page.goto(RUTA);

    const codigo = page.getByLabel("Código estudiantil (obligatorio)");
    await expect(codigo).toHaveValue("");
    await expect(codigo).toBeEditable();
    await expect(codigo).toHaveAccessibleDescription(/Ejemplo: T00012345/);
    await codigo.fill("T00099999");
    await expect(codigo).toHaveValue("T00099999");
});
