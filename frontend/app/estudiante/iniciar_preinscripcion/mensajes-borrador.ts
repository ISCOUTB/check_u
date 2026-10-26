/** Mensajes controlados por la aplicación: nunca mostrar mensajes crudos del servidor. */
export const GUARDADO_EXITOSO = "Tu borrador se guardó correctamente. Puedes continuar tu preinscripción más adelante.";
export const ERROR_INESPERADO = "Ocurrió un inconveniente al guardar tu borrador. Tu información permanece en el formulario; inténtalo nuevamente en unos momentos.";
const CAMPOS: Record<string, string> = {
    "perfil.tipoDocumento": "el tipo de documento de identidad",
    "perfil.numeroDocumento": "el número de documento de identidad",
    "perfil.fechaNacimiento": "la fecha de nacimiento",
    "perfil.ciudad": "la ciudad de residencia",
    nombres: "los nombres", apellidos: "los apellidos", codigoEstudiantil: "el código estudiantil",
    nivel: "el nivel académico", tipo_solicitud: "el nivel académico",
    "pregrado.fechaExamenSaberPro": "la fecha del examen Saber Pro",
    "pregrado.numeroRegistroSaberPro": "el registro Saber Pro",
    "programas.programa": "el programa académico", "programas.modalidad": "la modalidad del programa",
    "documentos.nombre": "el nombre del documento", "documentos.tamano": "el tamaño del documento",
};

export class ErrorGuardadoBorrador extends Error {
    constructor(message: string, readonly codigo: string) { super(message); }
}

export function errorDeConexion(): ErrorGuardadoBorrador {
    return new ErrorGuardadoBorrador(
        "No pudimos conectar con el servidor. Verifica tu conexión a internet e intenta guardar tu borrador nuevamente.",
        "BORRADOR_CONEXION",
    );
}

function objeto(valor: unknown): Record<string, unknown> {
    return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}

export function interpretarErrorGuardado(status: number, respuesta: unknown): ErrorGuardadoBorrador {
    const datos = objeto(respuesta);
    if (status === 401) return new ErrorGuardadoBorrador(
        "Tu sesión ha expirado. Inicia sesión nuevamente para continuar con tu preinscripción.", "BORRADOR_SESION_EXPIRADA");
    if (status === 403) return new ErrorGuardadoBorrador(
        "Tu cuenta no tiene permiso para guardar esta preinscripción. Verifica que ingresaste como estudiante.", "BORRADOR_SIN_PERMISO");
    if (status === 409) return datos.codigo === "BORRADOR_IDENTIDAD_REPETIDA"
        ? new ErrorGuardadoBorrador("No pudimos guardar tu borrador porque ese documento de identidad ya está registrado. Verifica su tipo y número; si son correctos, contacta al personal de grados.", "BORRADOR_IDENTIDAD_REPETIDA")
        : new ErrorGuardadoBorrador("La preinscripción ya fue enviada y no permite guardar cambios como borrador. Consulta el estado de tu solicitud.", "BORRADOR_NO_EDITABLE");
    if (status === 400 || status === 422) {
        const primero = objeto(Array.isArray(datos.campos) ? datos.campos[0] : null);
        const claveCampo = typeof primero.campo === "string" ? primero.campo.replace(/\.\d+(?=\.|$)/g, "") : "";
        const campo = Object.hasOwn(CAMPOS, claveCampo) ? CAMPOS[claveCampo] : undefined;
        const faltante = datos.codigo === "BORRADOR_CAMPO_REQUERIDO" && primero.motivo === "FALTANTE";
        const mensaje = campo
            ? faltante
                ? `No pudimos guardar tu borrador porque falta completar ${campo}. Verifica este campo e inténtalo nuevamente.`
                : `No pudimos guardar tu borrador porque ${campo} contiene un valor inválido. Verifica este campo e inténtalo nuevamente.`
            : "No pudimos guardar tu borrador porque algunos datos no son válidos. Revisa el formulario e inténtalo nuevamente.";
        return new ErrorGuardadoBorrador(mensaje, faltante ? "BORRADOR_CAMPO_REQUERIDO" : "BORRADOR_DATOS_INVALIDOS");
    }
    if (status === 503) return new ErrorGuardadoBorrador(
        "El servicio de guardado no está disponible en este momento. Tu información permanece en el formulario; intenta nuevamente en unos momentos.", "BORRADOR_SERVICIO_NO_DISPONIBLE");
    return new ErrorGuardadoBorrador(ERROR_INESPERADO, "BORRADOR_ERROR_SERVIDOR");
}

export function mensajeErrorGuardado(error: unknown): string {
    return error instanceof ErrorGuardadoBorrador ? error.message : ERROR_INESPERADO;
}
