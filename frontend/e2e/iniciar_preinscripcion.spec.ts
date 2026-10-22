import { expect, test, type Locator, type Page } from "@playwright/test";
import { API, revisarPagina, sesionComo, TEMAS, USUARIOS } from "./soporte";

// Página del formulario de preinscripción (Tarea 25). El borrador es simulado (api.ts); lo único
// que se simula aquí con page.route es la sesión.

const RUTA = "/estudiante/iniciar_preinscripcion";
const PREGRADO = `${RUTA}?nivel=PREGRADO`;
const POSGRADO = `${RUTA}?nivel=POSGRADO`;

const AVISO_NUMERO = "Solo letras y números, sin puntos ni espacios";

/** `var(--ease-out)` de globals.css, tal como lo devuelve getComputedStyle. */
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Abre la página con la sesión del estudiante y espera a que termine de cargar. */
async function abrir(page: Page, ruta: string): Promise<void> {
    await sesionComo(page, "estudiante");
    await page.goto(ruta);
    await page.locator('main#contenido:not([aria-busy="true"])').waitFor();
}

/** Marca una respuesta en un grupo de opciones (sí/no o una sola opción), por su pregunta. */
async function responder(page: Page, pregunta: string, respuesta: string): Promise<void> {
    await page.getByRole("radiogroup", { name: pregunta }).getByRole("radio", { name: respuesta }).check();
}

function indice(page: Page) {
    return page.getByRole("navigation", { name: "Secciones del formulario" });
}

/** La región viva (aria-live="polite") que anuncia los caracteres quitados del número de documento. */
function anuncio(page: Page) {
    return page.locator('#seccion-identificacion [aria-live="polite"]');
}

/** El resumen visible del índice: en escritorio es un texto y en celular, el botón que lo despliega. */
function resumen(page: Page, texto: string) {
    return indice(page).getByText(texto).filter({ visible: true });
}

test.describe("iniciar preinscripción", () => {
    test("tiene su título", async ({ page }) => {
        await abrir(page, PREGRADO);
        await expect(page).toHaveTitle("Iniciar preinscripción · CheckU");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Preinscripción de grado · Pregrado");
    });

    test('pregrado muestra sus 5 secciones y el índice con "Te faltan"', async ({ page }) => {
        await abrir(page, PREGRADO);
        const secciones = [
            "Identificación",
            "Contacto y residencia",
            "Información académica",
            "Saber Pro y vinculación con la UTB",
            "Documentos",
        ];
        for (const titulo of secciones)
            await expect(page.getByRole("heading", { level: 2, name: titulo, exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Estudios y experiencia" })).toHaveCount(0);

        await expect(indice(page).getByRole("link")).toHaveCount(5);
        await expect(resumen(page, "Te faltan 2 secciones y 5 documentos")).toBeVisible();
        await expect(indice(page).getByRole("link", { name: /Documentos/ })).toContainText(
            "0 de 5 documentos cargados",
        );
    });

    test("posgrado muestra Estudios y experiencia y no Saber Pro", async ({ page }) => {
        await abrir(page, POSGRADO);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Preinscripción de grado · Posgrado");
        await expect(page.getByRole("heading", { level: 2, name: "Estudios y experiencia" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Saber Pro y vinculación con la UTB" })).toHaveCount(0);
        await expect(page.locator("#campo-empresa-1")).toBeVisible();
        await expect(page.locator("#campo-empresa-2")).toBeVisible();
        // Posgrado no pide opción de grado.
        await expect(page.locator("#campo-opcion-grado-1")).toHaveCount(0);
        await expect(resumen(page, "Te faltan 2 secciones y 3 documentos")).toBeVisible();
    });

    test("segundo programa: al marcar Sí aparecen programa 2, modalidad 2 y opción de grado 2", async ({ page }) => {
        await abrir(page, PREGRADO);
        const segundo = ["#campo-programa-2", "#campo-modalidad-2", "#campo-opcion-grado-2"];
        for (const id of segundo) await expect(page.locator(id)).toHaveCount(0);

        await responder(page, "¿Solicitas grado en un segundo programa?", "Sí");
        for (const id of segundo) await expect(page.locator(id)).toBeVisible();
        await expect(page.getByLabel("Programa (obligatorio)")).toHaveCount(2);

        await responder(page, "¿Solicitas grado en un segundo programa?", "No");
        for (const id of segundo) await expect(page.locator(id)).toHaveCount(0);
    });

    test("tipo de contrato solo si es empleado", async ({ page }) => {
        await abrir(page, PREGRADO);
        const contrato = page.locator("#campo-tipo-contrato");
        await expect(contrato).toHaveCount(0);
        await responder(page, "¿Eres empleado de la UTB?", "Sí");
        await expect(contrato).toBeVisible();
        await responder(page, "¿Eres empleado de la UTB?", "No");
        await expect(contrato).toHaveCount(0);
    });

    test("registro y fecha Saber Pro solo si los conoce", async ({ page }) => {
        await abrir(page, PREGRADO);
        const registro = page.locator("#campo-numero-registro-saber-pro");
        const fecha = page.locator("#campo-fecha-examen-saber-pro");
        await expect(registro).toHaveCount(0);
        await expect(fecha).toHaveCount(0);
        await responder(page, "¿Conoces tu número de registro?", "Sí");
        await expect(registro).toBeVisible();
        await expect(fecha).toBeVisible();
        await responder(page, "¿Conoces tu número de registro?", "No");
        await expect(registro).toHaveCount(0);
        await expect(fecha).toHaveCount(0);
    });

    test("escribir puntos en el número de documento no los deja y avisa", async ({ page }) => {
        await abrir(page, PREGRADO);
        const campo = page.locator("#campo-numero-documento");
        await expect(campo).not.toHaveAttribute("aria-invalid", "true");

        await expect(anuncio(page)).toHaveText("");

        await campo.pressSequentially("1.043 640-743");
        await expect(campo).toHaveValue("1043640743");
        await expect(campo).toHaveAttribute("aria-invalid", "true");
        await expect(page.locator("#campo-numero-documento-error")).toHaveText(AVISO_NUMERO);
        await expect(campo).toHaveAccessibleDescription(AVISO_NUMERO);
        await expect(anuncio(page)).toHaveText(AVISO_NUMERO);
    });

    test("pegar con puntos deja solo dígitos", async ({ page, context }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await abrir(page, PREGRADO);
        const campo = page.locator("#campo-numero-documento");
        await page.evaluate(() => navigator.clipboard.writeText("1.043.640.743"));
        await expect(anuncio(page)).toHaveText("");
        await campo.focus();
        await page.keyboard.press("ControlOrMeta+V");
        await expect(campo).toHaveValue("1043640743");
        // Se ve una sola vez, en el error del campo, y se anuncia en la región viva (que ya existía).
        await expect(page.locator("#campo-numero-documento-error")).toHaveText(AVISO_NUMERO);
        await expect(campo).toHaveAccessibleDescription(AVISO_NUMERO);
        await expect(anuncio(page)).toHaveText(AVISO_NUMERO);
    });

    test("el índice marca Identificación como Completa al llenar sus obligatorios", async ({ page }) => {
        await abrir(page, PREGRADO);
        const enlace = indice(page).getByRole("link", { name: /Identificación/ });
        await expect(enlace).toContainText("Faltan 4 campos");

        await page.getByLabel("Nombres (obligatorio)").fill("Ana");
        await page.getByLabel("Apellidos (obligatorio)").fill("Prueba");
        await page.getByLabel("Tipo de documento (obligatorio)").selectOption({ label: "Cédula de ciudadanía" });
        await expect(enlace).toContainText("Falta 1 campo");
        await page.getByLabel("Número de documento (obligatorio)").fill("1234567890");

        await expect(enlace).toContainText("Completa");
        await expect(resumen(page, "Te faltan 1 sección y 5 documentos")).toBeVisible();
    });

    test("las secciones sin obligatorios dicen Opcional, sin la marca de completa", async ({ page }) => {
        await abrir(page, PREGRADO);
        for (const titulo of ["Contacto y residencia", "Saber Pro y vinculación con la UTB"]) {
            const enlace = indice(page).getByRole("link", { name: new RegExp(titulo) });
            await expect(enlace).toContainText("Opcional");
            await expect(enlace).not.toContainText("Completa");
            await expect(enlace.locator("svg")).toHaveCount(0);
        }

        await page.goto(POSGRADO);
        await page.locator('main#contenido:not([aria-busy="true"])').waitFor();
        for (const titulo of ["Contacto y residencia", "Estudios y experiencia"]) {
            const enlace = indice(page).getByRole("link", { name: new RegExp(titulo) });
            await expect(enlace).toContainText("Opcional");
            await expect(enlace).not.toContainText("Completa");
            await expect(enlace.locator("svg")).toHaveCount(0);
        }
    });

    test("movimiento según el spec: solo las marcas del índice cambian en 150 ms, con ease-out", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await abrir(page, PREGRADO);
        const transicion = (locator: Locator) =>
            locator.evaluate((elemento) => {
                const estilo = getComputedStyle(elemento);
                return { duracion: estilo.transitionDuration, curva: estilo.transitionTimingFunction };
            });
        const enlace = indice(page).getByRole("link", { name: /Identificación/ });

        // Lo que cambia al desplazarse o con el teclado no se anima.
        expect((await transicion(enlace)).duracion).toBe("0s");
        expect((await transicion(enlace.getByText("Identificación"))).duracion).toBe("0s");
        const opcion = page.getByRole("radiogroup", { name: "Modalidad (obligatorio)" }).locator("label").first();
        expect((await transicion(opcion)).duracion).toBe("0s");

        // Las marcas de completitud: 150 ms y var(--ease-out) en cada propiedad.
        for (const marca of [enlace.locator("> span").first(), enlace.getByText("Faltan 4 campos")]) {
            const { duracion, curva } = await transicion(marca);
            expect(duracion.split(", ").every((valor) => valor === "0.15s"), duracion).toBe(true);
            const curvas = curva.split(/,\s(?=[a-z])/); // "cubic-bezier(…), cubic-bezier(…)"
            expect(curvas.every((valor) => valor === EASE_OUT), curva).toBe(true);
        }
    });

    test("el enlace del índice lleva a su sección y la marca como actual", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await abrir(page, PREGRADO);
        const enlace = indice(page).getByRole("link", { name: /Información académica/ });
        await enlace.click();
        await expect(page).toHaveURL(/#seccion-academico$/);
        await expect(enlace).toHaveAttribute("aria-current", "location");
        await expect(indice(page).locator('[aria-current="location"]')).toHaveCount(1);
        await expect(indice(page)).toBeInViewport();
    });

    test("al desplazarse, sin tocar el índice, se marca la sección que se está viendo", async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await abrir(page, PREGRADO);
        const identificacion = indice(page).getByRole("link", { name: /Identificación/ });
        const academico = indice(page).getByRole("link", { name: /Información académica/ });
        await expect(identificacion).toHaveAttribute("aria-current", "location");

        await page.locator("#seccion-academico").evaluate((seccion) => seccion.scrollIntoView());
        await expect(academico).toHaveAttribute("aria-current", "location");
        await expect(identificacion).not.toHaveAttribute("aria-current", "location");

        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await expect(identificacion).toHaveAttribute("aria-current", "location");
        await expect(indice(page).locator('[aria-current="location"]')).toHaveCount(1);
    });

    test("en celular el índice es un botón que despliega las secciones", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await abrir(page, PREGRADO);
        const boton = indice(page).getByRole("button", { name: /Te faltan 2 secciones y 5 documentos/ });
        await expect(boton).toHaveAttribute("aria-expanded", "false");
        await expect(indice(page).getByRole("link")).toHaveCount(0);

        await boton.click();
        await expect(boton).toHaveAttribute("aria-expanded", "true");
        await expect(indice(page).getByRole("link")).toHaveCount(5);

        await indice(page).getByRole("link", { name: /Documentos/ }).click();
        await expect(boton).toHaveAttribute("aria-expanded", "false");
        await expect(page.getByRole("heading", { level: 2, name: "Documentos" })).toBeInViewport();
    });

    test("nivel inválido redirige a /estudiante/bienvenida", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto(`${RUTA}?nivel=DOCTORADO`);
        await expect(page).toHaveURL("/estudiante/bienvenida");
    });

    test("sin nivel redirige a /estudiante/bienvenida", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto(RUTA);
        await expect(page).toHaveURL("/estudiante/bienvenida");
    });

    test("nivel que no coincide con el del usuario redirige a /estudiante/bienvenida", async ({ page }) => {
        await sesionComo(page, "estudiante");
        // La ruta registrada después tiene prioridad: este usuario es de posgrado.
        await page.route(`${API}/auth/me`, (ruta) =>
            ruta.fulfill({ status: 200, json: { user: { ...USUARIOS.estudiante, nivel: "POSGRADO" } } }),
        );
        await page.goto(PREGRADO);
        await expect(page).toHaveURL("/estudiante/bienvenida");
    });

    test("una solicitud ya enviada redirige a /estudiante/preinscripcion", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await page.goto(`${PREGRADO}&escenario=enviada`);
        await expect(page).toHaveURL("/estudiante/preinscripcion");
    });

    test("el correo viene de la sesión y es de solo lectura", async ({ page }) => {
        await abrir(page, PREGRADO);
        const correo = page.locator("#campo-correo");
        await expect(correo).toHaveValue(USUARIOS.estudiante.username);
        await expect(correo).not.toBeEditable();
    });

    test("los obligatorios lo dicen en su etiqueta y lo demás es opcional", async ({ page }) => {
        await abrir(page, PREGRADO);
        for (const id of [
            "#campo-nombres",
            "#campo-apellidos",
            "#campo-tipo-documento",
            "#campo-numero-documento",
            "#campo-codigo-estudiantil",
            "#campo-programa-1",
        ]) {
            await expect(page.locator(id)).toHaveAttribute("aria-required", "true");
            await expect(page.locator(id)).toHaveAccessibleName(/\(obligatorio\)$/);
        }
        await expect(page.getByRole("radiogroup", { name: "Modalidad (obligatorio)" })).toHaveAttribute(
            "aria-required",
            "true",
        );
        for (const id of ["#campo-celular", "#campo-direccion", "#campo-fecha-nacimiento", "#campo-opcion-grado-1"])
            await expect(page.locator(id)).not.toHaveAttribute("aria-required", "true");
        await expect(page.locator("form")).toHaveAttribute("novalidate", "");
    });

    test("el foco no queda tapado por la barra fija", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 600 });
        await abrir(page, PREGRADO);
        await page.evaluate(() =>
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
        );
        for (let i = 0; i < 40; i++) {
            await page.keyboard.press("Shift+Tab");
            // Tapado = lo que se ve en el centro del elemento enfocado es otra cosa (WCAG 2.4.11).
            const tapado = await page.evaluate(async () => {
                await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)));
                const foco = document.activeElement!;
                const caja = foco.getBoundingClientRect();
                if (foco === document.body || caja.bottom <= 0 || caja.top >= innerHeight) return false;
                const visible = document.elementFromPoint(caja.left + caja.width / 2, caja.top + caja.height / 2);
                return !!visible && !foco.contains(visible) && !visible.contains(foco);
            });
            expect(tapado).toBe(false);
        }
    });

    for (const [nombre, ruta] of [
        ["pregrado", PREGRADO],
        ["posgrado", POSGRADO],
    ] as const)
        for (const tema of TEMAS)
            for (const ancho of [320, 768, 1280])
                test(`${nombre}: accesible y sin desborde (${tema}, ${ancho}px)`, async ({ page }) => {
                    await sesionComo(page, "estudiante");
                    await revisarPagina(page, ruta, tema, ancho);
                });
});
