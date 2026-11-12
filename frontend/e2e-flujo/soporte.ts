import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, type Browser, type Page } from "@playwright/test";

// Tarea 53: ayudas para las pruebas de flujo. Todo corre contra la aplicación real del entorno de
// levantar-entorno.ps1; los únicos datos son de prueba e inventados.

export const API = "http://localhost:3000/api";
const MOTOR_CONTROL = "http://127.0.0.1:5014/__control";
const CONTENEDOR_BD = process.env.FLUJO_CONTENEDOR_BD ?? "checku-t53-db";
const ARCHIVO_ALMA =
    process.env.FLUJO_ARCHIVO_ALMA ?? path.join(os.tmpdir(), "checku-t53-alma", "alma_simulacion.json");
const CARPETA_CAPTURAS = path.resolve(__dirname, "../../docs/pruebas/tarea53/capturas");

/** Documento inventado del estudiante de prueba; el mismo en el formulario y en el JSON de ALMA. */
export const DOCUMENTO = "1000000001";
// Identidad inventada: las evidencias van a un repositorio público (ver #141). Coincide con levantar-entorno.ps1.
export const ESTUDIANTE = { usuario: "estudiante@ejemplo.edu.co", clave: "flujo-estudiante" };
export const NOMBRES = "Estudiante";
const APELLIDOS = "Prueba";
export const FUNCIONARIA = { usuario: "funcionaria@ejemplo.edu.co", clave: "flujo-funcionaria" };

/** Ejecuta SQL en la base de prueba y devuelve las filas con columnas separadas por `|`. */
export function sql(consulta: string): string[] {
    const salida = execFileSync(
        "docker",
        ["exec", "-i", CONTENEDOR_BD, "psql", "-U", "checku", "-d", "checku_local", "-v", "ON_ERROR_STOP=1", "-qtA"],
        { input: consulta, encoding: "utf8" },
    );
    return salida.split(/\r?\n/).filter(Boolean);
}

export type Clasificacion = "valid" | "invalid" | "inconsistent" | "to_check";
export type EscenarioAlma = "paz_y_salvo" | "prestamos" | "solicitudes" | "multas" | "combinado" | "inconsistente" | "no_encontrado";

/** Elige el motor: `real` (validadores de verdad) o `controlado` (clasificación pedida, por tipo o clave). */
export async function motor(
    modo: "real" | "controlado",
    clasificaciones: Record<string, Clasificacion> = {},
    fallar = false,
): Promise<void> {
    const r = await fetch(MOTOR_CONTROL, { method: "POST", body: JSON.stringify({ modo, clasificaciones, fallar }) });
    expect(r.ok, "El motor de prueba debe estar corriendo (ver e2e-flujo/README.md).").toBe(true);
}

/** Escribe el JSON de ALMA simulado a partir del ejemplo del repositorio, con el escenario pedido. */
export function alma(escenario: EscenarioAlma): void {
    const ejemplo = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, "../../modules/validadores/fuentes/alma/alma_simulacion.example.json"), "utf8"),
    );
    let usuarios: Record<string, unknown> = {};
    if (escenario !== "no_encontrado") {
        const bloque = structuredClone(escenario === "paz_y_salvo" ? ejemplo.usuarios.T00000001 : ejemplo.escenarios[escenario]);
        for (const id of bloque.user.user_identifier) if (id.id_type.value === "CC" && !id.value) id.value = DOCUMENTO;
        bloque.user.first_name = NOMBRES;
        bloque.user.last_name = APELLIDOS;
        usuarios = { T00000001: bloque };
    }
    fs.writeFileSync(ARCHIVO_ALMA, JSON.stringify({ usuarios }, null, 2));
}

/** Deja la base como la de un estudiante nuevo, con un periodo abierto, y el motor real con ALMA al día. */
export async function reiniciar(): Promise<void> {
    sql(`TRUNCATE notificaciones, revisiones, historial_validaciones, validaciones, rutas, documentos, entregas,
           solicitud_programa, solicitud_grado, periodos_grado RESTART IDENTITY CASCADE;
         DELETE FROM usuarios WHERE correo LIKE '%@flujo.prueba';
         UPDATE usuarios SET nombres='${NOMBRES}', apellidos='${APELLIDOS}', correo='${ESTUDIANTE.usuario}' WHERE id_usuario=1;
         UPDATE usuarios SET nombres='Funcionaria', apellidos='Prueba', correo='${FUNCIONARIA.usuario}' WHERE id_usuario=2;
         INSERT INTO periodos_grado (nombre, fecha_inicio, fecha_fin, fecha_graduacion)
         VALUES ('Grados de prueba', CURRENT_DATE - 10, CURRENT_DATE + 40, CURRENT_DATE + 60);`);
    alma("paz_y_salvo");
    await motor("real");
}

/** Guarda una evidencia. El nombre empieza por el número del escenario, p. ej. `01-a-formulario`. */
export async function captura(page: Page, nombre: string, completa = true): Promise<void> {
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(CARPETA_CAPTURAS, `${nombre}.png`), fullPage: completa, animations: "disabled" });
}

/** Ingresa por la pantalla de inicio de sesión, como una persona. */
export async function entrar(page: Page, { usuario, clave }: { usuario: string; clave: string }): Promise<void> {
    await page.goto("/");
    await page.getByLabel("Correo institucional o usuario de prueba").fill(usuario);
    await page.getByLabel("Contraseña").fill(clave);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL((url) => url.pathname !== "/");
}

/** PDF mínimo y bien formado, con texto inventado: los validadores reales lo analizan y lo rechazan. */
export function pdf(nombre: string, titulo = nombre) {
    const texto = `DOCUMENTO DE PRUEBA - ${titulo} - datos inventados`.replace(/[()\\]/g, "");
    const flujo = `BT /F1 12 Tf 72 720 Td (${texto}) Tj ET`;
    const objetos = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let cuerpo = "%PDF-1.4\n";
    const posiciones: number[] = [];
    objetos.forEach((objeto, i) => {
        posiciones.push(cuerpo.length);
        cuerpo += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
    });
    const xref = cuerpo.length;
    cuerpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const p of posiciones) cuerpo += `${String(p).padStart(10, "0")} 00000 n \n`;
    cuerpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return { name: `${nombre}.pdf`, mimeType: "application/pdf", buffer: Buffer.from(cuerpo, "latin1") };
}

/** Abre el formulario desde el inicio: Nueva preinscripción → Iniciar preinscripción para el nivel. */
export async function abrirFormulario(page: Page, nivel: "pregrado" | "posgrado"): Promise<void> {
    await page.goto("/estudiante/home");
    await page.getByRole("link", { name: "Nueva preinscripción" }).first().click();
    await page.waitForURL("**/estudiante/bienvenida");
    await page.getByRole("link", { name: new RegExp(`Iniciar preinscripción para ${nivel}`, "i") }).click();
    await page.waitForURL("**/estudiante/iniciar_preinscripcion**");
    await expect(page.getByLabel("Nombres (obligatorio)")).toBeVisible();
}

/** Responde una pregunta de Sí o No del formulario. */
async function responder(page: Page, pregunta: string, respuesta: "Sí" | "No"): Promise<void> {
    await page.getByRole("radiogroup", { name: pregunta }).getByRole("radio", { name: respuesta }).check();
}

/**
 * Llena los campos obligatorios con los datos del estudiante de prueba.
 * `estudios: false` deja vacía la parte obligatoria de Estudios en posgrado.
 */
export async function llenarDatos(
    page: Page,
    {
        doble = false,
        nivel = "pregrado",
        estudios = true,
    }: { doble?: boolean; nivel?: "pregrado" | "posgrado"; estudios?: boolean } = {},
): Promise<void> {
    await page.getByLabel("Nombres (obligatorio)").fill(NOMBRES);
    await page.getByLabel("Apellidos (obligatorio)").fill(APELLIDOS);
    await page.getByLabel("Tipo de documento (obligatorio)").selectOption({ label: "Cédula de ciudadanía" });
    await page.getByLabel("Número de documento (obligatorio)").fill(DOCUMENTO);
    await page.getByLabel("Fecha de nacimiento (obligatorio)").fill("2000-01-01");
    await page.getByLabel("Género (obligatorio)").selectOption({ label: "Otro" });
    await page.getByLabel("Celular (obligatorio)").fill("3000000000");
    await page.getByLabel("Departamento (obligatorio)").fill("Bolívar");
    await page.getByLabel("Ciudad o municipio (obligatorio)").fill("Cartagena");
    await page.getByLabel("Dirección (obligatorio)").fill("Calle de ejemplo 1");
    await responder(page, "¿Posee alguna discapacidad?", "No");
    await page.getByLabel("Código estudiantil (obligatorio)").fill("T00000001");
    await page.locator("#campo-modalidad-1").check();
    await page.locator("#campo-programa-1").selectOption({ index: 1 });
    if (nivel === "pregrado") await page.locator("#campo-opcion-grado-1").selectOption({ index: 1 });
    await responder(page, "¿Solicitas grado en un segundo programa?", doble ? "Sí" : "No");
    if (doble) {
        await page.locator("#campo-modalidad-2").check();
        await page.locator("#campo-programa-2").selectOption({ index: 2 });
        if (nivel === "pregrado") await page.locator("#campo-opcion-grado-2").selectOption({ index: 1 });
    }
    if (nivel === "pregrado") {
        await responder(page, "¿Conoces tu número de registro?", "No");
        await page.getByLabel("Fecha del examen (obligatorio)").fill("2024-06-01");
        await responder(page, "¿Eres empleado de la UTB?", "No");
        await responder(page, "¿Eres hijo o hija de un empleado de la UTB?", "No");
    }
    if (nivel === "posgrado" && estudios) await llenarEstudios(page);
}

/** Llena lo obligatorio de Estudios en posgrado. */
export async function llenarEstudios(page: Page): Promise<void> {
    await page.locator("#campo-nivel-estudios").selectOption({ index: 1 });
    await page.locator("#campo-titulo-obtenido").fill("Ingeniero de prueba");
    await responder(page, "¿Eres egresado o egresada de un pregrado de la UTB?", "No");
}

/** Claves de documento que el formulario está pidiendo (lo que ve el estudiante). */
export async function documentosPedidos(page: Page): Promise<string[]> {
    const ids = await page.locator('input[type="file"][id^="documento-"]').evaluateAll((els) => els.map((e) => e.id));
    return ids.map((id) => id.replace(/^documento-/, ""));
}

export async function adjuntarTodos(page: Page, nombre: (clave: string) => string = (c) => c): Promise<string[]> {
    const claves = await documentosPedidos(page);
    for (const clave of claves) await page.locator(`#documento-${clave}`).setInputFiles(pdf(nombre(clave)));
    return claves;
}

/** Envía y espera a que termine el análisis; `alProgreso` recibe la página mientras se analiza. */
export async function enviar(page: Page, alProgreso?: (page: Page) => Promise<void>): Promise<void> {
    const dialogo = page.getByRole("dialog", { name: "Revisa tu información antes de enviar" });
    // Si el envío se rechaza, falla enseguida con el mensaje de la pantalla en vez de esperar el límite.
    const rechazo = page.getByRole("alert").filter({ hasText: "No se pudo enviar" });
    for (let intento = 0; ; intento++) {
        await page.getByRole("button", { name: "Enviar preinscripción" }).click();
        await expect(dialogo).toBeVisible();
        await dialogo.getByRole("button", { name: /enviar/i }).last().click();
        if (alProgreso) await alProgreso(page);
        await expect
            .poll(async () => (await rechazo.count()) > 0 || !page.url().includes("iniciar_preinscripcion"), { timeout: 200_000 })
            .toBe(true);
        if (!(await rechazo.count())) break;
        const motivo = (await rechazo.first().innerText()).replace(/\s+/g, " ");
        // El backend admite 8 envíos por minuto por IP (#167) y la suite los hace más rápido.
        if (!motivo.includes("Too Many Requests") || intento === 2) throw new Error(`Envío rechazado: ${motivo}`);
        await page.waitForTimeout(65_000);
    }
    await page.waitForLoadState("networkidle");
}

/** Crea una preinscripción completa por el formulario. Devuelve el id de la solicitud creada. */
export async function preinscribir(
    page: Page,
    { nivel = "pregrado", doble = false }: { nivel?: "pregrado" | "posgrado"; doble?: boolean } = {},
): Promise<number> {
    await abrirFormulario(page, nivel);
    await llenarDatos(page, { doble, nivel });
    await adjuntarTodos(page);
    await enviar(page);
    return Number(sql("SELECT max(id_solicitud) FROM solicitud_grado")[0]);
}

/** Estado actual de cada documento vigente: `tipo-orden` → estado, tal como está en la BD. */
export function documentosEnBd(idSolicitud: number): Record<string, string> {
    const filas = sql(`SELECT DISTINCT ON (tipo_documento, orden) tipo_documento, orden, estado FROM documentos
        WHERE id_solicitud=${idSolicitud} AND id_entrega IS NOT NULL ORDER BY tipo_documento, orden, version DESC`);
    return Object.fromEntries(
        filas.map((fila) => {
            const [tipo, orden, estado] = fila.split("|");
            return [orden === "1" ? tipo : `${tipo}-${orden}`, estado];
        }),
    );
}

export function estadoSolicitud(idSolicitud: number): string {
    return sql(`SELECT estado FROM solicitud_grado WHERE id_solicitud=${idSolicitud}`)[0];
}

/** Abre el dashboard con los filtros desplegados (vienen plegados) y elige el primer periodo. */
export async function dashboardConPeriodo(page: Page): Promise<void> {
    await page.goto("/funcionario/dashboard");
    await expect(page.locator("#periodo-grado option").nth(1)).toBeAttached();
    const mostrar = page.getByRole("button", { name: "Mostrar filtros" });
    if (await mostrar.count()) await mostrar.click();
    await page.locator("#periodo-grado").selectOption({ index: 1 });
}

/** Abre el detalle de la funcionaria en una pestaña. */
export async function abrirDetalle(page: Page, idSolicitud: number, pestana?: string): Promise<void> {
    await page.goto(`/funcionario/detalle_preinscripcion/${idSolicitud}`);
    await expect(page.getByRole("tab").first()).toBeVisible();
    if (pestana) await page.getByRole("tab", { name: pestana }).click();
}

/** Registra una acción de revisión desde la pestaña «Acciones de revisión». */
export async function accionRevision(
    page: Page,
    idSolicitud: number,
    accion: "comentario" | "recarga" | "aceptada" | "anulada",
    comentario = "",
    documentos: string[] = [],
): Promise<void> {
    await abrirDetalle(page, idSolicitud, "Acciones");
    await page.getByLabel("Acción").selectOption(accion);
    for (const nombre of documentos) await page.getByRole("checkbox", { name: nombre }).check();
    if (comentario) await page.getByLabel(/^Comentario/).fill(comentario);
    await page.locator("form").getByRole("button").last().click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Acción registrada" })).toBeVisible();
}

/** Abre otra sesión en una ventana aparte (estudiante y funcionaria a la vez). */
export async function sesion(browser: Browser, usuario: { usuario: string; clave: string }): Promise<Page> {
    const contexto = await browser.newContext({
        baseURL: "http://localhost:3001",
        locale: "es-CO",
        timezoneId: "America/Bogota",
        viewport: { width: 1280, height: 900 },
    });
    const page = await contexto.newPage();
    await entrar(page, usuario);
    return page;
}

/** Abre la preinscripción del estudiante en la lista de documentos. */
export async function abrirPreinscripcion(page: Page, idSolicitud: number): Promise<void> {
    await page.goto(`/estudiante/preinscripcion?solicitud=${idSolicitud}`);
    await expect(page.getByRole("heading", { name: "Detalle de mi preinscripción" })).toBeVisible();
    const pestana = page.getByRole("tab", { name: "Tus documentos" });
    if (await pestana.count()) await pestana.click();
}

/** Corrige un documento por la pantalla: Volver a cargar → elegir PDF → Enviar documentos. */
export async function reenviarPorPantalla(page: Page, idSolicitud: number, nombreDocumento: string): Promise<void> {
    await abrirPreinscripcion(page, idSolicitud);
    const tarjeta = page.locator("article", { hasText: nombreDocumento }).first();
    const selector = page.waitForEvent("filechooser");
    await tarjeta.getByRole("button", { name: "Volver a cargar" }).click();
    await (await selector).setFiles(pdf("corregido"));
    const respuesta = page.waitForResponse((r) => r.url().includes("/correcciones") && r.request().method() === "POST", { timeout: 120_000 });
    await page.getByRole("button", { name: "Enviar documentos" }).click();
    const r = await respuesta;
    expect(r.ok(), `El reenvío debe aceptarse: ${r.status()}`).toBe(true);
    await page.waitForLoadState("networkidle");
}

/** Intenta un reenvío directo a la API, sin pasar por la pantalla, y devuelve la respuesta. */
export async function reenviarPorApi(page: Page, idSolicitud: number, idDocumento: number, clave: string) {
    return page.request.post(`${API}/solicitudes/${idSolicitud}/correcciones`, {
        multipart: { ids: JSON.stringify([idDocumento]), clave, documentos: pdf("corregido") },
    });
}

export function idDocumentoVigente(idSolicitud: number, tipo: string): number {
    return Number(
        sql(`SELECT id_documento FROM documentos WHERE id_solicitud=${idSolicitud} AND tipo_documento='${tipo}' AND orden=1
             AND id_entrega IS NOT NULL ORDER BY version DESC LIMIT 1`)[0],
    );
}

export interface SolicitudSembrada {
    correo: string;
    nivel: "PREGRADO" | "POSGRADO";
    estado: "VALIDA" | "NO_VALIDA" | "INCONSISTENTE" | "POR_REVISAR" | "ACEPTADA" | "CERRADA" | "CANCELADA" | "BORRADOR";
    periodo: string;
    /** Días antes de hoy en que se hizo el envío. */
    hace: number;
}

/** Crea solicitudes de otros estudiantes por SQL (el login solo admite uno): solo para el dashboard. */
export function sembrar(solicitudes: SolicitudSembrada[]): void {
    solicitudes.forEach((s, i) => {
        const correo = `${s.correo}@flujo.prueba`;
        sql(`INSERT INTO usuarios (nombres, apellidos, correo, rol, codigo_estudiante)
               VALUES ('Sembrado', '${s.correo}', '${correo}', 'ESTUDIANTE', 'S${String(i).padStart(8, "0")}')
               ON CONFLICT (correo) DO NOTHING;
             WITH nueva AS (
               INSERT INTO solicitud_grado (id_estudiante, id_periodo, tipo_solicitud, estado)
               SELECT u.id_usuario, p.id, '${s.nivel}', '${s.estado}' FROM usuarios u, periodos_grado p
               WHERE u.correo='${correo}' AND p.nombre='${s.periodo}' RETURNING id_solicitud)
             INSERT INTO entregas (id_solicitud, numero_entrega, tipo_entrega, fecha_entrega, fecha_entrega_bogota)
             SELECT id_solicitud, 1, 'INICIAL', now() - interval '${s.hace} days', (now() AT TIME ZONE 'America/Bogota')::date - ${s.hace} FROM nueva;`);
    });
}
