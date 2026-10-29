# Tarea 40: administrar las opciones del formulario

Issue: https://github.com/ISCOUTB/check_u/issues/99

Base de implementación: `6b2c26c`.

## Comportamiento

El funcionario administra desde `/funcionario/opciones` las opciones de cinco
campos de la preinscripción:

| Campo interno | Nombre visible |
|---|---|
| `TIPO_DOCUMENTO` | Tipo de documento |
| `GENERO` | Género |
| `PROGRAMA` | Programa académico |
| `OPCION_GRADO` | Opción de grado |
| `TIPO_DISCAPACIDAD` | Tipo de discapacidad |

El enlace aparece en la barra de navegación con sesión de funcionario. Cada campo
tiene un bloque independiente. En cada bloque se puede:

- Crear una opción al final de la lista.
- Subir o bajar una opción para cambiar su orden.
- Eliminar una opción después de confirmar el diálogo.
- Importar un archivo CSV con una o varias opciones.

Los cambios se aplican de inmediato al formulario de nuevas preinscripciones.
El orden guardado en la base de datos es el orden en que el estudiante ve las
opciones; el frontend no vuelve a ordenarlas.

Las operaciones muestran un mensaje de éxito o el error devuelto por el backend.
Los errores de conexión, permisos, duplicados y validación tienen mensajes
propios, sin mostrar SQL ni detalles internos.

## Persistencia

La tabla `opciones_campo` guarda el catálogo:

| Columna | Uso |
|---|---|
| `id_opcion` | Identificador entero generado por la base. |
| `campo` | Uno de los cinco valores internos de la tabla anterior. |
| `valor` | Valor estable que se guarda en la solicitud. |
| `etiqueta` | Texto que ve el estudiante y el funcionario. |
| `orden` | Posición dentro del campo, desde 1. |
| `activo` | Reservado para desactivar opciones sin borrarlas. |
| `fecha_creacion`, `fecha_actualizacion` | Auditoría. |

Restricciones principales:

- `(campo, valor)` es único.
- La etiqueta no se repite dentro de un campo, sin distinguir mayúsculas.
- El campo solo admite los cinco valores internos indicados.
- `valor` y `etiqueta` no pueden estar vacíos.
- `orden` debe ser mayor o igual que 1.

El valor interno se genera a partir de la etiqueta: se eliminan las tildes, se
convierte a mayúsculas, los caracteres no alfanuméricos pasan a `_` y se recorta
a 80 caracteres. Por ejemplo, `Cédula de ciudadanía` produce `CEDULA_DE_CIUDADANIA`.
El CSV puede traer un valor interno explícito en su segunda columna; también se
normaliza antes de guardarlo.

El esquema inicial está en `db/init/01-schema.sql`. Para una base existente se
aplica `db/migrations/006-opciones-campos.sql`, que es idempotente. El seed crea
31 opciones iniciales: las listas que antes estaban fijas en el frontend y
catorce programas de ejemplo.

El tipo de discapacidad deja de ser un catálogo cerrado en `perfil_estudiante`.
La restricción del perfil conserva la coherencia: si `tiene_discapacidad` es
verdadero, `tipo_discapacidad` debe tener un valor no vacío; si no es verdadero,
tanto el tipo como los detalles deben ser nulos.

## API

Todas las rutas usan el prefijo `/api`. `GET` requiere una sesión válida; las
demás operaciones requieren rol `funcionario`.

| Método y ruta | Cuerpo | Resultado |
|---|---|---|
| `GET /opciones-campo` | — | Lista agrupada por campo y ordenada por `orden`, `id_opcion`. |
| `GET /opciones-campo?campo=PROGRAMA` | — | Lista de un solo campo. |
| `POST /opciones-campo` | `{ campo, etiqueta, valor? }` | Crea la opción al final. |
| `POST /opciones-campo/importar` | `{ campo, texto }` | Importa el CSV y devuelve el resumen. |
| `PATCH /opciones-campo/orden` | `{ campo, ids }` | Guarda el orden completo del campo. |
| `PATCH /opciones-campo/:id` | `{ etiqueta }` | Cambia el nombre visible. |
| `DELETE /opciones-campo/:id` | — | Elimina la opción del catálogo. |

`PATCH /opciones-campo/orden` exige la lista completa de identificadores del
campo, sin repetidos, sobrantes ni faltantes. La operación se ejecuta en una
transacción y actualiza las posiciones desde 1.

Al eliminar una opción, las solicitudes y borradores que ya usaban su `valor`
conservan el dato. Al abrir el formulario, ese valor huérfano se muestra como una
opción adicional para que el estudiante pueda reemplazarlo sin perder lo escrito.

## Formato del CSV

El archivo se procesa en el navegador y se envía como texto al backend. Límite:
1 MB. Se acepta:

- Separador coma o punto y coma. Se detecta con la primera línea con datos, para
  que funcione con Excel en español.
- BOM de UTF-8.
- Celdas entre comillas dobles, incluido el escape `""`.
- Una fila de encabezado opcional. Se reconocen, entre otros, `etiqueta`,
  `opción`, `nombre` y `valor visible`.
- Una o dos columnas: nombre visible y, opcionalmente, valor interno.

Ejemplo separado por punto y coma:

```csv
Etiqueta;Valor interno
Cédula de ciudadanía;CC
Tarjeta de identidad;TI
```

La importación no se cancela por filas inválidas: inserta las filas válidas y
devuelve un resumen con:

```text
total       registros leídos
creadas     opciones nuevas insertadas
duplicados  línea y nombre de opciones ya existentes o repetidas en el archivo
vacias      líneas con separadores pero sin datos
invalidos   línea, valor y motivo
```

Se rechazan etiquetas vacías, etiquetas de más de 150 caracteres, valores internos
sin letras o números y valores internos de más de 80 caracteres. La comparación
de duplicados se hace contra el catálogo actual y contra las filas anteriores del
mismo archivo, sin distinguir mayúsculas en la etiqueta.

## Integración con el formulario

`FormularioPreinscripcion` carga el borrador y el catálogo en paralelo mediante
`GET /opciones-campo`. Los selects de identificación, datos académicos y contacto
usan las opciones recibidas. Ya no hay listas fijas de documento, género,
programa, opción de grado ni tipo de discapacidad en `constantes.ts`.

Si la carga del catálogo falla, el formulario muestra el error general de carga;
no se reemplaza silenciosamente por una lista local. Los valores guardados que ya
no existen en el catálogo se conservan con `conValorActual` hasta que el estudiante
los cambie.

## Migración y despliegue

En una base existente, sin borrar datos:

```powershell
psql -h localhost -p 5432 -U postgres -d checku -X -v ON_ERROR_STOP=1 -f db/migrations/006-opciones-campos.sql
```

En una base nueva, `db/init/01-schema.sql` ya contiene la tabla, las restricciones,
el ajuste de discapacidad y las 31 opciones iniciales. Repetir el seed no duplica
las opciones existentes gracias a `ON CONFLICT DO NOTHING`.

La prueba de aceptación vigente espera 15 tablas, 31 opciones iniciales, los cinco
campos y que `AUDITIVA` sea aceptado como tipo de discapacidad. El registro
histórico de `resultado_verificacion.txt` corresponde a una ejecución anterior y
debe regenerarse con `db/tests/verificar.ps1` en el PostgreSQL del equipo.

## Verificación

Desde la raíz del repositorio:

```powershell
npm --prefix backend test -- src/opciones/opciones-csv.spec.ts src/opciones/opciones.service.spec.ts
npm --prefix backend run build
npm --prefix backend run lint
```

Desde `frontend`:

```powershell
npx tsc --noEmit
npm run lint
npx playwright test e2e/opciones_formulario.spec.ts
```

Resultados de la implementación:

- 13 pruebas unitarias del módulo `opciones` aprobadas: 5 del lector CSV y 8 del
  servicio.
- Suite completa del backend aprobada: 336 pruebas en 22 archivos.
- 6 pruebas E2E del panel aprobadas: acceso desde la barra, creación, orden,
  eliminación, importación con duplicados, rechazo de archivos que no son CSV,
  orden reflejado en el formulario y revisión móvil/accesible.
- `tsc`, lint del frontend y build/lint del backend sin errores nuevos.

La suite E2E completa puede agotar el tiempo de espera de los casos de login,
base y tema cuando el servidor de desarrollo de Next está saturado por varios
workers. Esos casos pasan al ejecutarlos de nuevo por separado; no son una
regresión del panel.

## Prueba manual breve

1. Aplicar el esquema o la migración y arrancar PostgreSQL, backend y frontend.
2. Entrar como funcionaria y abrir **Opciones del formulario** desde la barra.
3. Crear una opción en `Programa académico`, subirla y comprobar que cambia de
   posición. Intentar crear el mismo nombre otra vez y verificar el error.
4. Importar un CSV con una opción nueva y una repetida. Comprobar el resumen.
5. Entrar como estudiante a la preinscripción y verificar que el select muestra
   las opciones en el orden configurado.
6. Eliminar una opción usada por un borrador y comprobar que el valor guardado
   sigue visible en el formulario.
