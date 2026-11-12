# Tarea 68 — Identidad del estudiante en el formulario de preinscripción

## Qué cambió

El formulario de preinscripción precarga los datos de identidad desde la tabla
`usuarios` (no desde el borrador ni desde el usuario de la sesión):

| Campo | Origen | Editable |
| --- | --- | --- |
| Nombres | `usuarios.nombres` | Sí |
| Apellidos | `usuarios.apellidos` | Sí |
| Correo institucional | `usuarios.correo` | No |
| Código estudiantil | `usuarios.codigo_estudiante` | No, si ya está registrado |

Si `codigo_estudiante` es `NULL` (el registro de estudiantes lo permite), el campo
queda editable para que el estudiante lo complete.

## Backend

`GET /solicitudes/borrador` incluye ahora `estudiante` con
`{ nombres, apellidos, correo, codigoEstudiantil }`, tanto si hay borrador como si
no. El objeto `borrador` conserva su contrato anterior.

`POST /solicitudes/borrador` bloquea la fila de `usuarios` y lee
`codigo_estudiante`. Si ya tiene un valor, el código del payload se descarta: un
payload viejo o manipulado nunca puede sobrescribirlo ni provocar el error de
clave duplicada `uq_usuarios_codigo_estudiante` (`23505`).

## Frontend

`cargarPreinscripcion` combina la identidad con el borrador vacío o guardado y el
correo registrado reemplaza al usuario de la sesión cuando existe.
`Academico` muestra el código como `readOnly` y explica el motivo en la ayuda
cuando está bloqueado.

## Pruebas

- `frontend/e2e/preinscripcion_identidad.spec.ts`: precarga, bloqueo y caso de
  código pendiente.
- `backend/src/solicitudes/solicitudes.service.spec.ts`: no sobrescribe un código
  existente y sí completa uno vacío.
