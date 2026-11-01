import { expect, test } from "@playwright/test";
import { API, sesionComo } from "./soporte";
const FORM = "/estudiante/iniciar_preinscripcion";
for (const nivel of ["PREGRADO", "POSGRADO"] as const)
  for (const origen of ["/estudiante/bienvenida", "/estudiante/home", FORM]) {
    test(`reanuda borrador ${nivel} desde ${origen} sin alternar páginas`, async ({
      page,
    }) => {
      await sesionComo(page, "estudiante");
      let consultas = 0;
      await page.route(`${API}/solicitudes/estado`, (r) => {
        consultas++;
        return r.fulfill({
          json: {
            ok: true,
            estado: "BORRADOR",
            destino: FORM,
            nivel,
            id_solicitud: 7,
          },
        });
      });
      const rutas: string[] = [];
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) rutas.push(frame.url());
      });
      await page.goto(origen);
      await expect(page).toHaveURL(`${FORM}?nivel=${nivel}`);
      await expect(
        page.getByRole("form", { name: "Preinscripción de grado" }),
      ).toBeVisible();
      const antes = rutas.length;
      await page.reload();
      await expect(
        page.getByRole("form", { name: "Preinscripción de grado" }),
      ).toBeVisible();
      expect(
        rutas.slice(antes).filter((r) => r.includes("/estudiante/bienvenida")),
      ).toEqual([]);
      expect(consultas).toBeLessThanOrEqual(2);
    });
  }
test("un estado de borrador sin nivel válido termina en error recuperable, sin redirecciones", async ({
  page,
}) => {
  await sesionComo(page, "estudiante");
  await page.route(`${API}/solicitudes/estado`, (r) =>
    r.fulfill({
      json: { ok: true, estado: "BORRADOR", destino: FORM, nivel: "DOCTORADO" },
    }),
  );
  await page.goto("/estudiante/bienvenida");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "nivel del borrador",
  );
  await expect(page).toHaveURL("/estudiante/bienvenida");
  await expect(
    page.getByRole("button", { name: "Reintentar", exact: true }),
  ).toBeVisible();
});
test("entrar sin nivel y sin solicitud conduce una sola vez a bienvenida", async ({
  page,
}) => {
  await sesionComo(page, "estudiante");
  let consultas = 0;
  await page.route(`${API}/solicitudes/estado`, (r) => {
    consultas++;
    return r.fulfill({
      json: {
        ok: true,
        estado: "SIN_SOLICITUD",
        destino: "/estudiante/bienvenida",
      },
    });
  });
  await page.goto(FORM);
  await expect(page).toHaveURL("/estudiante/bienvenida");
  await expect(
    page.getByRole("link", { name: "Iniciar preinscripción para pregrado" }),
  ).toBeVisible();
  expect(consultas).toBeLessThanOrEqual(2);
});
test("si falla la consulta al abrir una URL sin nivel, muestra error y permite reintentar", async ({
  page,
}) => {
  await sesionComo(page, "estudiante");
  let fallo = true;
  await page.route(`${API}/solicitudes/estado`, (r) =>
    fallo
      ? r.fulfill({ status: 503, json: { message: "Base no disponible" } })
      : r.fulfill({
          json: {
            ok: true,
            estado: "BORRADOR",
            destino: FORM,
            nivel: "PREGRADO",
          },
        }),
  );
  await page.goto(FORM);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "No fue posible cargar",
  );
  await expect(page).toHaveURL(FORM);
  fallo = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page).toHaveURL(`${FORM}?nivel=PREGRADO`);
  await expect(
    page.getByRole("form", { name: "Preinscripción de grado" }),
  ).toBeVisible();
});

test("una consulta sin respuesta termina en error y se puede reintentar", async ({
  page,
}) => {
  await sesionComo(page, "estudiante");
  let bloqueado = true;
  await page.route(`${API}/solicitudes/estado`, (ruta) => {
    if (bloqueado) return; // Simula una conexión que no entrega respuesta.
    return ruta.fulfill({ json: { ok: true, estado: "SIN_SOLICITUD" } });
  });
  await page.goto("/estudiante/bienvenida");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "tardó demasiado",
    { timeout: 20000 },
  );
  bloqueado = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Iniciar preinscripción para pregrado" }),
  ).toBeVisible();
});
