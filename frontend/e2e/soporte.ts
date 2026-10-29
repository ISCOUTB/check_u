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

export interface PeriodoDemo {
    id: string;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    fechaGraduacion: string;
    estado: "ABIERTO" | "CERRADO";
}

export const PERIODO_DEMO: PeriodoDemo = {
    id: "periodo-2026-1",
    nombre: "Grado octubre 2026",
    fechaInicio: "2026-10-01",
    fechaFin: "2026-10-31",
    fechaGraduacion: "2026-11-15",
    estado: "ABIERTO",
};

/** Campos cuyas opciones se administran desde el panel del funcionario (Tarea 40). */
export type CampoOpcionDemo =
    | "TIPO_DOCUMENTO"
    | "GENERO"
    | "PROGRAMA"
    | "OPCION_GRADO"
    | "TIPO_DISCAPACIDAD";

export interface OpcionCampoDemo {
    id: number;
    campo: CampoOpcionDemo;
    valor: string;
    etiqueta: string;
    orden: number;
}

/** Catálogo inicial del panel: los mismos valores que siembra la base de datos. */
export const OPCIONES_CAMPO_DEMO: readonly OpcionCampoDemo[] = [
    { id: 1, campo: "TIPO_DOCUMENTO", valor: "CC", etiqueta: "Cédula de ciudadanía", orden: 1 },
    { id: 2, campo: "TIPO_DOCUMENTO", valor: "TI", etiqueta: "Tarjeta de identidad", orden: 2 },
    { id: 3, campo: "TIPO_DOCUMENTO", valor: "CE", etiqueta: "Cédula de extranjería", orden: 3 },
    { id: 4, campo: "TIPO_DOCUMENTO", valor: "PASAPORTE", etiqueta: "Pasaporte", orden: 4 },

    { id: 5, campo: "GENERO", valor: "FEMENINO", etiqueta: "Femenino", orden: 1 },
    { id: 6, campo: "GENERO", valor: "MASCULINO", etiqueta: "Masculino", orden: 2 },
    { id: 7, campo: "GENERO", valor: "OTRO", etiqueta: "Otro", orden: 3 },
    { id: 8, campo: "GENERO", valor: "NO_INFORMA", etiqueta: "Prefiero no decirlo", orden: 4 },

    { id: 9, campo: "PROGRAMA", valor: "PROGRAMA_DE_EJEMPLO", etiqueta: "Programa de ejemplo", orden: 1 },
    { id: 10, campo: "PROGRAMA", valor: "OTRO_PROGRAMA_DE_EJEMPLO", etiqueta: "Otro programa de ejemplo", orden: 2 },
    { id: 11, campo: "PROGRAMA", valor: "INGENIERIA", etiqueta: "Ingeniería", orden: 3 },
    { id: 12, campo: "PROGRAMA", valor: "INGENIERIA_DE_SISTEMAS", etiqueta: "Ingeniería de Sistemas", orden: 4 },

    { id: 13, campo: "OPCION_GRADO", valor: "TRABAJO_DE_GRADO", etiqueta: "Trabajo de grado", orden: 1 },
    { id: 14, campo: "OPCION_GRADO", valor: "PRACTICA_PROFESIONAL", etiqueta: "Práctica profesional", orden: 2 },
    { id: 15, campo: "OPCION_GRADO", valor: "CURSO_POSGRADO", etiqueta: "Curso de posgrado", orden: 3 },
    { id: 16, campo: "OPCION_GRADO", valor: "EMPRENDIMIENTO", etiqueta: "Proyecto de emprendimiento", orden: 4 },

    { id: 17, campo: "TIPO_DISCAPACIDAD", valor: "SENSORIAL", etiqueta: "Sensorial", orden: 1 },
    { id: 18, campo: "TIPO_DISCAPACIDAD", valor: "FISICA", etiqueta: "Física", orden: 2 },
    { id: 19, campo: "TIPO_DISCAPACIDAD", valor: "INTELECTUAL", etiqueta: "Intelectual", orden: 3 },
    { id: 20, campo: "TIPO_DISCAPACIDAD", valor: "ORGANOS", etiqueta: "Órganos", orden: 4 },
    { id: 21, campo: "TIPO_DISCAPACIDAD", valor: "OTRA", etiqueta: "Otra", orden: 5 },
];

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
    let periodos: PeriodoDemo[] = [{ ...PERIODO_DEMO }];
    await page.route(`${API}/periodos-grado`, async (ruta) => {
        if (rol !== "funcionario") {
            await ruta.fulfill({ status: 403, json: { message: "Acceso restringido a funcionarios" } });
            return;
        }
        const metodo = ruta.request().method();
        if (metodo === "GET") {
            await ruta.fulfill({ status: 200, json: periodos });
            return;
        }
        if (metodo === "POST") {
            const nuevo = { id: `periodo-${periodos.length + 1}`, ...ruta.request().postDataJSON() } as PeriodoDemo;
            periodos = [...periodos, nuevo];
            await ruta.fulfill({ status: 201, json: nuevo });
            return;
        }
        await ruta.fulfill({ status: 405, json: { message: "Método no permitido" } });
    });
    await page.route(`${API}/periodos-grado/*`, async (ruta) => {
        if (rol !== "funcionario") {
            await ruta.fulfill({ status: 403, json: { message: "Acceso restringido a funcionarios" } });
            return;
        }
        if (ruta.request().method() !== "PATCH") {
            await ruta.fulfill({ status: 405, json: { message: "Método no permitido" } });
            return;
        }
        const id = new URL(ruta.request().url()).pathname.split("/").pop();
        const indice = periodos.findIndex((p) => p.id === id);
        if (indice === -1) {
            await ruta.fulfill({ status: 404, json: { message: "Periodo no encontrado" } });
            return;
        }
        const actualizado = { ...periodos[indice], ...ruta.request().postDataJSON() } as PeriodoDemo;
        periodos = periodos.map((p, i) => (i === indice ? actualizado : p));
        await ruta.fulfill({ status: 200, json: actualizado });
    });
    // Panel de opciones del formulario (Tarea 40): CRUD, orden e importación en memoria.
    let opcionesCampo: OpcionCampoDemo[] = OPCIONES_CAMPO_DEMO.map((opcion) => ({ ...opcion }));
    let siguienteOpcion = Math.max(...opcionesCampo.map((opcion) => opcion.id)) + 1;

    const valorDesdeEtiqueta = (etiqueta: string): string =>
        etiqueta
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "") || `OPCION_${siguienteOpcion}`;

    const agregarOpcion = (
        campo: CampoOpcionDemo,
        etiqueta: string,
        valor?: string,
    ): { opcion?: OpcionCampoDemo; duplicada?: boolean } => {
        const nombre = etiqueta.trim();
        const interno = (valor?.trim() || valorDesdeEtiqueta(nombre)).toUpperCase();
        const repetida = opcionesCampo.some(
            (opcion) =>
                opcion.campo === campo &&
                (opcion.valor === interno ||
                    opcion.etiqueta.localeCompare(nombre, "es", { sensitivity: "accent" }) === 0),
        );
        if (repetida) return { duplicada: true };
        const orden = opcionesCampo.filter((opcion) => opcion.campo === campo).length + 1;
        const opcion: OpcionCampoDemo = {
            id: siguienteOpcion++,
            campo,
            valor: interno,
            etiqueta: nombre,
            orden,
        };
        opcionesCampo = [...opcionesCampo, opcion];
        return { opcion };
    };

    const ordenarCampo = (campo: CampoOpcionDemo): OpcionCampoDemo[] => {
        const delCampo = opcionesCampo.filter((opcion) => opcion.campo === campo);
        return [...delCampo].sort((a, b) => a.orden - b.orden || a.id - b.id);
    };

    const leerCsv = (texto: string): Array<{ linea: number; campos: string[] }> =>
        texto
            .replace(/^\uFEFF/, "")
            .split(/\r?\n/)
            .map((linea, indice) => {
                const campos: string[] = [];
                let actual = "";
                let entreComillas = false;
                for (let posicion = 0; posicion < linea.length; posicion++) {
                    const caracter = linea[posicion];
                    if (caracter === '"') {
                        if (entreComillas && linea[posicion + 1] === '"') {
                            actual += '"';
                            posicion++;
                        } else {
                            entreComillas = !entreComillas;
                        }
                    } else if ((caracter === "," || caracter === ";") && !entreComillas) {
                        campos.push(actual);
                        actual = "";
                    } else {
                        actual += caracter;
                    }
                }
                campos.push(actual);
                return { linea: indice + 1, campos };
            });

    const esCabeceraCsv = (etiqueta: string): boolean =>
        ["nombre", "etiqueta", "opcion", "opción", "valor"].includes(etiqueta.trim().toLowerCase());

    await page.route(`${API}/opciones-campo`, async (ruta) => {
        if (!rol) {
            await ruta.fulfill({ status: 401, json: { message: "Sesión no válida o expirada" } });
            return;
        }
        const metodo = ruta.request().method();
        if (metodo === "GET") {
            await ruta.fulfill({ status: 200, json: opcionesCampo });
            return;
        }
        if (rol !== "funcionario") {
            await ruta.fulfill({ status: 403, json: { message: "Acceso restringido a funcionarios" } });
            return;
        }
        if (metodo !== "POST") {
            await ruta.fulfill({ status: 405, json: { message: "Método no permitido" } });
            return;
        }
        const datos = ruta.request().postDataJSON() as { campo?: CampoOpcionDemo; etiqueta?: string };
        if (!datos.campo || !datos.etiqueta?.trim()) {
            await ruta.fulfill({ status: 400, json: { message: "El nombre de la opción es obligatorio." } });
            return;
        }
        const resultado = agregarOpcion(datos.campo, datos.etiqueta);
        if (!resultado.opcion) {
            await ruta.fulfill({ status: 409, json: { message: "Ya existe una opción con ese nombre." } });
            return;
        }
        await ruta.fulfill({ status: 201, json: resultado.opcion });
    });

    await page.route(`${API}/opciones-campo/*`, async (ruta) => {
        if (!rol) {
            await ruta.fulfill({ status: 401, json: { message: "Sesión no válida o expirada" } });
            return;
        }
        if (rol !== "funcionario") {
            await ruta.fulfill({ status: 403, json: { message: "Acceso restringido a funcionarios" } });
            return;
        }
        const metodo = ruta.request().method();
        const accion = new URL(ruta.request().url()).pathname.split("/").pop() ?? "";

        if (accion === "importar" && metodo === "POST") {
            const datos = ruta.request().postDataJSON() as { campo?: CampoOpcionDemo; texto?: string };
            if (!datos.campo) {
                await ruta.fulfill({ status: 400, json: { message: "El campo es obligatorio." } });
                return;
            }
            const duplicados: Array<{ linea: number; valor: string }> = [];
            const vacias: number[] = [];
            const invalidos: Array<{ linea: number; valor: string; motivo: string }> = [];
            let creadas = 0;
            let total = 0;
            for (const [indice, fila] of leerCsv(datos.texto ?? "").entries()) {
                const etiqueta = (fila.campos[0] ?? "").trim();
                const valor = (fila.campos[1] ?? "").trim();
                if (!etiqueta && !valor) {
                    if (!(indice === 0 && esCabeceraCsv(etiqueta))) vacias.push(fila.linea);
                    continue;
                }
                if (indice === 0 && !valor && esCabeceraCsv(etiqueta)) continue;
                total++;
                if (!etiqueta) {
                    invalidos.push({ linea: fila.linea, valor, motivo: "Falta el nombre visible" });
                    continue;
                }
                const resultado = agregarOpcion(datos.campo, etiqueta, valor);
                if (resultado.opcion) creadas++;
                else duplicados.push({ linea: fila.linea, valor: etiqueta });
            }
            await ruta.fulfill({
                status: 200,
                json: { campo: datos.campo, creadas, total, duplicados, vacias, invalidos },
            });
            return;
        }

        if (accion === "orden" && metodo === "PATCH") {
            const datos = ruta.request().postDataJSON() as { campo?: CampoOpcionDemo; ids?: number[] };
            if (!datos.campo || !Array.isArray(datos.ids)) {
                await ruta.fulfill({ status: 400, json: { message: "El orden enviado no es válido." } });
                return;
            }
            datos.ids.forEach((id, indice) => {
                opcionesCampo = opcionesCampo.map((opcion) =>
                    opcion.id === id ? { ...opcion, orden: indice + 1 } : opcion,
                );
            });
            await ruta.fulfill({ status: 200, json: ordenarCampo(datos.campo) });
            return;
        }

        const id = Number(accion);
        if (!Number.isInteger(id)) {
            await ruta.fulfill({ status: 404, json: { message: "Opción no encontrada" } });
            return;
        }
        if (metodo === "DELETE") {
            if (!opcionesCampo.some((opcion) => opcion.id === id)) {
                await ruta.fulfill({ status: 404, json: { message: "Opción no encontrada" } });
                return;
            }
            opcionesCampo = opcionesCampo.filter((opcion) => opcion.id !== id);
            await ruta.fulfill({ status: 200, json: { ok: true } });
            return;
        }
        if (metodo === "PATCH") {
            const datos = ruta.request().postDataJSON() as { etiqueta?: string };
            if (!datos.etiqueta?.trim()) {
                await ruta.fulfill({ status: 400, json: { message: "El nombre de la opción es obligatorio." } });
                return;
            }
            opcionesCampo = opcionesCampo.map((opcion) =>
                opcion.id === id ? { ...opcion, etiqueta: datos.etiqueta!.trim() } : opcion,
            );
            await ruta.fulfill({ status: 200, json: opcionesCampo.find((opcion) => opcion.id === id) });
            return;
        }
        await ruta.fulfill({ status: 405, json: { message: "Método no permitido" } });
    });

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
    // El cliente lee el progreso como NDJSON, igual que el backend real.
    const respuestaEnvio = [
        { tipo: "progreso", etapa: "Verificando documentos.", porcentaje: 60, estado: "procesando" },
        {
            tipo: "resultado",
            resultado: {
                ok: true,
                mensaje: "Preinscripción registrada correctamente. Pendiente de análisis.",
            },
        },
    ]
        .map((evento) => JSON.stringify(evento))
        .join("\n");
    await page.route(`${API}/solicitudes/enviar`, (ruta) =>
        rol === "estudiante"
            ? ruta.fulfill({
                  status: 201,
                  contentType: "application/x-ndjson",
                  body: `${respuestaEnvio}\n`,
              })
            : rol === "funcionario"
              ? ruta.fulfill({ status: 403, json: { message: "Acceso restringido a estudiantes" } })
              : ruta.fulfill({ status: 401, json: { message: "Sesión no válida o expirada" } }),
    );
    let borrador: Record<string, unknown> | null = null;
    await page.route(`${API}/solicitudes/borrador`, async (ruta) => {
        if (rol !== "estudiante") {
            await ruta.fulfill({ status: rol ? 403 : 401, json: { message: "Acceso restringido" } });
            return;
        }
        if (ruta.request().method() === "GET") {
            await ruta.fulfill({ status: 200, json: {
                ok: true, id_solicitud: borrador ? 1 : null, estado: borrador ? "BORRADOR" : null, borrador,
            } });
            return;
        }
        const guardadoEn = await page.evaluate(() => new Date().toISOString());
        borrador = { ...ruta.request().postDataJSON(), guardadoEn };
        // Latencia del servidor simulado para comprobar el estado de espera del botón.
        await new Promise(resolve => setTimeout(resolve, 300));
        await ruta.fulfill({ status: 201, json: {
            ok: true, id_solicitud: 1, estado: "BORRADOR", guardadoEn,
            mensaje: "Borrador guardado exitosamente",
        } });
    });
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
