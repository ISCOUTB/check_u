import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { DEMO_PREGRADO } from "@/app/components/informacion_estudiante/datos_demo";

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

/** Solicitudes sintéticas exclusivas de pruebas, servidas con el contrato de la API. */
export const SOLICITUDES_FUNCIONARIA = ['VALIDA','NO_VALIDA','INCONSISTENTE','POR_REVISAR','VALIDA'].map((estado, i) => ({
    id: String(i + 1), estado, estudiante: `Estudiante Prueba ${i + 1}`,
    nivel: i === 2 || i === 4 ? 'POSGRADO' : 'PREGRADO',
    periodId: PERIODO_DEMO.id, fechaRegistro: `2026-10-04T${String(8 + i).padStart(2,'0')}:30:00-05:00`,
}));
export const DETALLE_FUNCIONARIA = {
    id: '1', estadoSolicitud: 'EN_PROCESO', estadoAnalisis: 'registrado',
    estudiante: { codigo:'T00000001', nombre:'Ana Prueba', tipoDocumento:'CC', numeroDocumento:'1000000001',
        fechaNacimiento:'2004-03-12', programa:'Ingeniería', facultad:'', nivel:'PREGRADO', correo:'prueba@example.org', telefono:'', ciudad:'Cartagena', fechaSolicitud:'2026-10-04' },
    informacion: { nombres:'Ana',apellidos:'Prueba',codigoEstudiantil:'T00000001', correo:'prueba@example.org',
        tipoDocumento:'CC',numeroDocumento:'1000000001',fechaNacimiento:'2004-03-12',genero:'FEMENINO',telefonoFijo:'',telefonoCelular:'',
        departamento:'Bolívar',ciudad:'Cartagena',direccion:'',modalidad:'PRESENCIAL',programa:'Ingeniería',
        tieneDiscapacidad:true,tipoDiscapacidad:'Física',detallesAsistencia:'Requiere acceso para silla de ruedas.' },
    documentos: [
        {id:'10',nombre:'Documento de identidad',tipo:'identification',orden:1,version:1,fileName:'identidad.pdf',descripcion:'identidad.pdf',archivoDisponible:false,resubmission_allowed:false,
            resultados:[{estado:'valido',mensaje:'Identidad verificada.'}],analisis:{extracted_data:{full_name_student:{value:'Ana Prueba',confidence:1}}}},
        {id:'11',nombre:'Estampilla Pro-Cultura',tipo:'estampilla_pro_cultura',orden:1,version:1,fileName:'estampilla.pdf',descripcion:'estampilla.pdf',archivoDisponible:false,resubmission_allowed:true,
            resultados:[{estado:'inconsistente',mensaje:'El valor pagado no coincide. Adjunta el comprobante correcto.'}],analisis:null},
    ],
    politicaReenvios:{usados:0,limite:3,zona:'America/Bogota'}, revisiones:[],
};

/**
 * Detalle real de "Mi solicitud de grado" para el inicio del estudiante.
 * Cubre un requisito válido, uno por revisar, uno con corrección y dos sin cargar.
 */
export const DETALLE_ESTUDIANTE = {
    id: "1",
    estadoSolicitud: "EN_PROCESO",
    estadoAnalisis: "registrado",
    estudiante: {
        codigo: "T00000001",
        nombre: "Ana Prueba",
        tipoDocumento: "CC",
        numeroDocumento: "1000000001",
        fechaNacimiento: "2004-03-12",
        programa: "Ingeniería",
        facultad: "",
        nivel: "PREGRADO",
        correo: "prueba@example.org",
        telefono: "",
        ciudad: "Cartagena",
        fechaSolicitud: "2026-10-04",
    },
    informacion: { ...DEMO_PREGRADO, tieneSegundoPrograma: false },
    documentos: [
        {
            id: "10",
            nombre: "Documento de identidad",
            tipo: "identification",
            orden: 1,
            version: 1,
            fileName: "identidad.pdf",
            descripcion: "identidad.pdf",
            archivoDisponible: true,
            resubmission_allowed: false,
            resultados: [{ estado: "valido", mensaje: "Identidad verificada." }],
            analisis: null,
        },
        {
            id: "11",
            nombre: "Evaluación de Grado (Banner)",
            tipo: "academic_evaluation",
            orden: 1,
            version: 1,
            fileName: "evaluacion.pdf",
            descripcion: "evaluacion.pdf",
            archivoDisponible: true,
            resubmission_allowed: false,
            resultados: [
                {
                    estado: "por_revisar",
                    mensaje: "Pendiente de revisión manual.",
                },
            ],
            analisis: null,
        },
        {
            id: "12",
            nombre: "Estampilla Pro-Cultura",
            tipo: "estampilla_pro_cultura",
            orden: 1,
            version: 1,
            fileName: "estampilla.pdf",
            descripcion: "estampilla.pdf",
            archivoDisponible: true,
            resubmission_allowed: true,
            resultados: [
                {
                    estado: "no_valido",
                    mensaje:
                        "El valor pagado no coincide. Adjunta el comprobante correcto.",
                },
            ],
            analisis: null,
        },
    ],
    periodos: {
        fechaActual: "2026-10-15",
        periodoAsignado: {
            ...PERIODO_DEMO,
            fechaCorte: "2026-10-24",
        },
        periodoDisponible: null,
        proximosPeriodos: [],
    },
    politicaReenvios: { usados: 1, limite: 3, zona: "America/Bogota" },
};

/**
 * Historial sintético para la vista de solicitudes (Tarea 45).
 * Incluye una marca cercana a medianoche UTC para comprobar el día de Bogotá.
 */
export const LISTADO_ESTUDIANTE = {
    solicitudes: [
        {
            id: "9",
            nivel: "PREGRADO",
            estado: "VALIDA",
            activa: true,
            fechaSolicitud: "2026-10-31T02:00:00.000Z",
            fechaCreacion: "2026-10-28T15:00:00.000Z",
            canceladaEn: null,
            periodo: { ...PERIODO_DEMO, fechaCorte: "2026-10-24" },
        },
        {
            id: "8",
            nivel: "POSGRADO",
            estado: "NO_VALIDA",
            activa: true,
            fechaSolicitud: "2026-10-20T15:00:00.000Z",
            fechaCreacion: "2026-10-18T15:00:00.000Z",
            canceladaEn: null,
            periodo: {
                id: "periodo-2026-2",
                nombre: "Grado diciembre 2026",
                fechaInicio: "2026-11-01",
                fechaFin: "2026-11-30",
                fechaCorte: "2026-11-23",
            },
        },
        {
            id: "7",
            nivel: "PREGRADO",
            estado: "INCONSISTENTE",
            activa: true,
            fechaSolicitud: "2026-10-10T15:00:00.000Z",
            fechaCreacion: "2026-10-08T15:00:00.000Z",
            canceladaEn: null,
            periodo: { ...PERIODO_DEMO, fechaCorte: "2026-10-24" },
        },
        {
            id: "6",
            nivel: "PREGRADO",
            estado: "POR_REVISAR",
            activa: true,
            fechaSolicitud: "2026-09-15T15:00:00.000Z",
            fechaCreacion: "2026-09-12T15:00:00.000Z",
            canceladaEn: null,
            periodo: { ...PERIODO_DEMO, fechaCorte: "2026-10-24" },
        },
        {
            id: "5",
            nivel: "PREGRADO",
            estado: "CANCELADA",
            activa: false,
            fechaSolicitud: "2026-08-15T15:00:00.000Z",
            fechaCreacion: "2026-08-12T15:00:00.000Z",
            canceladaEn: "2026-08-20T14:00:00.000Z",
            periodo: { ...PERIODO_DEMO, fechaCorte: "2026-10-24" },
        },
        {
            id: "4",
            nivel: "POSGRADO",
            estado: "CERRADA",
            activa: false,
            fechaSolicitud: "2026-07-15T15:00:00.000Z",
            fechaCreacion: "2026-07-12T15:00:00.000Z",
            canceladaEn: null,
            periodo: {
                id: "periodo-2026-0",
                nombre: "Grado agosto 2026",
                fechaInicio: "2026-08-01",
                fechaFin: "2026-08-31",
                fechaCorte: "2026-08-24",
            },
        },
    ],
};

/** 320 px equivale a un zoom del 400 % en 1280 (WCAG 1.4.10, reflujo). */
export const ANCHOS = [320, 360, 768, 1280] as const;

/** Simula el backend: la sesión (o su ausencia), el cierre de sesión y el chequeo de salud. */
export async function sesionComo(page: Page, rol: Rol | null, nombre?: string): Promise<void> {
    // La tarea 34 consulta este contrato para las guardas; cada prueba puede sustituirlo.
    await page.route(`${API}/solicitudes/estado`,async ruta=>{
        if(rol!=='estudiante')return ruta.fulfill({status:rol?403:401,json:{message:'Acceso restringido'}});
        const escenario=await page.evaluate(()=>(window as unknown as {__CHECKU_ESCENARIO__?:string}).__CHECKU_ESCENARIO__).catch(()=>undefined);
        const path=new URL(page.url()).pathname;
        const estado=escenario==='sin_solicitud'||path==='/estudiante/bienvenida'?'SIN_SOLICITUD':path==='/estudiante/iniciar_preinscripcion'?'BORRADOR':'ENVIADA';
        return ruta.fulfill({json:{ok:true,estado,destino:estado==='SIN_SOLICITUD'?'/estudiante/bienvenida':estado==='BORRADOR'?'/estudiante/iniciar_preinscripcion':'/estudiante/home',id_solicitud:estado==='SIN_SOLICITUD'?undefined:1,nivel:'PREGRADO'}});
    });
    await page.route(`${API}/estudiante/solicitudes`,ruta=>ruta.fulfill({status:rol==='estudiante'?200:rol?403:401,json:rol==='estudiante'?{solicitudes:[]}:{message:'Acceso restringido'}}));
    await page.route(`${API}/auth/me`, (ruta) =>
        rol
            ? ruta.fulfill({ status: 200, json: { user: { ...USUARIOS[rol], ...(nombre ? { name: nombre } : {}) } } })
            : ruta.fulfill({ status: 401, json: { message: "Sesión no válida o expirada" } }),
    );
    await page.route(`${API}/auth/logout`, (ruta) =>
        ruta.fulfill({ status: 201, json: { message: "Sesión cerrada correctamente" } }),
    );
    await page.route(`${API}/funcionario/solicitudes`, ruta => ruta.fulfill({
        status: rol === 'funcionario' ? 200 : rol ? 403 : 401,
        json: rol === 'funcionario' ? SOLICITUDES_FUNCIONARIA : {message:'Acceso restringido'},
    }));
    await page.route(`${API}/funcionario/solicitudes/*`, ruta => ruta.fulfill({
        status: rol === 'funcionario' ? 200 : rol ? 403 : 401,
        json: rol === 'funcionario' ? {...DETALLE_FUNCIONARIA,id:new URL(ruta.request().url()).pathname.split('/').pop()} : {message:'Acceso restringido'},
    }));
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
    // Tarea 41: avisos vacíos por defecto; cada prueba del módulo define sus casos.
    await page.route(`${API}/estudiante/notificaciones`, ruta => ruta.fulfill({
        status: rol === "estudiante" ? 200 : rol ? 403 : 401,
        json: rol === "estudiante" ? {notificaciones: [], noLeidas: 0} : {message: "Acceso restringido"},
    }));
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
    // Estado de navegación del inicio: por defecto, la solicitud ya fue enviada.
    await page.route(`${API}/solicitudes/estado`, (ruta) =>
        rol === "estudiante"
            ? ruta.fulfill({
                  status: 200,
                  json: {
                      ok: true,
                      estado: "ENVIADA",
                      destino: "/estudiante/home",
                      id_solicitud: 1,
                      nivel: "PREGRADO",
                  },
              })
            : rol === "funcionario"
              ? ruta.fulfill({ status: 403, json: { message: "Acceso restringido a estudiantes" } })
              : ruta.fulfill({ status: 401, json: { message: "Sesión no válida o expirada" } }),
    );
    // Resumen documental real del inicio; cada prueba puede reemplazarlo.
    await page.route(`${API}/estudiante/solicitud/analisis`, (ruta) =>
        rol === "estudiante"
            ? ruta.fulfill({ status: 200, json: DETALLE_ESTUDIANTE })
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
