# Tarea 54b: separar los programas académicos de Pregrado y Posgrado

Issue: https://github.com/ISCOUTB/check_u/issues/164

## Comportamiento

El funcionario administra desde `/funcionario/opciones` las opciones de los campos del formulario, ahora con dos categorías independientes para los programas académicos:

| Campo interno | Nombre visible |
|---|---|
| `TIPO_DOCUMENTO` | Tipo de documento |
| `GENERO` | Género |
| `PROGRAMA_PREGRADO` | Programa académico de Pregrado |
| `PROGRAMA_POSGRADO` | Programa académico de Posgrado |
| `OPCION_GRADO` | Opción de grado |
| `TIPO_DISCAPACIDAD` | Tipo de discapacidad |

Cada categoría permite de forma independiente:
- Crear programas para su respectivo nivel.
- Modificar el orden (subir o bajar).
- Eliminar programas.
- Importar opciones desde archivos CSV.

Los formularios de pregrado y posgrado (`/estudiante/iniciar_preinscripcion?nivel=PREGRADO` y `/estudiante/iniciar_preinscripcion?nivel=POSGRADO`) consultan y muestran únicamente los programas académicos asociados a su nivel de formación, evitando cruces de información y confusiones para los estudiantes.

## Base de datos y migración

1. Se actualiza la restricción `chk_opciones_campo_campo` en la tabla `opciones_campo` para admitir `PROGRAMA_PREGRADO` y `PROGRAMA_POSGRADO` (manteniendo `PROGRAMA` para compatibilidad histórica).
2. Se agrega la migración idempotente `db/migrations/011-separar-programas-pregrado-posgrado.sql`, que migra los programas existentes a `PROGRAMA_PREGRADO` y siembra programas iniciales para `PROGRAMA_POSGRADO`.
3. Se actualiza `db/init/01-schema.sql` y `db/tests/aceptacion.sql` reflejando 6 campos y los programas iniciales de pregrado y posgrado.

## Backend (API)

- `GET /opciones-campo`: Devuelve todas las opciones (usado por el panel de funcionarios).
- `GET /opciones-campo?nivel=PREGRADO`: Filtra y devuelve únicamente las opciones correspondientes a pregrado (`PROGRAMA_PREGRADO`, sin `PROGRAMA_POSGRADO`).
- `GET /opciones-campo?nivel=POSGRADO`: Filtra y devuelve únicamente las opciones correspondientes a posgrado (`PROGRAMA_POSGRADO`, sin `PROGRAMA_PREGRADO` ni `OPCION_GRADO`).
- `GET /opciones-campo?campo=...`: Filtra por campo específico.
- Compatibilidad: Si se recibe `PROGRAMA` en `validarCampo`, se mapea de forma transparente a `PROGRAMA_PREGRADO`.

## Frontend

- `frontend/app/funcionario/opciones/api.ts`: Define las dos categorías independientes `PROGRAMA_PREGRADO` y `PROGRAMA_POSGRADO`.
- `frontend/app/estudiante/iniciar_preinscripcion/opciones.ts`: `cargarOpcionesFormulario(nivel)` consulta `/opciones-campo?nivel=${nivel}` y asigna al selector de programa exclusivamente las opciones de dicho nivel.
- `frontend/app/estudiante/iniciar_preinscripcion/FormularioPreinscripcion.tsx`: Envía el parámetro `nivelPedido` a `cargarOpcionesFormulario(nivelPedido)`.
- `frontend/e2e/opciones_formulario.spec.ts`: Cobertura E2E para verificar ambos bloques en el panel del funcionario y la exclusividad de programas en los formularios de pregrado y posgrado.
