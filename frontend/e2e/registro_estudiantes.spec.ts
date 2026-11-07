import { expect, test, type Page } from "@playwright/test";
import { API, revisarAxe, sesionComo } from "./soporte";

const RUTA = "/funcionario/registrar_estudiantes";
const CABECERA = "nombres;apellidos;codigo_estudiantil;rol";
const CSV = `${CABECERA}\nAna;Muñoz;T55;ESTUDIANTE\nLuis;Rojas;T55;ESTUDIANTE\n`;
const RESULTADO = {
  total: 2,
  registrados: 1,
  errores: 1,
  filas: [
    {
      linea: 2,
      nombres: "Ana",
      apellidos: "Muñoz",
      codigo_estudiantil: "T55",
      estado: "registrado",
      mensaje: "Estudiante registrado correctamente.",
    },
    {
      linea: 3,
      nombres: "Luis",
      apellidos: "Rojas",
      codigo_estudiantil: "T55",
      estado: "error",
      mensaje: "El código estudiantil se repite en este archivo.",
    },
  ],
};
async function formulario(page: Page) {
  await page.getByLabel("Nombres", { exact: true }).fill("Ana");
  await page.getByLabel("Apellidos", { exact: true }).fill("Muñoz");
  await page.getByLabel("Código estudiantil", { exact: true }).fill("t55");
}
async function archivo(
  page: Page,
  contenido = CSV,
  nombre = "estudiantes.csv",
) {
  await page.getByLabel("Archivo CSV").setInputFiles({
    name: nombre,
    mimeType: "text/csv",
    buffer: Buffer.from(contenido),
  });
}

test("la funcionaria accede desde la navegación", async ({ page }) => {
  await sesionComo(page, "funcionario");
  await page.goto("/funcionario/dashboard");
  await page
    .getByRole("button", { name: "Rafael Prueba Funcionaria de grados" })
    .click();
  await page
    .getByRole("link", { name: "Registrar estudiantes", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${RUTA}$`));
  await expect(
    page.getByRole("heading", { name: "Registrar estudiantes", exact: true }),
  ).toBeVisible();
});
for (const rol of [null, "estudiante"] as const) {
  test(`protege la pantalla para ${rol ?? "sesión ausente"}`, async ({
    page,
  }) => {
    await sesionComo(page, rol);
    let envios = 0;
    await page.route(`${API}/funcionario/estudiantes**`, (r) => {
      envios++;
      return r.abort();
    });
    await page.goto(RUTA);
    await expect(page).toHaveURL(
      rol ? /\/estudiante\/home$/ : /localhost:3001\/$/,
    );
    await expect(
      page.getByRole("link", { name: "Registrar estudiantes", exact: true }),
    ).toHaveCount(0);
    expect(envios).toBe(0);
  });
}
test("registra con rol fijo y muestra la confirmación del servidor", async ({
  page,
}) => {
  await sesionComo(page, "funcionario");
  await page.route(`${API}/funcionario/estudiantes`, async (r) => {
    expect(r.request().postDataJSON()).toEqual({
      nombres: "Ana",
      apellidos: "Muñoz",
      codigo_estudiantil: "t55",
      rol: "ESTUDIANTE",
    });
    await r.fulfill({
      status: 201,
      json: {
        id_usuario: 3,
        nombres: "Ana",
        apellidos: "Muñoz",
        codigo_estudiantil: "T55",
        rol: "ESTUDIANTE",
      },
    });
  });
  await page.goto(RUTA);
  await formulario(page);
  await expect(page.getByLabel("Rol", { exact: true })).toHaveValue(
    "Estudiante",
  );
  await expect(page.getByLabel("Rol", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  await page
    .getByRole("button", { name: "Registrar estudiante", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Ana Muñoz · Código T55",
  );
  await expect(page.getByLabel("Nombres", { exact: true })).toHaveValue("");
});
for (const estado of [409, 401, 403, 503, "red", "invalida"] as const) {
  test(`conserva formulario y explica fallo ${estado}`, async ({ page }) => {
    await sesionComo(page, "funcionario");
    await page.route(`${API}/funcionario/estudiantes`, (r) =>
      estado === "red"
        ? r.abort()
        : r.fulfill({
            status: typeof estado === "number" ? estado : 201,
            json:
              estado === "invalida"
                ? {}
                : { message: "El código estudiantil ya está registrado." },
          }),
    );
    await page.goto(RUTA);
    await formulario(page);
    await page
      .getByRole("button", { name: "Registrar estudiante", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      estado === "red"
        ? "conectar"
        : estado === "invalida"
          ? "respuesta"
          : estado === 401
            ? "sesión venció"
            : estado === 403
              ? "Solo la funcionaria"
              : "ya está registrado",
    );
    await expect(page.getByLabel("Nombres", { exact: true })).toHaveValue(
      "Ana",
    );
    await expect(
      page.getByRole("button", { name: "Registrar estudiante", exact: true }),
    ).toBeEnabled();
  });
}
test("bloquea ambos formularios mientras se confirma el registro", async ({
  page,
}) => {
  await sesionComo(page, "funcionario");
  let confirmar!: () => void;
  const espera = new Promise<void>((r) => {
    confirmar = r;
  });
  let envios = 0;
  await page.route(`${API}/funcionario/estudiantes`, async (r) => {
    envios++;
    await espera;
    await r.fulfill({
      status: 201,
      json: {
        id_usuario: 3,
        nombres: "Ana",
        apellidos: "Muñoz",
        codigo_estudiantil: "T55",
        rol: "ESTUDIANTE",
      },
    });
  });
  await page.goto(RUTA);
  await formulario(page);
  await page
    .getByRole("button", { name: "Registrar estudiante", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Registrando estudiante..." }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Importar estudiantes", exact: true }),
  ).toBeDisabled();
  expect(envios).toBe(1);
  confirmar();
  await expect(page.getByRole("status")).toContainText(
    "registrado correctamente",
  );
});
test("importa multipart UTF-8 y muestra el detalle de cada fila", async ({
  page,
}) => {
  await sesionComo(page, "funcionario");
  await page.route(`${API}/funcionario/estudiantes/importar`, (r) => {
    expect(r.request().headers()["content-type"]).toContain(
      "multipart/form-data; boundary=",
    );
    expect(r.request().postDataBuffer()?.toString("utf8")).toContain(CSV);
    expect(r.request().postDataBuffer()?.toString("utf8")).toContain(
      'name="archivo"',
    );
    return r.fulfill({ json: RESULTADO });
  });
  await page.goto(RUTA);
  await archivo(page);
  await page
    .getByRole("button", { name: "Importar estudiantes", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "2 registros procesados. 1 registrados y 1 con errores.",
  );
  await expect(page.getByRole("row")).toHaveCount(3);
  await expect(page.getByRole("row").nth(1)).toContainText("Ana Muñoz");
  await expect(page.getByRole("row").nth(2)).toContainText(
    "se repite en este archivo",
  );
  await expect(
    page.getByRole("heading", { name: "Resultado de la importación" }),
  ).toBeFocused();
  await expect(page.getByLabel("Archivo CSV")).toHaveValue("");
});
test("rechaza archivo ausente, extensión y tamaño antes de enviarlos", async ({
  page,
}) => {
  await sesionComo(page, "funcionario");
  let envios = 0;
  await page.route(`${API}/funcionario/estudiantes/importar`, (r) => {
    envios++;
    return r.abort();
  });
  await page.goto(RUTA);
  await page
    .getByRole("button", { name: "Importar estudiantes", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Selecciona el archivo",
  );
  await archivo(page, CSV, "estudiantes.pdf");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "64 KiB",
  );
  await archivo(page, "a".repeat(65537));
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "64 KiB",
  );
  expect(envios).toBe(0);
});
test("un fallo de importación conserva el archivo para reintentar", async ({
  page,
}) => {
  await sesionComo(page, "funcionario");
  await page.route(`${API}/funcionario/estudiantes/importar`, (r) =>
    r.fulfill({
      status: 503,
      json: { message: "Base de datos no disponible" },
    }),
  );
  await page.goto(RUTA);
  await archivo(page);
  await page
    .getByRole("button", { name: "Importar estudiantes", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Base de datos no disponible",
  );
  await expect(page.getByLabel("Archivo CSV")).not.toHaveValue("");
  await expect(
    page.getByRole("heading", { name: "Resultado de la importación" }),
  ).toHaveCount(0);
});
test("una respuesta CSV incompleta no muestra un éxito falso", async ({
  page,
}) => {
  await sesionComo(page, "funcionario");
  await page.route(`${API}/funcionario/estudiantes/importar`, (r) =>
    r.fulfill({ json: { ...RESULTADO, registrados: 2 } }),
  );
  await page.goto(RUTA);
  await archivo(page);
  await page
    .getByRole("button", { name: "Importar estudiantes", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "respuesta de la importación no es válida",
  );
});
test("la plantilla descargable contiene las cuatro columnas correctas", async ({
  page,
}) => {
  await sesionComo(page, "funcionario");
  await page.goto(RUTA);
  const respuesta = await page.request.get("/plantillas/estudiantes.csv");
  expect(respuesta.ok()).toBe(true);
  expect((await respuesta.text()).trim()).toBe(CABECERA);
  await expect(
    page.getByRole("link", { name: "Descargar plantilla CSV" }),
  ).toHaveAttribute("download", "");
});
for (const tema of ["light", "dark"] as const)
  for (const ancho of [320, 1280]) {
    test(`accesible sin desborde a ${ancho}px en ${tema}, con resultados`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
      await sesionComo(page, "funcionario");
      await page.route(`${API}/funcionario/estudiantes/importar`, (r) =>
        r.fulfill({ json: RESULTADO }),
      );
      await page.goto(RUTA);
      await expect(
        page.getByRole("heading", { name: "Registro individual", exact: true }),
      ).toBeVisible();
      await revisarAxe(page);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
      await archivo(page);
      await page
        .getByRole("button", { name: "Importar estudiantes", exact: true })
        .click();
      await expect(page.getByRole("row")).toHaveCount(3);
      await revisarAxe(page);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
    });
  }
