import { expect, test, type Page } from "@playwright/test";
import { API, PERIODO_DEMO, revisarAxe, sesionComo } from "./soporte";
const DASHBOARD = "/funcionario/dashboard";
const VALIDO = {
  nombre: "Nueva convocatoria",
  fechaInicio: "2026-10-23",
  fechaFin: "2026-11-30",
  fechaGraduacion: "2026-12-05",
};
const OTRO = {
  ...PERIODO_DEMO,
  id: "otro-periodo",
  nombre: "Otro periodo",
  fechaInicio: "2026-11-01",
  fechaFin: "2026-11-30",
  fechaGraduacion: "2026-12-05",
};
async function preparar(page: Page, editar = false) {
  await sesionComo(page, "funcionario");
  let escrituras = 0;
  page.on("request", (r) => {
    if (
      r.url().includes("/periodos-grado") &&
      ["POST", "PATCH"].includes(r.method())
    )
      escrituras++;
  });
  await page.goto(DASHBOARD);
  await page.getByRole("button", { name: "Gestionar periodos" }).click();
  const dialogo = page.getByRole("dialog", {
    name: "Gestión de periodos de grado",
  });
  await expect(
    dialogo.getByRole("list", { name: "Periodos de grado registrados" }),
  ).toContainText(PERIODO_DEMO.nombre);
  if (editar)
    await dialogo
      .getByRole("button", { name: `Editar ${PERIODO_DEMO.nombre}` })
      .click();
  return { dialogo, escrituras: () => escrituras };
}
async function llenar(page: Page, datos = VALIDO) {
  await page.getByLabel("Nombre del periodo").fill(datos.nombre);
  await page
    .getByLabel("Fecha de inicio", { exact: true })
    .fill(datos.fechaInicio);
  await page.getByLabel("Fecha de finalización").fill(datos.fechaFin);
  await page.getByLabel("Fecha de graduación").fill(datos.fechaGraduacion);
}
for (const editar of [false, true])
  for (const [nombre, cambio, mensaje, campo] of [
    [
      "inicio igual al cierre",
      { fechaInicio: "2026-11-30" },
      "inicio debe ser anterior",
      "Fecha de finalización",
    ],
    [
      "inicio posterior al cierre",
      { fechaInicio: "2026-12-01" },
      "inicio debe ser anterior",
      "Fecha de finalización",
    ],
    [
      "graduación dentro del rango",
      { fechaGraduacion: "2026-11-15" },
      "graduación debe ser posterior",
      "Fecha de graduación",
    ],
    [
      "graduación igual al cierre",
      { fechaGraduacion: "2026-11-30" },
      "graduación debe ser posterior",
      "Fecha de graduación",
    ],
    [
      "graduación anterior al inicio",
      { fechaGraduacion: "2026-10-01" },
      "graduación debe ser posterior",
      "Fecha de graduación",
    ],
    [
      "fecha ausente",
      { fechaGraduacion: "" },
      "graduación válida",
      "Fecha de graduación",
    ],
    [
      "nombre vacío",
      { nombre: "   " },
      "Escribe un nombre",
      "Nombre del periodo",
    ],
  ] as const) {
    test(`${editar ? "edición" : "creación"}: ${nombre} se rechaza antes de enviar`, async ({
      page,
    }) => {
      const { dialogo, escrituras } = await preparar(page, editar);
      await llenar(page, { ...VALIDO, ...cambio });
      await dialogo
        .getByRole("button", {
          name: editar ? "Guardar cambios" : "Registrar periodo",
          exact: true,
        })
        .click();
      await expect(dialogo.getByRole("alert")).toContainText(mensaje);
      await expect(dialogo.getByLabel(campo, { exact: true })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(dialogo.getByLabel(campo, { exact: true })).toBeFocused();
      expect(escrituras()).toBe(0);
      await expect(dialogo.getByLabel("Nombre del periodo")).toHaveValue(
        { ...VALIDO, ...cambio }.nombre,
      );
    });
  }
test("rechaza duplicados con nombre, estado y ceremonia distintos", async ({
  page,
}) => {
  const { dialogo, escrituras } = await preparar(page);
  await llenar(page, {
    ...VALIDO,
    fechaInicio: PERIODO_DEMO.fechaInicio,
    fechaFin: PERIODO_DEMO.fechaFin,
  });
  await dialogo.getByLabel("Estado del periodo").selectOption("CERRADO");
  await dialogo
    .getByRole("button", { name: "Registrar periodo", exact: true })
    .click();
  await expect(dialogo.getByRole("alert")).toContainText(
    "Ya existe un periodo con estas fechas",
  );
  expect(escrituras()).toBe(0);
});
test("editar no permite usar el rango de otro periodo", async ({ page }) => {
  await sesionComo(page, "funcionario");
  await page.route(`${API}/periodos-grado`, (r) =>
    r.fulfill({ json: [PERIODO_DEMO, OTRO] }),
  );
  let envios = 0;
  page.on("request", (r) => {
    if (r.method() === "PATCH") envios++;
  });
  await page.goto(DASHBOARD);
  await page.getByRole("button", { name: "Gestionar periodos" }).click();
  const dialogo = page.getByRole("dialog", {
    name: "Gestión de periodos de grado",
  });
  await dialogo
    .getByRole("button", { name: `Editar ${PERIODO_DEMO.nombre}` })
    .click();
  await llenar(page, {
    ...VALIDO,
    fechaInicio: OTRO.fechaInicio,
    fechaFin: OTRO.fechaFin,
  });
  await dialogo
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(dialogo.getByRole("alert")).toContainText(
    "Ya existe un periodo",
  );
  expect(envios).toBe(0);
});
test("corregir el ejemplo guarda y actualiza el listado", async ({ page }) => {
  const { dialogo, escrituras } = await preparar(page);
  await llenar(page, { ...VALIDO, fechaGraduacion: "2026-11-15" });
  await dialogo
    .getByRole("button", { name: "Registrar periodo", exact: true })
    .click();
  await expect(dialogo.getByRole("alert")).toBeVisible();
  await dialogo.getByLabel("Fecha de graduación").fill(VALIDO.fechaGraduacion);
  await dialogo
    .getByRole("button", { name: "Registrar periodo", exact: true })
    .click();
  await expect(dialogo.getByRole("status")).toContainText(
    "Periodo guardado correctamente",
  );
  await expect(
    dialogo.getByRole("list", { name: "Periodos de grado registrados" }),
  ).toContainText(VALIDO.nombre);
  expect(escrituras()).toBe(1);
});
for (const [status, mensaje] of [
  [
    409,
    "Ya existe un periodo con estas fechas de recepción. Edita el periodo registrado o selecciona otro rango.",
  ],
  [400, "La fecha de graduación debe ser posterior al cierre."],
  [503, "Error en el servicio de base de datos"],
] as const) {
  test(`muestra error ${status} y conserva el formulario`, async ({ page }) => {
    const { dialogo } = await preparar(page);
    await page.route(`${API}/periodos-grado`, (r) =>
      r.request().method() === "POST"
        ? r.fulfill({ status, json: { message: mensaje } })
        : r.fallback(),
    );
    await llenar(page);
    await dialogo
      .getByRole("button", { name: "Registrar periodo", exact: true })
      .click();
    await expect(dialogo.getByRole("alert")).toHaveText(mensaje);
    await expect(dialogo.getByLabel("Fecha de graduación")).toHaveValue(
      VALIDO.fechaGraduacion,
    );
    await expect(
      dialogo.getByRole("button", { name: "Registrar periodo", exact: true }),
    ).toBeEnabled();
    await expect(
      dialogo.getByRole("heading", { name: "Nuevo periodo", exact: true }),
    ).toBeVisible();
  });
}
for (const tema of ["light", "dark"] as const) {
  test(`error accesible a 320px en ${tema}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    const { dialogo } = await preparar(page);
    await llenar(page, { ...VALIDO, fechaGraduacion: "2026-11-15" });
    await dialogo
      .getByRole("button", { name: "Registrar periodo", exact: true })
      .click();
    await expect(dialogo.getByRole("alert")).toBeVisible();
    await revisarAxe(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

async function abrirSinCatalogo(page: Page) {
  await page.goto(DASHBOARD);
  await page.getByRole('button', {name:'Gestionar periodos'}).click();
  const dialogo=page.getByRole('dialog', {name:'Gestión de periodos de grado'});
  await llenar(page,{nombre:'GRADOS',fechaInicio:'2026-11-01',fechaFin:'2026-11-10',fechaGraduacion:'2026-11-17'});
  return dialogo;
}
test('permite registrar las fechas de la captura aunque falle la consulta del listado',async({page})=>{
  await sesionComo(page,'funcionario');let envios=0;
  await page.route(`${API}/periodos-grado`,r=>{
    if(r.request().method()==='GET')return r.fulfill({status:503,json:{message:'Fallo de consulta'}});
    envios++;return r.fulfill({status:201,json:{id:'nuevo',...r.request().postDataJSON()}});
  });
  const dialogo=await abrirSinCatalogo(page);
  await expect(dialogo.getByText('No fue posible consultar los periodos.',{exact:true})).toBeVisible();
  await expect(dialogo.getByText('Aún no hay periodos registrados.',{exact:false})).toHaveCount(0);
  await expect(dialogo.getByRole('button',{name:'Registrar periodo',exact:true})).toBeEnabled();
  await dialogo.getByRole('button',{name:'Registrar periodo',exact:true}).click();
  await expect(dialogo.getByText('Periodo guardado correctamente.',{exact:true})).toBeVisible();
  await expect(dialogo.getByRole('button',{name:'Registrar periodo',exact:true})).toBeEnabled();
  expect(envios).toBe(1);
});
test('si también falla el guardado, muestra el error y conserva el formulario habilitado',async({page})=>{
  await sesionComo(page,'funcionario');
  await page.route(`${API}/periodos-grado`,r=>r.fulfill({status:503,json:{message:'No se pudo guardar el periodo. Reintenta.'}}));
  const dialogo=await abrirSinCatalogo(page);
  await dialogo.getByRole('button',{name:'Registrar periodo',exact:true}).click();
  await expect(dialogo.locator('#mensaje-periodo')).toContainText('No se pudo guardar');
  await expect(dialogo.getByLabel('Nombre del periodo')).toHaveValue('GRADOS');
  await expect(dialogo.getByLabel('Fecha de graduación')).toHaveValue('2026-11-17');
  await expect(dialogo.getByRole('button',{name:'Registrar periodo',exact:true})).toBeEnabled();
});
test('permite reintentar la consulta desde el diálogo sin perder los campos',async({page})=>{
  await sesionComo(page,'funcionario');let fallo=true;
  await page.route(`${API}/periodos-grado`,r=>fallo?r.fulfill({status:503,json:{message:'Fallo'}}):r.fulfill({json:[]}));
  const dialogo=await abrirSinCatalogo(page);
  await expect(dialogo.getByRole('button',{name:'Reintentar consulta de periodos'})).toBeVisible();
  fallo=false;await dialogo.getByRole('button',{name:'Reintentar consulta de periodos'}).click();
  await expect(dialogo.getByText('Aún no hay periodos registrados.',{exact:false})).toBeVisible();
  await expect(dialogo.getByLabel('Nombre del periodo')).toHaveValue('GRADOS');
  await expect(dialogo.getByRole('button',{name:'Registrar periodo',exact:true})).toBeEnabled();
});
test('un listado pendiente no bloquea el registro ni deja Guardando tras confirmarse',async({page})=>{
  await sesionComo(page,'funcionario');
  await page.route(`${API}/periodos-grado`,r=>{
    if(r.request().method()==='GET')return;
    return r.fulfill({status:201,json:{id:'nuevo',...r.request().postDataJSON()}});
  });
  const dialogo=await abrirSinCatalogo(page);
  await expect(dialogo.getByText('Consultando periodos registrados...', {exact:true})).toBeVisible();
  await expect(dialogo.getByText('Aún no hay periodos registrados.',{exact:false})).toHaveCount(0);
  await dialogo.getByRole('button',{name:'Registrar periodo',exact:true}).click();
  await expect(dialogo.getByText('Periodo guardado correctamente.',{exact:true})).toBeVisible();
  await expect(dialogo.getByRole('button',{name:'Registrar periodo',exact:true})).toBeEnabled();
});
