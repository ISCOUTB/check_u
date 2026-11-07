import { expect, test } from "@playwright/test";
import { documentosRequeridos, type Nivel } from "@/app/estudiante/documentos-requeridos";
import { cargarPreinscripcion } from "@/app/estudiante/iniciar_preinscripcion/api";
import { borradorVacio, type BorradorPreinscripcion } from "@/app/estudiante/iniciar_preinscripcion/tipos";
import {
    ID_CAMPOS,
    MENSAJE_PROGRAMA_REPETIDO,
    SECCIONES,
    faltantes,
    idCampoExperiencia,
    idCampoPrograma,
    idDocumento,
    limpiarNumeroDocumento,
    progreso,
    seccionesDelNivel,
    tieneFirmaPdf,
    validarPdf,
} from "@/app/estudiante/iniciar_preinscripcion/validacion";

// Lógica pura de validación y progreso: no necesita navegador ni servidor.

const CORREO = "x@prueba.co";
const MB = 1024 * 1024;

/** Un borrador con todo lo obligatorio y todos los documentos del nivel (sin segundo programa). */
function completo(nivel: Nivel): BorradorPreinscripcion {
    const borrador = borradorVacio(nivel, CORREO);
    borrador.nombres = "Ana";
    borrador.apellidos = "Prueba";
    borrador.codigoEstudiantil = "T00000001";
    borrador.perfil.tipoDocumento = "CC";
    borrador.perfil.numeroDocumento = "1234567890";
    borrador.perfil.fechaNacimiento = "2000-01-01";
    borrador.perfil.genero = "OTRO";
    borrador.perfil.celular = "3000000000";
    borrador.perfil.departamento = "Bolívar";
    borrador.perfil.ciudad = "Cartagena";
    borrador.perfil.direccion = "Calle de ejemplo 1";
    borrador.perfil.tieneDiscapacidad = false;
    borrador.segundoPrograma = false;
    borrador.programas[0].programa = "Programa de ejemplo";
    borrador.programas[0].modalidad = "PRESENCIAL";
    if (nivel === "PREGRADO") {
        borrador.programas[0].tipoOpcionGrado = "TRABAJO_DE_GRADO";
        borrador.pregrado = {
            conoceRegistroSaberPro: false,
            numeroRegistroSaberPro: "",
            fechaExamenSaberPro: "2024-06-01",
            esEmpleadoUtb: false,
            tipoContrato: "",
            esHijoDeEmpleadoUtb: false,
        };
    } else {
        borrador.posgrado = {
            nivelEstudios: "PROFESIONAL",
            tituloObtenido: "Título de ejemplo",
            esEgresadoPregradoUtb: true,
        };
    }
    for (const { id } of documentosRequeridos(nivel, false)) cargar(borrador, id);
    return borrador;
}

function cargar(borrador: BorradorPreinscripcion, id: string): void {
    borrador.documentos[id] = { id, nombre: `${id}.pdf`, tamano: 1024 };
}

function conSegundoPrograma(borrador: BorradorPreinscripcion): void {
    borrador.segundoPrograma = true;
    borrador.programas[1].programa = "Otro programa de ejemplo";
    borrador.programas[1].modalidad = "VIRTUAL";
    if (borrador.nivel === "PREGRADO") borrador.programas[1].tipoOpcionGrado = "TRABAJO_DE_GRADO";
}

const ids = (borrador: BorradorPreinscripcion) => faltantes(borrador).map((faltante) => faltante.id);

// ─────────────────────────────────────────────────────────────────────────────
// Ids de la página
// ─────────────────────────────────────────────────────────────────────────────

test("los ids de la página salen de ID_CAMPOS, idCampoPrograma e idDocumento", () => {
    expect(ID_CAMPOS.nombres).toBe("campo-nombres");
    expect(idCampoPrograma("programa", 2)).toBe("campo-programa-2");
    expect(idDocumento("saber_pro")).toBe("documento-saber_pro");
    expect(idDocumento("estampilla_pro_cultura-2")).toBe("documento-estampilla_pro_cultura-2");
});

test("ningún id de campo se repite", () => {
    const todos = [
        ...Object.values(ID_CAMPOS),
        ...([1, 2] as const).flatMap((orden) => [
            idCampoPrograma("programa", orden),
            idCampoPrograma("modalidad", orden),
            idCampoPrograma("tipoOpcionGrado", orden),
            idCampoExperiencia("empresa", orden),
            idCampoExperiencia("cargo", orden),
            idCampoExperiencia("tiempo", orden),
        ]),
    ];
    expect(new Set(todos).size).toBe(todos.length);
    for (const id of todos) expect(id).toMatch(/^campo-[a-z0-9-]+$/);
});

// ─────────────────────────────────────────────────────────────────────────────
// Secciones
// ─────────────────────────────────────────────────────────────────────────────

test("SECCIONES trae los títulos de cada sección", () => {
    expect(SECCIONES).toEqual({
        identificacion: "Identificación",
        contacto: "Contacto y residencia",
        academico: "Información académica",
        saber_pro: "Saber Pro y vinculación con la UTB",
        estudios: "Estudios y experiencia",
        documentos: "Documentos",
    });
});

test("seccionesDelNivel: pregrado sin estudios y posgrado sin Saber Pro", () => {
    expect(seccionesDelNivel("PREGRADO")).toEqual([
        "identificacion",
        "contacto",
        "academico",
        "saber_pro",
        "documentos",
    ]);
    expect(seccionesDelNivel("POSGRADO")).toEqual([
        "identificacion",
        "contacto",
        "academico",
        "estudios",
        "documentos",
    ]);
});

// ─────────────────────────────────────────────────────────────────────────────
// faltantes
// ─────────────────────────────────────────────────────────────────────────────

test("un borrador vacío de pregrado falta lo obligatorio y los 4 documentos, pero no el correo", () => {
    const resultado = faltantes(borradorVacio("PREGRADO", CORREO));

    expect(resultado.map((faltante) => faltante.id)).toEqual([
        ID_CAMPOS.nombres,
        ID_CAMPOS.apellidos,
        ID_CAMPOS.tipoDocumento,
        ID_CAMPOS.numeroDocumento,
        ID_CAMPOS.fechaNacimiento,
        ID_CAMPOS.genero,
        ID_CAMPOS.codigoEstudiantil,
        idCampoPrograma("modalidad", 1),
        idCampoPrograma("programa", 1),
        idCampoPrograma("tipoOpcionGrado", 1),
        ID_CAMPOS.segundoPrograma,
        ID_CAMPOS.celular,
        ID_CAMPOS.departamento,
        ID_CAMPOS.ciudad,
        ID_CAMPOS.direccion,
        ID_CAMPOS.tieneDiscapacidad,
        ID_CAMPOS.conoceRegistroSaberPro,
        ID_CAMPOS.fechaExamenSaberPro,
        ID_CAMPOS.esEmpleadoUtb,
        ID_CAMPOS.esHijoDeEmpleadoUtb,
        "documento-identification",
        "documento-academic_evaluation",
        "documento-estampilla_pro_cultura",
        "documento-saber_pro",
    ]);
    expect(resultado.map((faltante) => faltante.id)).not.toContain(ID_CAMPOS.correo);
});

test("cada faltante trae su sección, su etiqueta y su mensaje", () => {
    const resultado = faltantes(borradorVacio("PREGRADO", CORREO));
    const porId = new Map(resultado.map((faltante) => [faltante.id, faltante]));

    expect(porId.get("campo-nombres")).toEqual({
        id: "campo-nombres",
        seccion: "identificacion",
        etiqueta: "Nombres",
        mensaje: "Completa este campo.",
    });
    expect(porId.get(ID_CAMPOS.codigoEstudiantil)?.seccion).toBe("academico");
    expect(porId.get(idCampoPrograma("programa", 1))?.seccion).toBe("academico");
    expect(porId.get("documento-saber_pro")).toEqual({
        id: "documento-saber_pro",
        seccion: "documentos",
        etiqueta: "Resultados Saber Pro",
        mensaje: "Carga este documento en PDF.",
    });
});

test("el Paz y Salvo ya no se pide en el formulario: se consulta con Biblioteca (Tarea 50)", () => {
    for (const nivel of ["PREGRADO", "POSGRADO"] as const) {
        expect(ids(borradorVacio(nivel, CORREO))).not.toContain("documento-paz_y_salvo_bib");
    }
    // Un borrador completo no necesita Paz y Salvo para estar listo.
    expect(ids(completo("PREGRADO"))).toEqual([]);
});

test("un borrador vacío de posgrado pide sus 2 documentos", () => {
    const documentos = ids(borradorVacio("POSGRADO", CORREO)).filter((id) => id.startsWith("documento-"));
    expect(documentos).toEqual([
        "documento-identification",
        "documento-estampilla_pro_cultura",
    ]);
});

test("con segundo programa se piden también sus campos y la segunda estampilla en pregrado", () => {
    const borrador = borradorVacio("PREGRADO", CORREO);
    borrador.segundoPrograma = true;
    const resultado = ids(borrador);

    expect(resultado).toContain(idCampoPrograma("modalidad", 2));
    expect(resultado).toContain(idCampoPrograma("programa", 2));
    expect(resultado).toContain("documento-estampilla_pro_cultura-2");
});

test("en posgrado el segundo programa pide sus campos pero no una segunda estampilla", () => {
    const borrador = borradorVacio("POSGRADO", CORREO);
    borrador.segundoPrograma = true;
    const resultado = ids(borrador);

    expect(resultado).toContain(idCampoPrograma("modalidad", 2));
    expect(resultado).toContain(idCampoPrograma("programa", 2));
    expect(resultado).not.toContain("documento-estampilla_pro_cultura-2");
});

test("el segundo programa no puede ser igual al primero", () => {
    const borrador = completo("PREGRADO");
    conSegundoPrograma(borrador);
    cargar(borrador, "academic_evaluation-2");
    cargar(borrador, "estampilla_pro_cultura-2");
    borrador.programas[1].programa = borrador.programas[0].programa;

    expect(faltantes(borrador)).toEqual([
        {
            id: idCampoPrograma("programa", 2),
            seccion: "academico",
            etiqueta: "Programa (segundo programa)",
            mensaje: MENSAJE_PROGRAMA_REPETIDO,
        },
    ]);

    // La comparación ignora mayúsculas y espacios.
    borrador.programas[1].programa = `  ${borrador.programas[0].programa.toUpperCase()}  `;
    expect(ids(borrador)).toEqual([idCampoPrograma("programa", 2)]);

    borrador.programas[1].programa = "Otro programa de ejemplo";
    expect(faltantes(borrador)).toEqual([]);
});

test("sin segundo programa (no o sin responder) el segundo programa no cuenta aunque esté vacío", () => {
    for (const respuesta of [false, null]) {
        const borrador = borradorVacio("PREGRADO", CORREO);
        borrador.segundoPrograma = respuesta;
        const resultado = ids(borrador);

        expect(resultado).not.toContain(idCampoPrograma("modalidad", 2));
        expect(resultado).not.toContain(idCampoPrograma("programa", 2));
        expect(resultado).not.toContain("documento-estampilla_pro_cultura-2");
    }
});

test("un valor viejo del segundo programa no cuenta si ahora dice que no", () => {
    const borrador = completo("PREGRADO");
    conSegundoPrograma(borrador);
    cargar(borrador, "estampilla_pro_cultura-2");
    borrador.segundoPrograma = false;
    borrador.programas[1].programa = "";

    expect(faltantes(borrador)).toEqual([]);
});

test("un texto de solo espacios cuenta como vacío", () => {
    const borrador = completo("PREGRADO");
    borrador.nombres = "   ";
    borrador.programas[0].programa = " \t ";
    expect(ids(borrador)).toEqual([ID_CAMPOS.nombres, idCampoPrograma("programa", 1)]);
});

test("lo opcional no se exige", () => {
    const borrador = completo("POSGRADO");
    // Sin teléfono fijo, estudios, experiencia ni opción de grado.
    const vacio = borradorVacio("POSGRADO", CORREO);
    borrador.posgrado = vacio.posgrado;
    borrador.experiencia = vacio.experiencia;
    expect(borrador.perfil.telefonoFijo).toBe("");
    expect(borrador.posgrado.nivelEstudios).toBe("");
    expect(borrador.experiencia[0].empresa).toBe("");
    expect(faltantes(borrador)).toEqual([]);
});

test("el tipo de discapacidad solo se exige cuando la respuesta es Sí", () => {
    const borrador = completo("PREGRADO");
    borrador.perfil.tieneDiscapacidad = true;
    borrador.perfil.tipoDiscapacidad = "";
    borrador.perfil.detallesAsistencia = "";

    expect(ids(borrador)).toEqual([ID_CAMPOS.tipoDiscapacidad]);
    const pendiente = progreso(borrador);
    expect(pendiente.secciones.find((seccion) => seccion.id === "contacto")).toMatchObject({
        faltan: 1,
        opcional: false,
    });
    expect(pendiente.seccionesPendientes).toBe(1);
    expect(pendiente.listo).toBe(false);

    // Los detalles son opcionales; con el tipo completo, la sección queda completa.
    borrador.perfil.tipoDiscapacidad = "FISICA";
    borrador.perfil.detallesAsistencia = "Requiere rampa";
    expect(faltantes(borrador)).toEqual([]);
    expect(progreso(borrador).secciones.find((seccion) => seccion.id === "contacto")).toMatchObject({
        faltan: 0,
        opcional: false,
    });
    expect(progreso(borrador).listo).toBe(true);
});

test("al responder No no se exige el tipo y la pregunta de discapacidad sigue siendo obligatoria", () => {
    const borrador = completo("PREGRADO");
    borrador.perfil.tieneDiscapacidad = false;
    borrador.perfil.tipoDiscapacidad = "";
    borrador.perfil.detallesAsistencia = "";

    expect(faltantes(borrador)).toEqual([]);
    expect(progreso(borrador).secciones.find((seccion) => seccion.id === "contacto")?.opcional).toBe(false);

    // Dejarla sin responder sí es un faltante.
    borrador.perfil.tieneDiscapacidad = null;
    expect(ids(borrador)).toEqual([ID_CAMPOS.tieneDiscapacidad]);
});

test("la fecha se guarda tal cual", () => {
    const borrador = completo("PREGRADO");
    borrador.perfil.fechaNacimiento = "2000-01-01";
    const antes = structuredClone(borrador);

    faltantes(borrador);
    progreso(borrador);

    expect(borrador.perfil.fechaNacimiento).toBe("2000-01-01");
    expect(borrador).toEqual(antes);
});

test("el borrador del escenario rechazo no tiene faltantes", async () => {
    for (const nivel of ["PREGRADO", "POSGRADO"] as const) {
        const { borrador } = await cargarPreinscripcion(nivel, CORREO, "rechazo");
        expect(faltantes(borrador)).toEqual([]);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// progreso
// ─────────────────────────────────────────────────────────────────────────────

test("progreso de un borrador vacío de pregrado", () => {
    const resultado = progreso(borradorVacio("PREGRADO", CORREO));

    expect(resultado.secciones).toEqual([
        { id: "identificacion", titulo: "Identificación", faltan: 6, opcional: false },
        { id: "contacto", titulo: "Contacto y residencia", faltan: 5, opcional: false },
        { id: "academico", titulo: "Información académica", faltan: 5, opcional: false },
        { id: "saber_pro", titulo: "Saber Pro y vinculación con la UTB", faltan: 4, opcional: false },
        { id: "documentos", titulo: "Documentos", faltan: 4, opcional: false },
    ]);
    expect(resultado.documentos).toEqual({ cargados: 0, requeridos: 4 });
    expect(resultado.seccionesPendientes).toBe(4);
    expect(resultado.documentosPendientes).toBe(4);
    expect(resultado.listo).toBe(false);
});

test("progreso de posgrado usa sus secciones y sus 3 documentos", () => {
    const resultado = progreso(borradorVacio("POSGRADO", CORREO));

    expect(resultado.secciones.map((seccion) => seccion.id)).toEqual(seccionesDelNivel("POSGRADO"));
    expect(resultado.documentos).toEqual({ cargados: 0, requeridos: 2 });
});

test("las secciones sin obligatorios son opcionales en cada nivel; Documentos nunca", () => {
    const opcionales = (borrador: BorradorPreinscripcion) =>
        Object.fromEntries(progreso(borrador).secciones.map((seccion) => [seccion.id, seccion.opcional]));

    expect(opcionales(borradorVacio("PREGRADO", CORREO))).toEqual({
        identificacion: false,
        contacto: false,
        academico: false,
        saber_pro: false,
        documentos: false,
    });
    expect(opcionales(borradorVacio("POSGRADO", CORREO))).toEqual({
        identificacion: false,
        contacto: false,
        academico: false,
        estudios: true,
        documentos: false,
    });
    // Que sea opcional depende del nivel, no de lo que se haya llenado.
    expect(opcionales(completo("PREGRADO"))).toEqual(opcionales(borradorVacio("PREGRADO", CORREO)));
    expect(opcionales(completo("POSGRADO"))).toEqual(opcionales(borradorVacio("POSGRADO", CORREO)));
});

test("progreso cuenta los documentos cargados y las secciones que se completan", () => {
    const borrador = borradorVacio("PREGRADO", CORREO);
    borrador.nombres = "Ana";
    borrador.apellidos = "Prueba";
    borrador.perfil.tipoDocumento = "CC";
    borrador.perfil.numeroDocumento = "1234567890";
    borrador.perfil.fechaNacimiento = "2000-01-01";
    borrador.perfil.genero = "OTRO";
    cargar(borrador, "identification");
    cargar(borrador, "saber_pro");
    const resultado = progreso(borrador);

    expect(resultado.secciones.find((seccion) => seccion.id === "identificacion")?.faltan).toBe(0);
    expect(resultado.seccionesPendientes).toBe(3);
    expect(resultado.documentos).toEqual({ cargados: 2, requeridos: 4 });
    expect(resultado.documentosPendientes).toBe(2);
    expect(resultado.listo).toBe(false);
});

test("progreso sin segundo programa no cuenta la segunda evaluación ni la segunda estampilla", () => {
    const borrador = completo("PREGRADO");

    borrador.segundoPrograma = true;
    expect(progreso(borrador).documentos).toEqual({ cargados: 4, requeridos: 6 });

    cargar(borrador, "academic_evaluation-2");
    cargar(borrador, "estampilla_pro_cultura-2");
    expect(progreso(borrador).documentos).toEqual({ cargados: 6, requeridos: 6 });

    borrador.segundoPrograma = false;
    const resultado = progreso(borrador);
    expect(resultado.documentos).toEqual({ cargados: 4, requeridos: 4 });
    expect(resultado.documentosPendientes).toBe(0);
});

test("un borrador completo está listo", () => {
    for (const nivel of ["PREGRADO", "POSGRADO"] as const) {
        const resultado = progreso(completo(nivel));
        expect(resultado.listo).toBe(true);
        expect(resultado.seccionesPendientes).toBe(0);
        expect(resultado.documentosPendientes).toBe(0);
        expect(resultado.secciones.every((seccion) => seccion.faltan === 0)).toBe(true);
    }
});

test("un borrador completo con segundo programa solo está listo con sus campos y los dos documentos del segundo programa", () => {
    const borrador = completo("PREGRADO");
    borrador.segundoPrograma = true;
    expect(progreso(borrador).listo).toBe(false);

    conSegundoPrograma(borrador);
    expect(progreso(borrador).listo).toBe(false);

    cargar(borrador, "estampilla_pro_cultura-2");
    expect(progreso(borrador).listo).toBe(false);

    cargar(borrador, "academic_evaluation-2");
    expect(progreso(borrador).listo).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// limpiarNumeroDocumento
// ─────────────────────────────────────────────────────────────────────────────

test("limpiarNumeroDocumento deja solo letras y dígitos", () => {
    expect(limpiarNumeroDocumento("1.043 640,743")).toBe("1043640743");
    expect(limpiarNumeroDocumento("AB-12")).toBe("AB12");
    expect(limpiarNumeroDocumento("")).toBe("");
    expect(limpiarNumeroDocumento(" .,- ")).toBe("");
});

// ─────────────────────────────────────────────────────────────────────────────
// validarPdf
// ─────────────────────────────────────────────────────────────────────────────

test("validarPdf acepta un PDF normal", () => {
    expect(validarPdf({ name: "a.pdf", type: "application/pdf", size: 10 }, null)).toBeNull();
    expect(validarPdf({ name: "A.PDF", type: "application/pdf", size: 10 }, 5 * MB)).toBeNull();
});

test("validarPdf rechaza un png con extensión pdf", () => {
    expect(validarPdf({ name: "a.pdf", type: "image/png", size: 10 }, null)).toBe("Solo se aceptan archivos PDF.");
});

// El navegador saca File.type de la extensión, sin leer el archivo: una imagen renombrada a .pdf
// llega como application/pdf. Lo que la delata son sus primeros bytes.

/** Los primeros bytes de un PNG de verdad. */
const BYTES_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

test("tieneFirmaPdf reconoce un PDF por sus primeros bytes", async () => {
    expect(await tieneFirmaPdf(new Blob(["%PDF-1.7\n%âãÏÓ\n"]))).toBe(true);
});

test("tieneFirmaPdf rechaza una imagen renombrada a .pdf", async () => {
    expect(await tieneFirmaPdf(new Blob([BYTES_PNG], { type: "application/pdf" }))).toBe(false);
    expect(await tieneFirmaPdf(new Blob(["hola"]))).toBe(false);
});

test("tieneFirmaPdf acepta bytes antes de %PDF- dentro del primer KB, como los lectores de PDF", async () => {
    expect(await tieneFirmaPdf(new Blob(["x".repeat(100), "%PDF-1.4\n"]))).toBe(true);
    expect(await tieneFirmaPdf(new Blob(["x".repeat(1024), "%PDF-1.4\n"]))).toBe(false);
});

test("validarPdf rechaza un PDF sin la extensión .pdf", () => {
    expect(validarPdf({ name: "a.png", type: "application/pdf", size: 10 }, null)).toBe(
        "Solo se aceptan archivos PDF.",
    );
    expect(validarPdf({ name: "pdf", type: "application/pdf", size: 10 }, null)).toBe("Solo se aceptan archivos PDF.");
});

test("validarPdf rechaza un archivo vacío", () => {
    expect(validarPdf({ name: "a.pdf", type: "application/pdf", size: 0 }, null)).toBe("El archivo está vacío.");
});

test("validarPdf rechaza un archivo más grande que el máximo, con el máximo en MB", () => {
    expect(validarPdf({ name: "a.pdf", type: "application/pdf", size: 5 * MB + 1 }, 5 * MB)).toBe(
        "El archivo pesa más de 5 MB, el máximo permitido.",
    );
    expect(validarPdf({ name: "a.pdf", type: "application/pdf", size: 3 * MB }, 2.5 * MB)).toBe(
        "El archivo pesa más de 2,5 MB, el máximo permitido.",
    );
});

test("validarPdf acepta un archivo del tamaño exacto del máximo y no limita si no hay máximo", () => {
    expect(validarPdf({ name: "a.pdf", type: "application/pdf", size: 5 * MB }, 5 * MB)).toBeNull();
    expect(validarPdf({ name: "a.pdf", type: "application/pdf", size: 500 * MB }, null)).toBeNull();
});
