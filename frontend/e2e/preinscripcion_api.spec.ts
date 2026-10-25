import { expect, test } from "@playwright/test";
import {
    cargarPreinscripcion,
    enviarPreinscripcion,
    escenarioDesde,
    formatearGuardado,
    guardarBorrador,
    tamanoMaximoPdfBytes,
} from "@/app/estudiante/iniciar_preinscripcion/api";
import { documentosRequeridos } from "@/app/estudiante/documentos-requeridos";
import { GENEROS, MODALIDADES, TIPOS_DOCUMENTO } from "@/app/estudiante/iniciar_preinscripcion/constantes";
import { borradorVacio } from "@/app/estudiante/iniciar_preinscripcion/tipos";

// Pruebas del cliente HTTP y escenarios de demostración; no necesitan navegador.

// Simula HTTP; cada prueba tiene un servidor nuevo.
const fetchOriginal = globalThis.fetch;
test.beforeEach(() => {
    let borrador: Record<string, unknown> | null = null;
    globalThis.fetch = async (_entrada, opciones) => {
        if (opciones?.method === "POST") {
            const guardadoEn = new Date().toISOString();
            borrador = { ...JSON.parse(String(opciones.body)), guardadoEn };
            return Response.json({ ok: true, id_solicitud: 42, estado: "BORRADOR", guardadoEn });
        }
        return Response.json({ ok: true, id_solicitud: borrador ? 42 : null, estado: borrador ? "BORRADOR" : null, borrador });
    };
});
test.afterEach(() => { globalThis.fetch = fetchOriginal; });

test("escenarioDesde reconoce borrador, rechazo y enviada", () => {
    expect(escenarioDesde("borrador")).toBe("borrador");
    expect(escenarioDesde("rechazo")).toBe("rechazo");
    expect(escenarioDesde("enviada")).toBe("enviada");
});

test("escenarioDesde devuelve ninguno para cualquier otro valor", () => {
    for (const valor of [undefined, "", "ninguno", "otro", "BORRADOR", " borrador"]) {
        expect(escenarioDesde(valor)).toBe("ninguno");
    }
});

test("escenarioDesde ignora el escenario en producción", () => {
    const entorno = process.env as Record<string, string | undefined>;
    const anterior = entorno.NODE_ENV;
    entorno.NODE_ENV = "production";
    try {
        for (const valor of ["borrador", "rechazo", "enviada"]) {
            expect(escenarioDesde(valor)).toBe("ninguno");
        }
    } finally {
        entorno.NODE_ENV = anterior;
    }
});

test("borradorVacio deja todo sin llenar y con el correo", () => {
    const vacio = borradorVacio("PREGRADO", "vacio@utb.edu.co");
    expect(vacio.nivel).toBe("PREGRADO");
    expect(vacio.correo).toBe("vacio@utb.edu.co");
    expect(vacio.nombres).toBe("");
    expect(vacio.apellidos).toBe("");
    expect(vacio.codigoEstudiantil).toBe("");
    expect(vacio.segundoPrograma).toBeNull();
    expect(vacio.programas.map((p) => p.orden)).toEqual([1, 2]);
    expect(vacio.programas.every((p) => p.programa === "" && p.modalidad === "" && p.tipoOpcionGrado === "")).toBe(true);
    expect(vacio.experiencia.map((e) => e.orden)).toEqual([1, 2]);
    expect(vacio.pregrado.conoceRegistroSaberPro).toBeNull();
    expect(vacio.pregrado.esEmpleadoUtb).toBeNull();
    expect(vacio.posgrado.esEgresadoPregradoUtb).toBeNull();
    expect(Object.values(vacio.perfil).every((valor) => valor === "")).toBe(true);
    expect(vacio.documentos).toEqual({});
    expect(vacio.guardadoEn).toBeNull();
});

test("borradorVacio no comparte objetos entre llamadas", () => {
    const uno = borradorVacio("PREGRADO", "a@utb.edu.co");
    const otro = borradorVacio("PREGRADO", "a@utb.edu.co");
    uno.programas[0].programa = "Cambiado";
    uno.documentos["identification"] = { id: "identification", nombre: "a.pdf", tamano: 1 };
    expect(otro.programas[0].programa).toBe("");
    expect(otro.documentos).toEqual({});
});

test("cargarPreinscripcion sin escenario da sin_borrador y un borrador vacío con el correo", async () => {
    const respuesta = await cargarPreinscripcion("PREGRADO", "ninguno@utb.edu.co", "ninguno");
    expect(respuesta.estado).toBe("sin_borrador");
    expect(respuesta.borrador).toEqual(borradorVacio("PREGRADO", "ninguno@utb.edu.co"));
});

test("rechazo carga un borrador completo para pregrado y posgrado", async () => {
    // Completo: se puede pulsar "Enviar" de inmediato y ver el rechazo simulado.
    for (const nivel of ["PREGRADO", "POSGRADO"] as const) {
        const correo = `rechazo-carga-${nivel.toLowerCase()}@utb.edu.co`;
        const respuesta = await cargarPreinscripcion(nivel, correo, "rechazo");
        expect(respuesta.estado).toBe("borrador");

        const { borrador } = respuesta;
        expect(borrador.nivel).toBe(nivel);
        expect(borrador.correo).toBe(correo);

        // Obligatorios de la sección 4 del spec.
        const obligatorios = {
            nombres: borrador.nombres,
            apellidos: borrador.apellidos,
            tipoDocumento: borrador.perfil.tipoDocumento,
            numeroDocumento: borrador.perfil.numeroDocumento,
            correo: borrador.correo,
            codigoEstudiantil: borrador.codigoEstudiantil,
            programa: borrador.programas[0].programa,
            modalidad: borrador.programas[0].modalidad,
        };
        for (const [campo, valor] of Object.entries(obligatorios)) {
            expect(valor.trim(), `${nivel}: ${campo} sin llenar`).not.toBe("");
        }
        expect(borrador.nombres).toBe("Ana");
        expect(borrador.apellidos).toBe("Prueba");
        expect(TIPOS_DOCUMENTO.map((o) => o.valor)).toContain(borrador.perfil.tipoDocumento);
        expect(MODALIDADES.map((o) => o.valor)).toContain(borrador.programas[0].modalidad);
        expect(/^[A-Za-z0-9]+$/.test(borrador.perfil.numeroDocumento)).toBe(true);

        // Sin segundo programa: la pregunta está respondida con "no".
        expect(borrador.segundoPrograma).toBe(false);

        // Un documento cargado por cada requerido, con su metadato y sin contenido.
        const requeridos = documentosRequeridos(nivel, false).map((d) => d.id);
        expect(Object.keys(borrador.documentos)).toEqual(requeridos);
        for (const id of requeridos) {
            expect(borrador.documentos[id].id).toBe(id);
            expect(borrador.documentos[id].nombre).toBe(`${id}-prueba.pdf`);
            expect(borrador.documentos[id].tamano).toBeGreaterThan(0);
        }
    }
});

test("rechazo carga un borrador completo aunque el borrador de ejemplo sea parcial", async () => {
    const parcial = await cargarPreinscripcion("PREGRADO", "diferencia-parcial@utb.edu.co", "borrador");
    const completo = await cargarPreinscripcion("PREGRADO", "diferencia-completo@utb.edu.co", "rechazo");
    expect(Object.keys(parcial.borrador.documentos).length).toBeLessThan(
        Object.keys(completo.borrador.documentos).length,
    );
    expect(parcial.borrador.perfil.celular).toBe("");
    expect(completo.borrador.perfil.celular).not.toBe("");
});

test("cargarPreinscripcion con borrador da un borrador parcial con datos inventados", async () => {
    const respuesta = await cargarPreinscripcion("PREGRADO", "parcial@utb.edu.co", "borrador");
    expect(respuesta.estado).toBe("borrador");

    const { borrador } = respuesta;
    expect(borrador.nivel).toBe("PREGRADO");
    expect(borrador.correo).toBe("parcial@utb.edu.co");
    expect(borrador.nombres).toBe("Ana");
    expect(borrador.apellidos).toBe("Prueba");
    expect(typeof borrador.guardadoEn).toBe("string");
    expect(new Date(borrador.guardadoEn as string).toISOString()).toBe(borrador.guardadoEn);

    // Parcial: trae datos, pero no todo.
    expect(borrador.perfil.celular).toBe("");
    expect(borrador.programas[0].programa).not.toBe("");
    expect(Object.keys(borrador.documentos).length).toBeGreaterThan(0);
    expect(Object.keys(borrador.documentos).length).toBeLessThan(5);

    // Los valores de las listas existen en las constantes: el select no queda en blanco.
    expect(TIPOS_DOCUMENTO.map((o) => o.valor)).toContain(borrador.perfil.tipoDocumento);
    expect(MODALIDADES.map((o) => o.valor)).toContain(borrador.programas[0].modalidad);
    expect(GENEROS.length).toBeGreaterThan(0);
});

test("cargarPreinscripcion con borrador respeta el nivel", async () => {
    const respuesta = await cargarPreinscripcion("POSGRADO", "parcial-posgrado@utb.edu.co", "borrador");
    expect(respuesta.estado).toBe("borrador");
    expect(respuesta.borrador.nivel).toBe("POSGRADO");
    expect(respuesta.borrador.nombres).toBe("Ana");
});

test("cargarPreinscripcion con enviada da enviada", async () => {
    const respuesta = await cargarPreinscripcion("PREGRADO", "enviada@utb.edu.co", "enviada");
    expect(respuesta.estado).toBe("enviada");
});

test("guardarBorrador devuelve una fecha ISO", async () => {
    const borrador = borradorVacio("PREGRADO", "iso@utb.edu.co");
    const { guardadoEn } = await guardarBorrador(borrador);
    expect(new Date(guardadoEn).toISOString()).toBe(guardadoEn);
});

test("lo guardado se recupera desde el servidor, sin compartir el objeto mutable", async () => {
    const borrador = borradorVacio("PREGRADO", "memoria@utb.edu.co");
    borrador.nombres = "Ana";
    const { guardadoEn } = await guardarBorrador(borrador);

    const mismo = await cargarPreinscripcion("PREGRADO", "memoria@utb.edu.co", "ninguno");
    expect(mismo.estado).toBe("borrador");
    expect(mismo.borrador.nombres).toBe("Ana");
    expect(mismo.borrador.guardadoEn).toBe(guardadoEn);

    // Lo que se guarda es una copia: cambiar el original no cambia lo guardado.
    borrador.nombres = "Otra";
    const otraVez = await cargarPreinscripcion("PREGRADO", "memoria@utb.edu.co", "ninguno");
    expect(otraVez.borrador.nombres).toBe("Ana");

    // El estudiante se selecciona mediante la cookie de sesión, no mediante el correo del cliente.
    const otroCorreo = await cargarPreinscripcion("PREGRADO", "otro-correo@utb.edu.co", "ninguno");
    expect(otroCorreo.borrador.nombres).toBe("Ana");
});

test("enviarPreinscripcion con rechazo da ok false y al menos un motivo", async () => {
    const borrador = borradorVacio("PREGRADO", "rechazo@utb.edu.co");
    const resultado = await enviarPreinscripcion(borrador, "clave-rechazo", "rechazo");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
        expect(resultado.motivos.length).toBeGreaterThan(0);
        expect(resultado.motivos.every((motivo) => motivo.trim() !== "")).toBe(true);
    }
});

test("enviarPreinscripcion sin escenario da ok true", async () => {
    const borrador = borradorVacio("PREGRADO", "envio@utb.edu.co");
    const resultado = await enviarPreinscripcion(borrador, "clave-envio", "ninguno");
    expect(resultado).toEqual({ ok: true });
});

test("enviarPreinscripcion con la misma clave de idempotencia devuelve el mismo resultado", async () => {
    const borrador = borradorVacio("PREGRADO", "idempotente@utb.edu.co");
    const primero = await enviarPreinscripcion(borrador, "clave-repetida", "rechazo");
    // Aunque ahora se pida sin rechazo, la misma clave repite lo ya resuelto.
    const segundo = await enviarPreinscripcion(borrador, "clave-repetida", "ninguno");
    expect(segundo).toEqual(primero);
});

test("tras un envío correcto, cargar da enviada", async () => {
    const borrador = borradorVacio("PREGRADO", "ya-envio@utb.edu.co");
    await enviarPreinscripcion(borrador, "clave-ya-envio", "ninguno");
    const respuesta = await cargarPreinscripcion("PREGRADO", "ya-envio@utb.edu.co", "ninguno");
    expect(respuesta.estado).toBe("enviada");
});

test("un envío rechazado no marca la solicitud como enviada", async () => {
    const borrador = borradorVacio("PREGRADO", "rechazada@utb.edu.co");
    await enviarPreinscripcion(borrador, "clave-rechazada", "rechazo");
    const respuesta = await cargarPreinscripcion("PREGRADO", "rechazada@utb.edu.co", "ninguno");
    expect(respuesta.estado).toBe("sin_borrador");
});

test("tamanoMaximoPdfBytes convierte MB a bytes", () => {
    expect(tamanoMaximoPdfBytes("5")).toBe(5 * 1024 * 1024);
    expect(tamanoMaximoPdfBytes("5")).toBe(5242880);
    expect(tamanoMaximoPdfBytes(" 10 ")).toBe(10 * 1024 * 1024);
    expect(tamanoMaximoPdfBytes("2.5")).toBe(2.5 * 1024 * 1024);
});

test("tamanoMaximoPdfBytes da null si no hay un valor válido", () => {
    for (const valor of [undefined, "", "  ", "abc", "5MB", "0", "-3", "NaN", "Infinity"]) {
        expect(tamanoMaximoPdfBytes(valor)).toBeNull();
    }
});

test("formatearGuardado da fecha y hora de Bogotá", () => {
    const texto = formatearGuardado("2026-10-22T20:40:00Z");
    expect(texto).toContain("22/10/2026");
    expect(texto).toContain("3:40");
});

test("formatearGuardado cambia de día según la hora de Bogotá, no la de UTC", () => {
    // 02:30 UTC del 23 todavía es el 22 a las 9:30 p. m. en Bogotá (UTC-5).
    const texto = formatearGuardado("2026-10-23T02:30:00Z");
    expect(texto).toContain("22/10/2026");
    expect(texto).toContain("9:30");
});

test('guardarBorrador propaga errores HTTP y de red', async () => {
    const borrador = borradorVacio('PREGRADO', 'prueba@utb.edu.co');
    globalThis.fetch = async () => Response.json({ message: 'Error' }, { status: 503 });
    await expect(guardarBorrador(borrador)).rejects.toThrow('No fue posible guardar');
    globalThis.fetch = async () => { throw new Error('Sin conexión'); };
    await expect(guardarBorrador(borrador)).rejects.toThrow('Sin conexión');
});

test('cargarPreinscripcion consulta el backend con cookie y sin caché', async () => {
    let opciones: RequestInit | undefined;
    globalThis.fetch = async (_entrada, init) => {
        opciones = init;
        return Response.json({ ok: true, estado: null, borrador: null });
    };
    await cargarPreinscripcion('PREGRADO', 'prueba@utb.edu.co', 'ninguno');
    expect(opciones).toMatchObject({ credentials: 'include', cache: 'no-store' });
});
