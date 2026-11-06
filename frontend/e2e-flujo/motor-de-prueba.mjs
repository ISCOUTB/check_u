// Tarea 53: intermediario entre el backend y el motor real, solo para las pruebas de flujo.
//
// El backend apunta aquí con MOTOR_URL. Hay dos modos, que cada escenario elige con POST /__control:
// - real: reenvía la petición al motor Python, sin tocarla.
// - controlado: responde a /analizar con la clasificación que pida el escenario. Sirve para los
//   resultados que no se alcanzan sin documentos reales (no hay una Evaluación de Banner de prueba).
//   Cada respuesta lleva validation_version «motor-de-prueba@1»: el informe y la BD lo distinguen.
//
// La consulta de Paz y Salvo (/biblioteca/paz-y-salvo) siempre va al motor real, con ALMA simulado.
//
// Uso: node motor-de-prueba.mjs   (PUERTO=5014, MOTOR_REAL=http://127.0.0.1:5013)
import http from "node:http";

const PUERTO = Number(process.env.PUERTO ?? 5014);
const MOTOR_REAL = (process.env.MOTOR_REAL ?? "http://127.0.0.1:5013").replace(/\/$/, "");
const CLASIFICACIONES = new Set(["valid", "invalid", "inconsistent", "to_check"]);

let modo = "real";
/** Clasificación por clave de documento (`academic_evaluation-2`) o por tipo (`saber_pro`). */
let clasificaciones = {};
/** Si es true, /analizar responde 500, para probar la caída del motor. */
let fallar = false;

function leerCuerpo(req) {
    return new Promise((resolver, rechazar) => {
        const partes = [];
        req.on("data", (p) => partes.push(p));
        req.on("end", () => resolver(Buffer.concat(partes)));
        req.on("error", rechazar);
    });
}

function responder(res, estado, datos) {
    res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(datos));
}

async function reenviar(req, res, cuerpo) {
    const cabeceras = { ...req.headers };
    delete cabeceras.host;
    delete cabeceras["content-length"];
    const metodo = req.method ?? "GET";
    const r = await fetch(`${MOTOR_REAL}${req.url}`, {
        method: metodo,
        headers: cabeceras,
        body: metodo === "GET" ? undefined : cuerpo,
    });
    res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") ?? "application/json" });
    res.end(Buffer.from(await r.arrayBuffer()));
}

const MENSAJES = {
    valid: "Documento verificado (motor de prueba).",
    invalid: "El documento no cumple el requisito (motor de prueba).",
    inconsistent: "Los datos del documento no coinciden con los del formulario (motor de prueba).",
    to_check: "El documento requiere revisión de la funcionaria (motor de prueba).",
};
const RESULTADO_REGLA = { valid: "cumple", invalid: "no_cumple", inconsistent: "no_cumple", to_check: "no_evaluable" };

/** Misma forma que modules/api/app.py para un documento. */
function respuestaControlada(tipo, clasificacion, estudiante) {
    const cumple = clasificacion === "valid";
    const ahora = new Date().toISOString();
    return {
        id_student: estudiante.id_student,
        nivel: estudiante.nivel,
        estado_general: clasificacion,
        errores: [],
        resultados: [
            {
                id_student: estudiante.id_student,
                type_document: tipo,
                document_version: 1,
                ...(tipo === "estampilla_pro_cultura" ? { document_order: 1 } : {}),
                extracted_data: {},
                rules: [
                    {
                        rule: "comprobacion_controlada",
                        result: RESULTADO_REGLA[clasificacion],
                        mandatory: true,
                        no_evaluable_reason: clasificacion === "to_check" ? "source_unavailable" : null,
                        message: MENSAJES[clasificacion],
                        timestamp: ahora,
                        errors: [],
                    },
                ],
                errors: [],
                document_classification: clasificacion,
                validation_status: "completed",
                validation_version: "motor-de-prueba@1",
                timestamp: ahora,
                resubmission_allowed: !cumple,
                required_action: cumple ? "none" : "upload_new_version",
                resubmission_reason: cumple ? null : MENSAJES[clasificacion],
            },
        ],
    };
}

async function analizarControlado(req, res, cuerpo) {
    const form = await new Response(cuerpo, {
        headers: { "content-type": req.headers["content-type"] ?? "" },
    }).formData();
    const tipo = String(form.get("tipos") ?? "");
    const estudiante = JSON.parse(String(form.get("estudiante") ?? "{}"));
    const archivo = form.get("documentos");
    const clave = (archivo && typeof archivo !== "string" ? archivo.name : "").replace(/\.pdf$/i, "");
    const clasificacion = clasificaciones[clave] ?? clasificaciones[tipo] ?? "valid";
    responder(res, 200, respuestaControlada(tipo, clasificacion, estudiante));
}

http
    .createServer(async (req, res) => {
        try {
            const cuerpo = await leerCuerpo(req);
            if (req.url === "/__control" && req.method === "POST") {
                const pedido = JSON.parse(cuerpo.toString("utf8") || "{}");
                const pedidas = pedido.clasificaciones ?? {};
                if (!["real", "controlado"].includes(pedido.modo) || Object.values(pedidas).some((c) => !CLASIFICACIONES.has(c)))
                    return responder(res, 400, { error: "Control inválido." });
                modo = pedido.modo;
                clasificaciones = pedidas;
                fallar = pedido.fallar === true;
                return responder(res, 200, { modo, clasificaciones, fallar });
            }
            if (req.url === "/__control") return responder(res, 200, { modo, clasificaciones, fallar });
            if (req.url === "/analizar" && req.method === "POST") {
                if (fallar) return responder(res, 500, { error: "Falla simulada del motor." });
                if (modo === "controlado") return await analizarControlado(req, res, cuerpo);
            }
            await reenviar(req, res, cuerpo);
        } catch (error) {
            responder(res, 502, { error: `Motor de prueba: ${error instanceof Error ? error.message : String(error)}` });
        }
    })
    .listen(PUERTO, "127.0.0.1", () => console.log(`Motor de prueba en http://127.0.0.1:${PUERTO} -> ${MOTOR_REAL}`));
