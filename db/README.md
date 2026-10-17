# db/ — Base de datos de CheckU

PostgreSQL con el esquema y los datos iniciales de CheckU. Esta carpeta es el contexto de construcción del servicio `db` de `docker-compose.yml` (`...check_u.git#main:db`).

> **Solo datos ficticios.** Esta base corre en un servidor de laboratorio. No guardar cédulas, resultados ni ningún dato real de estudiantes hasta contar con autorización institucional de tratamiento de datos.

## Estructura

```
db/
├── README.md
└── init/
    ├── 01-schema.sql          Esquema completo (usuarios va primero)
    └── 02-seed-usuarios.sql   Dos usuarios de prueba (estudiante y funcionario)
```

Los archivos se ejecutan en orden alfabético, por eso llevan prefijo numérico.

## Cómo se aplica el esquema

1. **Primer arranque.** La imagen de PostgreSQL ejecuta los `.sql` de `/docker-entrypoint-initdb.d/` **solo cuando el volumen `pgdata` está vacío**. Reconstruir la imagen o cambiar un `.sql` no vuelve a ejecutarlos.
2. **Cada despliegue** (si el compose incluye el servicio `db-migrate`). Aplica todos los `.sql` de esta carpeta en cada despliegue y el backend espera a que termine. Por eso **todos los scripts deben poder ejecutarse más de una vez sin error ni pérdida de datos**.

Cuando existan las migraciones de la Tarea 03, `db-migrate` se reemplaza por ellas y `init/` queda solo con el arranque inicial y los datos de prueba.

## Reglas para escribir scripts (obligatorias)

- **Nombre:** `NN-descripcion.sql`, con número mayor al último. Un cambio de esquema es un archivo nuevo; no edites uno ya desplegado salvo que siga siendo idempotente.
- **Idempotentes:** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `INSERT ... ON CONFLICT DO NOTHING`.
- **No destructivos:** sin `DROP`, `TRUNCATE` ni `DELETE` sin `WHERE`. Un cambio destructivo se hace a mano, con respaldo previo y revisión.
- **Orden:** las tablas de las que otras dependen van antes (por ejemplo, `usuarios`).
- **Códigos y números de identificación como texto** (`VARCHAR`), para conservar ceros iniciales.
- **Fechas nuevas con `TIMESTAMPTZ`.** El límite diario de reenvíos depende de la fecha local de `America/Bogota`.
- **Los resultados y las versiones de documentos se insertan, no se sobrescriben.**
- **Sin contraseñas, claves ni datos reales** en ningún `.sql`. Los datos de prueba van en archivos aparte (`02-...`) para poder excluirlos de entornos reales.

## Tabla `usuarios`

| Columna | Notas |
|---|---|
| `id_usuario` | Clave primaria autogenerada |
| `nombres`, `apellidos` | Obligatorias |
| `correo` | Único; es lo que identifica al usuario en el login de pruebas |
| `rol` | `ESTUDIANTE`, `FUNCIONARIO` o `BIBLIOTECA` (en mayúsculas) |
| `activo` | Por defecto `TRUE` |
| `fecha_creacion`, `fecha_actualizacion` | `TIMESTAMP` con valor por defecto |

No hay columna de contraseña: el login de pruebas usa una clave común tomada de la variable de entorno `DEV_SHARED_PASSWORD`. Es un mecanismo temporal que la autenticación institucional de Microsoft reemplazará.

### Datos de prueba (`02-seed-usuarios.sql`)

Dos filas: una con rol `ESTUDIANTE` y otra con `FUNCIONARIO`, con correos de `example.com` y nombres vacíos. El script usa `ON CONFLICT (correo) DO NOTHING`.

## Variables de entorno

| Variable | Uso |
|---|---|
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Credenciales y nombre de la base. Compose se niega a iniciar si faltan |
| `DB_HOST` | `db` dentro de Docker; `localhost` desde tu equipo |
| `DB_PORT` | `5432` |

Se definen en `.env` (no se sube al repositorio; hay un `.env.example` sin valores) y, en el servidor, en Dokploy → Environment. Usa claves distintas en local y en el servidor.

## Uso local

Desde la raíz del repo, con Docker Desktop abierto:

```powershell
# Levantar solo la base (puerto 5432 publicado solo hacia tu equipo)
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build db

# Comprobar que el esquema y los usuarios se crearon
docker compose -f docker-compose.yml -f docker-compose.local.yml exec db psql -U <DB_USER> -d <DB_NAME> -c "select correo, rol from usuarios;"

# Aplicar un .sql a mano sin perder datos
docker compose -f docker-compose.yml -f docker-compose.local.yml exec -T db psql -U <DB_USER> -d <DB_NAME> -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/01-schema.sql

# Reiniciar de cero (BORRA todos los datos locales)
docker compose -f docker-compose.yml -f docker-compose.local.yml down -v
```

Backend y frontend se levantan con Node como siempre (`npm run start:dev` y `npm run dev`), con `DB_HOST=localhost`.

## Despliegue

- **No publiques el puerto 5432** ni le asignes un dominio. La base solo debe verse dentro de la red de Compose.
- El volumen `pgdata` conserva los datos entre despliegues; se pierde si se elimina el servicio o el volumen desde Dokploy.
- `CHECKU_REF` define la versión de `db/` que se construye. Fíjala a un commit o etiqueta si no quieres que `main` cambie el despliegue sin avisar.
- Cambiar `DB_PASSWORD` en el entorno no cambia la clave que ya guarda PostgreSQL: hay que cambiarla también dentro de la base o recrear el volumen.
- Fija la versión de PostgreSQL. Un cambio de versión mayor sobre un volumen existente exige volcar y restaurar.

## Respaldo y restauración

```powershell
# Respaldo (usa PowerShell 7: en Windows PowerShell 5 la redirección con > guarda en UTF-16 y corrompe el archivo)
docker compose exec -T db pg_dump -U <DB_USER> -d <DB_NAME> > respaldo.sql

# Restauración
docker compose exec -T db psql -U <DB_USER> -d <DB_NAME> < respaldo.sql
```

Haz un respaldo antes de cualquier cambio destructivo o de versión, y guárdalo fuera del servidor. Los respaldos contienen los datos: no los subas al repositorio.

## Pendientes

- Columna para el código estudiantil (`T000…`) en `usuarios` o en otra tabla del modelo.
- Resto de tablas del modelo (solicitudes, documentos, versiones, validaciones, historial, revisiones) en `01-schema.sql`.
- Migrar `fecha_creacion` y `fecha_actualizacion` a `TIMESTAMPTZ` si se confirma que hace falta.
- Decisión del ORM y de dónde viven las migraciones (Tarea 03).
- Confirmar la versión de PostgreSQL (16 es una propuesta).
- Estas instrucciones no se han ejecutado todavía: verifícalas en cuanto el servicio `db` esté integrado.