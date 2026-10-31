import { expect, test, type Locator, type Page } from "@playwright/test";
import { API, revisarAxe, revisarPagina, sesionComo, TEMAS, USUARIOS } from "./soporte";

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

/** La bienvenida solo permanece visible si el estado real es "sin solicitud". */
async function sinSolicitud(page: Page): Promise<void> {
    await page.route(`${API}/solicitudes/estado`, (ruta) =>
        ruta.fulfill({
            status: 200,
            json: {
                ok: true,
                estado: "SIN_SOLICITUD",
                destino: "/estudiante/bienvenida",
            },
        }),
    );
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

type VentanaConMarca = { mensajeAnterior?: Node | null };

/**
 * Un lector de pantalla no repite un mensaje vivo que no cambió, pero sí anuncia un nodo nuevo.
 * `marcarMensaje` recuerda el nodo que hay ahora en la región; `mensajeEsNuevo` dice si ya no está.
 */
async function marcarMensaje(region: Locator): Promise<void> {
    await region.evaluate((elemento) => {
        (window as unknown as VentanaConMarca).mensajeAnterior = elemento.firstChild;
    });
}

async function mensajeEsNuevo(page: Page): Promise<boolean> {
    return page.evaluate(() => (window as unknown as VentanaConMarca).mensajeAnterior?.isConnected === false);
}

/** El resumen visible del índice: en escritorio es un texto y en celular, el botón que lo despliega. */
function resumen(page: Page, texto: string) {
    return indice(page).getByText(texto).filter({ visible: true });
}

/** Un PDF de prueba: con la cabecera basta, porque el cliente no lee el contenido. */
function pdf(nombre: string) {
    return { name: nombre, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") };
}

/** La zona de carga de un documento, por su id (`DocumentoDelFormulario.id`). */
function zona(page: Page, id: string) {
    return page.locator("li", { has: page.locator(`#documento-${id}`) });
}

/** El contador de la sección Documentos ("N de M documentos cargados"). */
function contador(page: Page) {
    return page.locator("#seccion-documentos").getByText(/^\d+ de \d+ documentos cargados$/);
}

/** El resumen de errores del envío (role="alert"), por un texto que contiene. */
function resumenErrores(page: Page, texto: string) {
    return page.getByRole("alert").filter({ hasText: texto });
}

function botonEnviar(page: Page) {
    return page.getByRole("button", { name: "Enviar preinscripción" });
}

function dialogoEnvio(page: Page) {
    return page.getByRole("dialog", { name: "Revisa tu información antes de enviar" });
}

/** Llena lo obligatorio de posgrado, con sus 3 documentos: queda "Todo listo para enviar". */
async function llenarObligatoriosPosgrado(page: Page): Promise<void> {
    await page.getByLabel("Nombres (obligatorio)").fill("Ana");
    await page.getByLabel("Apellidos (obligatorio)").fill("Prueba");
    await page.getByLabel("Tipo de documento (obligatorio)").selectOption({ label: "Cédula de ciudadanía" });
    await page.getByLabel("Número de documento (obligatorio)").fill("1234567890");
    await page.getByLabel("Código estudiantil (obligatorio)").fill("T00012345");
    await responder(page, "Modalidad (obligatorio)", "Presencial");
    await page.getByLabel("Programa (obligatorio)").selectOption({ label: "Programa de ejemplo" });
    for (const id of ["identification", "paz_y_salvo_bib", "estampilla_pro_cultura"])
        await page.locator(`#documento-${id}`).setInputFiles(pdf(`${id}.pdf`));
}

/** Anota cada clave que genera crypto.randomUUID (la de idempotencia), sin tocar el código de la página. */
async function espiarClaves(page: Page): Promise<() => Promise<string[]>> {
    await page.addInitScript(() => {
        const original = crypto.randomUUID.bind(crypto);
        const claves: string[] = [];
        Object.assign(window, { __claves: claves });
        crypto.randomUUID = () => {
            const clave = original();
            claves.push(clave);
            return clave;
        };
    });
    return () => page.evaluate(() => (window as unknown as { __claves: string[] }).__claves);
}

/** ¿El evento beforeunload pide confirmar la salida? (lo que hace el navegador al recargar o cerrar) */
function avisaAlSalir(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const evento = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(evento);
        return evento.defaultPrevented;
    });
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

    test("discapacidad: al responder Sí aparecen tipo y detalles; al responder No se ocultan y se limpian", async ({
        page,
    }) => {
        await abrir(page, PREGRADO);
        const tipo = page.locator("#campo-tipo-discapacidad");
        const detalles = page.locator("#campo-detalles-asistencia");
        await expect(tipo).toHaveCount(0);
        await expect(detalles).toHaveCount(0);

        await responder(page, "¿Posee alguna discapacidad?", "Sí");
        await expect(tipo).toBeVisible();
        await expect(detalles).toBeVisible();

        await page.getByLabel("Tipo de discapacidad (obligatorio)").selectOption({ label: "Física" });
        await detalles.fill("Requiere rampa y espacio para silla de ruedas.");

        await responder(page, "¿Posee alguna discapacidad?", "No");
        await expect(tipo).toHaveCount(0);
        await expect(detalles).toHaveCount(0);

        // Al volver a Sí, los valores residuales no reaparecen.
        await responder(page, "¿Posee alguna discapacidad?", "Sí");
        await expect(page.getByLabel("Tipo de discapacidad (obligatorio)")).toHaveValue("");
        await expect(detalles).toHaveValue("");
    });

    test("discapacidad en posgrado: los campos adicionales también aparecen y se limpian", async ({ page }) => {
        await abrir(page, POSGRADO);
        await expect(page.locator("#campo-tipo-discapacidad")).toHaveCount(0);

        await responder(page, "¿Posee alguna discapacidad?", "Sí");
        await page.getByLabel("Tipo de discapacidad (obligatorio)").selectOption({ label: "Otra" });
        await page.locator("#campo-detalles-asistencia").fill("Requiere intérprete de lengua de señas.");
        await expect(page.locator("#campo-detalles-asistencia")).toHaveValue(
            "Requiere intérprete de lengua de señas.",
        );

        await responder(page, "¿Posee alguna discapacidad?", "No");
        await expect(page.locator("#campo-tipo-discapacidad")).toHaveCount(0);
        await expect(page.locator("#campo-detalles-asistencia")).toHaveCount(0);
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
        const campo = page.getByLabel("Número de documento (obligatorio)");
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
        const campo = page.getByLabel("Número de documento (obligatorio)");
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
        await sinSolicitud(page);
        await page.goto(`${RUTA}?nivel=DOCTORADO`);
        await expect(page).toHaveURL("/estudiante/bienvenida");
    });

    test("sin nivel redirige a /estudiante/bienvenida", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await sinSolicitud(page);
        await page.goto(RUTA);
        await expect(page).toHaveURL("/estudiante/bienvenida");
    });

    test("nivel que no coincide con el del usuario redirige a /estudiante/bienvenida", async ({ page }) => {
        await sesionComo(page, "estudiante");
        await sinSolicitud(page);
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

    test("el foco no queda tapado por la barra de acciones", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 640 });
        await abrir(page, `${PREGRADO}&escenario=borrador`);
        for (let i = 0; i < 70; i++) {
            await page.keyboard.press("Tab");
            // Bajando con Tab, lo enfocado no queda debajo de la barra fija: ni su borde de arriba ni el
            // de abajo los tapa otra cosa. El input de un documento es invisible: se mide su botón.
            const tapado = await page.evaluate(async () => {
                await new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)));
                const foco = document.activeElement!;
                const visible = foco instanceof HTMLInputElement && foco.type === "file" ? foco.parentElement! : foco;
                const caja = visible.getBoundingClientRect();
                if (foco === document.body || caja.bottom <= 0 || caja.top >= innerHeight) return false;
                return [caja.top + 2, caja.bottom - 2].some((y) => {
                    const encima = document.elementFromPoint(caja.left + caja.width / 2, y);
                    return !encima || (!foco.contains(encima) && !encima.contains(foco));
                });
            });
            expect(tapado).toBe(false);
        }
    });

    // ── Documentos ──────────────────────────────────────────────────────────────

    test("archivo que no es PDF se rechaza y no cuenta", async ({ page }) => {
        await abrir(page, PREGRADO);
        const entrada = page.locator("#documento-identification");

        await entrada.setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from("png") });
        await expect(zona(page, "identification")).toContainText("Solo se aceptan archivos PDF.");
        await expect(entrada).toHaveAttribute("aria-invalid", "true");
        await expect(entrada).toHaveAccessibleDescription(/Solo se aceptan archivos PDF\./);
        await expect(zona(page, "identification").getByRole("button", { name: /^Quitar/ })).toHaveCount(0);

        // Con extensión .pdf pero de otro tipo, tampoco.
        await entrada.setInputFiles({ name: "foto.pdf", mimeType: "image/png", buffer: Buffer.from("png") });
        await expect(zona(page, "identification")).toContainText("Solo se aceptan archivos PDF.");

        await expect(contador(page)).toHaveText("0 de 5 documentos cargados");
        await expect(indice(page).getByRole("link", { name: /Documentos/ })).toContainText(
            "0 de 5 documentos cargados",
        );
    });

    test("una imagen renombrada a .pdf se rechaza por su contenido", async ({ page }) => {
        await abrir(page, PREGRADO);
        const entrada = page.locator("#documento-identification");
        // Así la entrega el navegador: el tipo sale de la extensión, aunque los bytes sean de un PNG.
        const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
        await entrada.setInputFiles({ name: "foto.pdf", mimeType: "application/pdf", buffer: png });
        await expect(zona(page, "identification")).toContainText("Solo se aceptan archivos PDF.");
        await expect(entrada).toHaveAttribute("aria-invalid", "true");
        await expect(contador(page)).toHaveText("0 de 5 documentos cargados");
    });

    test("segundo programa en pregrado permite cargar la segunda estampilla y actualiza el contador", async ({ page }) => {
        await abrir(page, PREGRADO);
        await responder(page, "¿Solicitas grado en un segundo programa?", "Sí");
        const segunda = page.locator("#documento-estampilla_pro_cultura-2");
        await expect(segunda).toBeVisible();
        await expect(contador(page)).toHaveText("0 de 6 documentos cargados");

        await segunda.setInputFiles({ name: "estampilla2.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 prueba") });
        await expect(contador(page)).toHaveText("1 de 6 documentos cargados");
        await expect(resumen(page, "Te faltan 2 secciones y 5 documentos")).toBeVisible();
    });

    test("el mismo archivo rechazado dos veces se vuelve a anunciar", async ({ page }) => {
        await abrir(page, PREGRADO);
        const entrada = page.locator("#documento-identification");
        const aviso = page.locator('#seccion-documentos [aria-live="polite"]');
        const png = { name: "foto.png", mimeType: "image/png", buffer: Buffer.from("png") };
        const texto = "Cédula de ciudadanía: Solo se aceptan archivos PDF.";

        await entrada.setInputFiles(png);
        await expect(aviso).toHaveText(texto);
        await marcarMensaje(aviso);

        await entrada.setInputFiles(png);
        await expect.poll(() => mensajeEsNuevo(page), { timeout: 3000 }).toBe(true);
        await expect(aviso).toHaveText(texto);
    });

    test("PDF vacío se rechaza", async ({ page }) => {
        await abrir(page, PREGRADO);
        const entrada = page.locator("#documento-saber_pro");
        await entrada.setInputFiles({ name: "vacio.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) });
        await expect(zona(page, "saber_pro")).toContainText("El archivo está vacío.");
        await expect(entrada).toHaveAttribute("aria-invalid", "true");
        await expect(contador(page)).toHaveText("0 de 5 documentos cargados");
    });

    test("cargar y quitar actualiza el contador", async ({ page }) => {
        await abrir(page, PREGRADO);
        const entrada = page.locator("#documento-identification");
        await expect(entrada).toHaveAttribute("type", "file");
        await expect(entrada).toHaveAttribute("accept", "application/pdf,.pdf");
        await expect(entrada).toHaveAccessibleName(/^Cédula de ciudadanía \(obligatorio\)/);
        await expect(contador(page)).toHaveText("0 de 5 documentos cargados");

        await entrada.setInputFiles(pdf("cedula.pdf"));
        const cedula = zona(page, "identification");
        await expect(cedula).toContainText("cedula.pdf");
        await expect(contador(page)).toHaveText("1 de 5 documentos cargados");
        await expect(indice(page).getByRole("link", { name: /Documentos/ })).toContainText(
            "1 de 5 documentos cargados",
        );
        await expect(resumen(page, "Te faltan 2 secciones y 4 documentos")).toBeVisible();

        await cedula.getByRole("button", { name: /^Quitar/ }).click();
        await expect(cedula).not.toContainText("cedula.pdf");
        await expect(contador(page)).toHaveText("0 de 5 documentos cargados");
        // El foco no se pierde: vuelve a la carga del mismo documento.
        await expect(entrada).toBeFocused();
    });

    test("segundo programa en pregrado pide la segunda estampilla", async ({ page }) => {
        await abrir(page, PREGRADO);
        const segunda = page.locator("#documento-estampilla_pro_cultura-2");
        await expect(segunda).toHaveCount(0);

        await responder(page, "¿Solicitas grado en un segundo programa?", "Sí");
        await expect(segunda).toHaveAccessibleName(/^Estampilla Pro-Cultura \(segundo programa\) \(obligatorio\)/);
        await expect(contador(page)).toHaveText("0 de 6 documentos cargados");
        await expect(resumen(page, "Te faltan 2 secciones y 6 documentos")).toBeVisible();

        await responder(page, "¿Solicitas grado en un segundo programa?", "No");
        await expect(segunda).toHaveCount(0);
        await expect(contador(page)).toHaveText("0 de 5 documentos cargados");
    });

    // ── Guardar y enviar ────────────────────────────────────────────────────────

    test("envío incompleto muestra el resumen, mueve el foco y el enlace lleva al campo", async ({ page }) => {
        await abrir(page, PREGRADO);
        await botonEnviar(page).click();

        const resumenEnvio = resumenErrores(page, "Revisa estos campos antes de enviar");
        await expect(resumenEnvio).toBeVisible();
        await expect(resumenEnvio).toBeFocused();
        await expect(dialogoEnvio(page)).toHaveCount(0);
        // Un enlace por faltante: 7 campos y 5 documentos.
        await expect(resumenEnvio.getByRole("link")).toHaveCount(12);

        // Cada campo marca su error.
        const nombres = page.locator("#campo-nombres");
        await expect(nombres).toHaveAttribute("aria-invalid", "true");
        await expect(nombres).toHaveAccessibleDescription("Completa este campo.");
        await expect(page.locator("#documento-saber_pro")).toHaveAttribute("aria-invalid", "true");
        await expect(page.locator("#documento-saber_pro")).toHaveAccessibleDescription(
            /Carga este documento en PDF\./,
        );

        await resumenEnvio.getByRole("link", { name: /^Nombres/ }).click();
        await expect(nombres).toBeFocused();
        await expect(nombres).toBeInViewport();
        await resumenEnvio.getByRole("link", { name: /^Resultados Saber Pro/ }).click();
        await expect(page.locator("#documento-saber_pro")).toBeFocused();

        // Al corregirlo, el campo deja de marcar el error.
        await nombres.fill("Ana");
        await expect(nombres).not.toHaveAttribute("aria-invalid", "true");
    });

    test("un segundo guardado en el mismo minuto se vuelve a anunciar", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2026-10-22T20:40:00Z"));
        await abrir(page, PREGRADO);
        const guardar = page.getByRole("button", { name: "Guardar para continuar después" });
        const estado = page.getByRole("status").filter({ hasText: "Borrador guardado" });
        const texto = /Borrador guardado el 22\/10\/2026, 3:40\sp\.\sm\.$/;

        await guardar.click();
        await expect(estado).toHaveText(texto);
        await expect(guardar).toBeEnabled();
        await marcarMensaje(estado);

        await guardar.click();
        await expect.poll(() => mensajeEsNuevo(page), { timeout: 3000 }).toBe(true);
        await expect(estado).toHaveText(texto);
    });

    test("borrador parcial se carga (?escenario=borrador) y Guardar muestra la hora", async ({ page }) => {
        await page.clock.setFixedTime(new Date("2026-10-22T20:40:00Z"));
        const consola: string[] = [];
        page.on("console", (mensaje) => consola.push(mensaje.text()));
        await abrir(page, `${PREGRADO}&escenario=borrador`);

        await expect(page.locator("#campo-nombres")).toHaveValue("Ana");
        await expect(zona(page, "identification")).toContainText("documento-de-ejemplo.pdf");
        await expect(contador(page)).toHaveText("1 de 5 documentos cargados");
        const estado = page.getByRole("status").filter({ hasText: "Borrador guardado" });
        await expect(estado).toHaveText(/Borrador guardado el 20\/10\/2026, 10:30\sa\.\sm\.$/);
        await expect(page.getByText("Puedes guardar y retomar tu borrador más adelante.")).toBeVisible();

        await page.getByLabel("Número de documento (obligatorio)").fill("9876543210");
        await page.getByRole("button", { name: "Guardar para continuar después" }).click();
        await expect(page.getByRole("button", { name: "Guardando…" })).toBeDisabled();
        await expect(estado).toHaveText(/Borrador guardado el 22\/10\/2026, 3:40\sp\.\sm\.$/);
        await expect(page.getByRole("button", { name: "Guardar para continuar después" })).toBeEnabled();

        // Nada del borrador sale de la memoria de la página: ni al navegador, ni a la URL, ni a la consola.
        const guardado = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
        for (const dato of ["9876543210", "Prueba", "documento-de-ejemplo"]) {
            expect(guardado).not.toContain(dato);
            expect(page.url()).not.toContain(dato);
            expect(consola.join("\n")).not.toContain(dato);
        }
    });

    test("envío rechazado muestra los motivos (?escenario=rechazo)", async ({ page }) => {
        await abrir(page, `${PREGRADO}&escenario=rechazo`);
        await expect(resumen(page, "Todo listo para enviar")).toBeVisible();

        await botonEnviar(page).click();
        await expect(dialogoEnvio(page)).toBeVisible();
        await dialogoEnvio(page).getByRole("button", { name: "Enviar", exact: true }).click();

        const motivos = resumenErrores(page, "El número de documento no coincide con el registrado en la universidad.");
        await expect(motivos).toBeVisible();
        await expect(motivos).toContainText("El programa indicado no coincide con el de tu código estudiantil.");
        await expect(motivos).toBeFocused();
        await expect(dialogoEnvio(page)).toHaveCount(0);
        await expect(page).toHaveURL(/escenario=rechazo/);
    });

    test("envío completo abre el diálogo, envía y navega a /estudiante/preinscripcion", async ({ page }) => {
        const claves = await espiarClaves(page);
        await abrir(page, POSGRADO);
        await llenarObligatoriosPosgrado(page);
        await expect(resumen(page, "Todo listo para enviar")).toBeVisible();

        await botonEnviar(page).click();
        const dialogo = dialogoEnvio(page);
        await expect(dialogo).toBeVisible();
        await expect(dialogo).toContainText("Ana Prueba");
        await expect(dialogo).toContainText("3 de 3 documentos cargados");

        // "Volver a editar" cierra sin enviar y devuelve el foco al botón.
        await dialogo.getByRole("button", { name: "Volver a editar" }).click();
        await expect(dialogo).toHaveCount(0);
        await expect(botonEnviar(page)).toBeFocused();
        expect(await claves()).toHaveLength(0);

        await botonEnviar(page).click();
        await dialogo.getByRole("button", { name: "Enviar", exact: true }).click();
        await expect(page).toHaveURL("/estudiante/preinscripcion");
        // Una clave de idempotencia para el envío, con forma de UUID.
        const usadas = await claves();
        expect(usadas).toHaveLength(1);
        expect(usadas[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
    test("envío de preinscripción llama a POST /api/solicitudes/enviar y redirige a /estudiante/preinscripcion", async ({ page }) => {
        await abrir(page, POSGRADO);

        let envioLlamado = false;
        let cuerpoEnvio = "";

        await page.route(`${API}/solicitudes/enviar`, async (ruta) => {
            envioLlamado = true;
            // El envío va como multipart: los datos del borrador viajan en el campo "datos".
            cuerpoEnvio = ruta.request().postDataBuffer()?.toString() ?? "";
            await ruta.fulfill({
                status: 201,
                contentType: "application/x-ndjson",
                body: `${JSON.stringify({
                    tipo: "resultado",
                    resultado: { ok: true, mensaje: "Preinscripción registrada correctamente." },
                })}\n`,
            });
        });

        await llenarObligatoriosPosgrado(page);

        await botonEnviar(page).click();
        const dialogo = dialogoEnvio(page);
        await expect(dialogo).toBeVisible();

        await dialogo.getByRole("button", { name: "Enviar", exact: true }).click();
        await expect(page).toHaveURL("/estudiante/preinscripcion");

        expect(envioLlamado).toBe(true);
        expect(cuerpoEnvio).toContain('name="datos"');
        expect(cuerpoEnvio).toContain('"nivel":"POSGRADO"');
        expect(cuerpoEnvio).toContain('name="documentos"');
    });


    test("doble clic envía una vez", async ({ page }) => {
        const claves = await espiarClaves(page);
        await abrir(page, POSGRADO);
        await llenarObligatoriosPosgrado(page);
        const destinos: string[] = [];
        page.on("framenavigated", (marco) => {
            if (marco === page.mainFrame()) destinos.push(new URL(marco.url()).pathname);
        });

        await botonEnviar(page).click();
        const dialogo = dialogoEnvio(page);
        await dialogo.getByRole("button", { name: "Enviar", exact: true }).dblclick();
        // Tras el primer clic el botón queda deshabilitado de inmediato.
        await expect(dialogo.getByRole("button", { name: "Enviando…" })).toBeDisabled();

        await expect(page).toHaveURL("/estudiante/preinscripcion");
        // Un segundo envío llegaría unos 300 ms después del primero: se espera a que no llegue.
        await page.waitForTimeout(1000);
        expect(destinos.filter((ruta) => ruta === "/estudiante/preinscripcion")).toHaveLength(1);
        expect(await claves()).toHaveLength(1);
    });

    test("si no se puede generar la clave del envío, el diálogo no queda en Enviando…", async ({ page }) => {
        // Como en http://IP:puerto (un contexto no seguro), donde crypto.randomUUID no existe.
        await page.addInitScript(() => {
            Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
        });
        await abrir(page, POSGRADO);
        await llenarObligatoriosPosgrado(page);

        await botonEnviar(page).click();
        const dialogo = dialogoEnvio(page);
        await dialogo.getByRole("button", { name: "Enviar", exact: true }).click();
        await expect(dialogo.getByRole("alert")).toContainText("No fue posible enviar tu preinscripción.");
        await expect(dialogo.getByRole("button", { name: "Reintentar" })).toBeEnabled();

        await dialogo.getByRole("button", { name: "Volver a editar" }).click();
        await expect(dialogo).toBeHidden();
        await expect(page).toHaveURL(new RegExp(`${RUTA}\\?nivel=POSGRADO`));
    });

    // ── Salir con cambios sin guardar ───────────────────────────────────────────

    test('cambios sin guardar: tocar el logo abre el diálogo y "Seguir aquí" se queda', async ({ page }) => {
        await abrir(page, PREGRADO);
        expect(await avisaAlSalir(page)).toBe(false);

        await page.getByLabel("Nombres (obligatorio)").fill("Ana");
        expect(await avisaAlSalir(page)).toBe(true);

        const logo = page.getByRole("link", { name: /CheckU/ });
        await logo.click();
        const dialogo = page.getByRole("dialog", { name: "Tienes cambios sin guardar" });
        await expect(dialogo).toBeVisible();
        for (const boton of ["Guardar y salir", "Salir sin guardar", "Seguir aquí"])
            await expect(dialogo.getByRole("button", { name: boton })).toBeVisible();

        await dialogo.getByRole("button", { name: "Seguir aquí" }).click();
        await expect(dialogo).toHaveCount(0);
        await expect(page).toHaveURL(PREGRADO);
        await expect(page.locator("#campo-nombres")).toHaveValue("Ana");
        await expect(logo).toBeFocused();
    });

    test('cambios sin guardar: "Guardar y salir" guarda y sigue el enlace', async ({ page }) => {
        await abrir(page, PREGRADO);
        await page.getByLabel("Nombres (obligatorio)").fill("Ana");
        await page.getByRole("navigation", { name: "Ruta" }).getByRole("link", { name: "Inicio" }).click();

        const dialogo = page.getByRole("dialog", { name: "Tienes cambios sin guardar" });
        await dialogo.getByRole("button", { name: "Guardar y salir" }).click();
        await expect(page).toHaveURL("/estudiante/home");

        // Volver (sin recargar) trae lo guardado: el borrador simulado sigue en la memoria de la página.
        await page.goBack();
        await page.locator('main#contenido:not([aria-busy="true"])').waitFor();
        await expect(page.locator("#campo-nombres")).toHaveValue("Ana");
        expect(await avisaAlSalir(page)).toBe(false);
    });

    test.describe("axe con el resumen de errores y con el diálogo abiertos (claro y oscuro)", () => {
        for (const tema of TEMAS)
            for (const ancho of [360, 1280])
                test(`${tema}, ${ancho}px`, async ({ page }) => {
                    await page.setViewportSize({ width: ancho, height: 900 });
                    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
                    await abrir(page, `${PREGRADO}&escenario=rechazo`);

                    // El diálogo de envío (el borrador del escenario está completo).
                    await botonEnviar(page).click();
                    await expect(dialogoEnvio(page)).toBeVisible();
                    await revisarAxe(page);
                    await dialogoEnvio(page).getByRole("button", { name: "Volver a editar" }).click();

                    // El resumen de errores, con un obligatorio vacío.
                    await page.getByLabel("Nombres (obligatorio)").fill("");
                    await botonEnviar(page).click();
                    await expect(resumenErrores(page, "Revisa estos campos antes de enviar")).toBeFocused();
                    await revisarAxe(page);

                    // El diálogo de salida con cambios sin guardar.
                    await page.getByRole("link", { name: /CheckU/ }).click();
                    await expect(page.getByRole("dialog", { name: "Tienes cambios sin guardar" })).toBeVisible();
                    await revisarAxe(page);
                });
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


test("Tarea 37: guarda la discapacidad y no envía valores residuales al responder No", async ({ page }) => {
    await abrir(page, PREGRADO);

    await responder(page, "¿Posee alguna discapacidad?", "Sí");
    await page.getByLabel("Tipo de discapacidad (obligatorio)").selectOption({ label: "Física" });
    await page.locator("#campo-detalles-asistencia").fill("Requiere rampa");

    const primerGuardado = page.waitForRequest(
        (peticion) => peticion.url() === `${API}/solicitudes/borrador` && peticion.method() === "POST",
    );
    await page.getByRole("button", { name: "Guardar para continuar después" }).click();
    const primero = (await primerGuardado).postDataJSON();
    expect(primero.perfil).toMatchObject({
        tieneDiscapacidad: true,
        tipoDiscapacidad: "FISICA",
        detallesAsistencia: "Requiere rampa",
    });

    await responder(page, "¿Posee alguna discapacidad?", "No");
    const segundoGuardado = page.waitForRequest(
        (peticion) => peticion.url() === `${API}/solicitudes/borrador` && peticion.method() === "POST",
    );
    await page.getByRole("button", { name: "Guardar para continuar después" }).click();
    const segundo = (await segundoGuardado).postDataJSON();
    expect(segundo.perfil).toMatchObject({
        tieneDiscapacidad: false,
        tipoDiscapacidad: "",
        detallesAsistencia: "",
    });
});

test("Tarea 28: guarda sin documentos y restaura desde GET después de F5", async ({ page }) => {
    await abrir(page, PREGRADO);
    await page.locator("#campo-nombres").fill("Lisandro");
    const peticion = page.waitForRequest(r => r.url() === `${API}/solicitudes/borrador` && r.method() === "POST");
    await page.getByRole("button", { name: "Guardar para continuar después" }).click();
    const enviado = (await peticion).postDataJSON();
    expect(enviado.documentos).toEqual({});
    expect(enviado.perfil.numeroDocumento).toBe("");
    await expect(page.getByRole("status").filter({ hasText: "Borrador guardado" })).toBeVisible();
    await page.reload();
    await expect(page.locator("#campo-nombres")).toHaveValue("Lisandro");
    await expect(page.getByLabel("Número de documento (obligatorio)")).toHaveValue("");
    const almacenamiento = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]));
    expect(almacenamiento).not.toContain("Lisandro");
    // El ID devuelto queda en el estado React y acompaña el siguiente guardado.
    const segunda = page.waitForRequest(r => r.url() === `${API}/solicitudes/borrador` && r.method() === "POST");
    await page.getByRole("button", { name: "Guardar para continuar después" }).click();
    expect((await segunda).postDataJSON().id_solicitud).toBe(1);
    await expect(page.getByRole("button", { name: "Guardar para continuar después" })).toBeEnabled();
});

test("Tarea 28: un error del backend no anuncia guardado exitoso y permite reintentar", async ({ page }) => {
    await abrir(page, PREGRADO);
    await page.route(`${API}/solicitudes/borrador`, r => r.fulfill({ status: 503, json: { message: "Sin conexión" } }));
    await page.locator("#campo-nombres").fill("Lisandro");
    await page.getByRole("button", { name: "Guardar para continuar después" }).click();
    await expect(
    page.getByRole("alert").filter({ hasText: "El servicio de guardado no está disponible" })
).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Borrador guardado" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Guardar para continuar después" })).toBeEnabled();
});
