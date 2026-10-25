# CheckU

Sistema web de prevalidación automatizada de solicitudes de grado de la Universidad Tecnológica de Bolívar (UTB).

## Tabla de contenido

- [Descripción general](#descripción-general)
- [Objetivos](#objetivos)
- [Arquitectura del proyecto](#arquitectura-del-proyecto)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración local](#instalación-y-configuración-local)
- [Configuración de variables de entorno](#configuración-de-variables-de-entorno)
- [Base de datos](#base-de-datos)
- [Arranque y reconstrucción local](#arranque-y-reconstrucción-local)
- [Verificación del funcionamiento](#verificación-del-funcionamiento)
- [Endpoints principales](#endpoints-principales)
- [Requisitos documentales](#requisitos-documentales)
- [Proceso de prevalidación](#proceso-de-prevalidación)
- [Motor OCR y validación documental](#motor-ocr-y-validación-documental)
- [Frontend](#frontend)
- [Backend](#backend)
- [Seguridad y protección de datos](#seguridad-y-protección-de-datos)
- [Solución de problemas](#solución-de-problemas)
- [Consideraciones y limitaciones](#consideraciones-y-limitaciones)

---

## Descripción general

CheckU es un sistema web orientado a la prevalidación automatizada de solicitudes de grado. Su propósito es analizar preliminarmente los documentos entregados por los estudiantes antes de que las solicitudes pasen a la revisión formal del personal encargado.

Actualmente, la revisión manual de solicitudes puede implicar documentos incompletos, inconsistencias entre archivos, requisitos incumplidos y reprocesos. Estas situaciones incrementan la carga operativa y dificultan identificar oportunamente los problemas de cada expediente.

CheckU busca reducir ese trabajo mediante la recepción de documentos, la extracción automatizada de información y la aplicación de reglas de validación.

El sistema contempla tres perfiles principales:

- **Estudiante:** consulta los requisitos, presenta sus documentos y revisa las observaciones de la prevalidación.
- **Personal de grados:** consulta las solicitudes, revisa sus estados y gestiona las observaciones correspondientes.
- **Personal de Biblioteca:** participa en el proceso de expedición y firma criptográfica de los Paz y Salvos de Biblioteca.

La prevalidación es una herramienta de apoyo. No reemplaza la revisión institucional ni la decisión administrativa final sobre una solicitud de grado.

## Objetivos

- Automatizar la recepción y prevalidación de documentos.
- Extraer información relevante mediante OCR y lectura directa de formatos compatibles.
- Identificar documentos faltantes, ilegibles, inconsistentes o que no cumplan los requisitos.
- Comparar información entre documentos de una misma solicitud.
- Reducir los reprocesos que llegan a la revisión manual.
- Facilitar el seguimiento de solicitudes y la consulta de sus resultados.
- Preparar una arquitectura modular que permita integrar servicios institucionales y componentes adicionales.

## Arquitectura del proyecto

El proyecto se organiza en componentes independientes:

| Componente | Ubicación | Responsabilidad |
|---|---|---|
| Frontend | `frontend/` | Interfaz web de estudiantes y funcionarios. |
| Backend | `backend/` | API, autenticación, sesiones y servicios de aplicación. |
| Base de datos | `db/` | Esquema SQL y datos iniciales. |
| Motor documental | Módulos Python del proyecto | OCR, extracción y validación documental. |
| Infraestructura local | `docker-compose.local.yml` o `docker.compose.local.yml` | Servicios de desarrollo local. |
| Despliegue | Configuración de Dokploy | Despliegue del proyecto en el entorno correspondiente. |
| Arranque local | `levantar.ps1` | Preparación de la base de datos e inicio del frontend y backend. |
| Respaldos locales | `backups/` | Copias de seguridad SQL excluidas del repositorio. |

La disponibilidad de cada funcionalidad depende de su estado de implementación e integración.

## Tecnologías utilizadas

### Frontend

- Next.js 16 con App Router.
- React 19.
- TypeScript.
- Tailwind CSS v4.
- Chart.js para las visualizaciones estadísticas previstas.

### Backend

- Node.js.
- NestJS.
- TypeScript.
- PostgreSQL.
- `pg` para la conexión con PostgreSQL.
- Sesiones mediante cookies y configuración CORS.

### Motor OCR y validación documental

- Python.
- OpenCV.
- Tesseract OCR.
- PyMuPDF.
- Poppler como alternativa para procesar PDF cuando sea necesario.
- `zxing-cpp` para la lectura de códigos compatibles.
- RapidFuzz para la comparación aproximada de cadenas.

Las dependencias concretas deben instalarse de acuerdo con los archivos de configuración de cada componente.

### Infraestructura

- Docker y Docker Compose.
- PostgreSQL 16 en el entorno local descrito.
- Dokploy para el despliegue configurado.
- Git para el control de versiones.

## Requisitos previos

Antes de instalar CheckU, se recomienda disponer de los siguientes componentes.

| Requisito | Uso |
|---|---|
| Windows 10/11 o un entorno compatible | Desarrollo local. |
| Git | Clonar el repositorio y administrar cambios. |
| Node.js 22 LTS | Ejecutar el frontend y backend. |
| npm | Instalar dependencias JavaScript. |
| Docker Desktop | Ejecutar PostgreSQL localmente en Windows. |
| Docker Compose | Administrar los servicios del entorno local. |
| Python | Ejecutar el motor OCR y los módulos de validación. |
| Tesseract OCR | Reconocer texto en imágenes y documentos. |
| Idioma español de Tesseract | Mejorar la lectura de documentos en español. |
| Poppler | Procesamiento alternativo de PDF cuando corresponda. |

Se recomienda comprobar las versiones exigidas por los archivos `package.json`, los archivos de dependencias de Python y la configuración del proyecto antes de instalar versiones distintas.

Para verificar las herramientas principales:

```powershell
node --version
npm --version
git --version
docker --version
docker compose version
python --version
```

Para comprobar que Docker está iniciado:

```powershell
docker info
```

Si el comando falla, inicia Docker Desktop y vuelve a intentarlo.

## Instalación y configuración local

### 1. Obtener el repositorio

Si todavía no tienes una copia local:

```powershell
git clone <URL_DEL_REPOSITORIO>
cd check_u
```

Si el repositorio ya está descargado, entra en su carpeta raíz:

```powershell
cd C:\check_u
```

La raíz del proyecto debe contener, entre otros archivos, las carpetas `backend/`, `frontend/` y `db/`, además del script `levantar.ps1`.

### 2. Instalar dependencias del backend

```powershell
cd C:\check_u\backend
npm install
```

Regresa a la raíz:

```powershell
cd C:\check_u
```

### 3. Instalar dependencias del frontend

```powershell
cd C:\check_u\frontend
npm install
```

Regresa a la raíz:

```powershell
cd C:\check_u
```

Si el repositorio utiliza archivos de bloqueo de npm, conserva esos archivos y evita eliminarlos durante la instalación.

### 4. Configurar las variables de entorno

Crea el archivo local del backend a partir de su plantilla:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

Si `backend/.env` ya existe, no lo sobrescribas: conserva su configuración local.

Edita `backend/.env` y establece los valores correspondientes a la base de datos local y los demás servicios que utilice el backend.

La configuración de PostgreSQL debe coincidir con la definida en Docker Compose.

### 5. Levantar PostgreSQL

Desde la raíz del proyecto, ejecuta:

```powershell
docker compose -f docker-compose.local.yml up -d db
```

Si el archivo de tu repositorio se llama `docker.compose.local.yml`, utiliza ese nombre en el comando.

Comprueba el contenedor:

```powershell
docker ps
```

El contenedor esperado es `checku-db-local`. Si tiene configurado un healthcheck, comprueba que su estado sea `healthy`.

Para revisar sus registros:

```powershell
docker logs checku-db-local
```

### 6. Iniciar las aplicaciones

Para el arranque habitual de desarrollo se puede ejecutar el backend y frontend en terminales independientes.

Backend:

```powershell
cd C:\check_u\backend
npm run start:dev
```

Frontend:

```powershell
cd C:\check_u\frontend
npm run dev -- -p 3001
```

Motor OCR y validación documental (Python):

```powershell
cd C:\check_u
.\venv\Scripts\Activate.ps1
python -m modules.api.app
```

El motor quedará escuchando en `http://127.0.0.1:5001` y atenderá las solicitudes de análisis y validación enviadas por el backend.

En este modo, PostgreSQL debe estar iniciado previamente.

**Importante:** el script `levantar.ps1` tiene un comportamiento diferente: reconstruye la base de datos a partir de los SQL del proyecto antes de iniciar las aplicaciones. Consulta la sección [Arranque y reconstrucción local](#arranque-y-reconstrucción-local).

## Configuración de variables de entorno

El archivo `backend/.env` contiene la configuración local del backend. No debe incluirse en el repositorio.

Entre las variables utilizadas en la configuración actual se encuentran:

| Variable | Propósito |
|---|---|
| `PORT` | Puerto de escucha del backend. |
| `DB_HOST` | Host de PostgreSQL. |
| `DB_PORT` | Puerto de PostgreSQL. |
| `DB_USER` | Usuario de conexión a PostgreSQL. |
| `DB_PASSWORD` | Contraseña del usuario de PostgreSQL. |
| `DB_NAME` | Nombre de la base de datos. |
| `SESSION_SECRET` | Secreto de configuración de las sesiones. |
| `OBSERVE_APP_KEY` | Clave de la integración de observabilidad, cuando se utilice. |
| `OBSERVE_APP_SECRET` | Secreto de la integración de observabilidad, cuando se utilice. |
| `MOTOR_URL` | URL del servicio HTTP del motor OCR/validación (por defecto `http://127.0.0.1:5001`). |

Para el entorno local descrito, los valores de conexión de PostgreSQL deben coincidir con el archivo Compose y con las credenciales configuradas en el contenedor.

La plantilla `backend/.env.example` debe contener únicamente valores de ejemplo, nunca secretos reales.

El backend carga las variables de entorno desde su archivo local cuando corresponde. Comprueba que `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` se estén leyendo correctamente si la conexión falla.

No compartas el archivo `.env` ni publiques contraseñas, claves API o secretos de sesión en capturas de pantalla, registros o commits.

## Base de datos

### Ubicación del esquema y los datos iniciales

Los archivos SQL oficiales del proyecto están ubicados en:

```text
db/
├── README.md
└── init/
    ├── 01-schema.sql
    └── 02-userbase.sql
```

Responsabilidades:

- **`01-schema.sql`:** define el esquema de la base de datos, incluyendo las tablas, relaciones y restricciones que se hayan implementado.
- **`02-userbase.sql`:** contiene los datos iniciales de usuarios para el entorno correspondiente.

Estos archivos son la fuente de referencia para la inicialización configurada en el despliegue. Dokploy debe utilizar la configuración de despliegue que corresponda para ejecutar los scripts.

Antes de modificar el esquema, revisa también `db/README.md` y la configuración de PostgreSQL del despliegue.

### Orden de ejecución

El orden esperado es:

1. Crear una base de datos vacía.
2. Ejecutar `01-schema.sql`.
3. Ejecutar `02-userbase.sql`.
4. Verificar que el esquema y los datos iniciales se hayan creado correctamente.

Los scripts deben ser compatibles con una inicialización limpia. Si se agregan nuevas tablas, restricciones o relaciones, se deben revisar también los datos iniciales y sus dependencias.

### Diferencia entre desarrollo local y despliegue

En el entorno local, `levantar.ps1` reconstruye la base de datos a partir de los dos archivos SQL.

En el entorno desplegado, la ejecución de los scripts depende de la configuración de Dokploy y del mecanismo de inicialización definido para PostgreSQL. No se debe asumir que los cambios de los archivos SQL se aplicarán automáticamente sobre una base persistente ya inicializada.

Por eso, cualquier cambio de esquema debe probarse primero en una base de desarrollo limpia y después trasladarse al mecanismo de actualización previsto para el entorno desplegado.

## Arranque y reconstrucción local

### Funcionamiento de `levantar.ps1`

El script ubicado en la raíz del repositorio permite iniciar el entorno local de CheckU reconstruyendo la base de datos desde los archivos SQL actuales.

Ejecuta desde PowerShell:

```powershell
cd C:\check_u
.\levantar.ps1
```

El flujo previsto es:

1. Verificar los archivos requeridos y la disponibilidad de Docker.
2. Levantar el servicio PostgreSQL.
3. Esperar a que PostgreSQL esté listo.
4. Crear un respaldo SQL de la base anterior, si existe.
5. Eliminar la base de datos local anterior y crear una nueva.
6. Importar `db/init/01-schema.sql`.
7. Importar `db/init/02-userbase.sql`.
8. Comprobar que la nueva base responda correctamente.
9. Iniciar el backend y el frontend en terminales independientes.

Si falla una operación crítica, el script debe detenerse y mostrar el error. No debe continuar con la importación o el arranque como si todo hubiera salido bien.

### Advertencia: se pierden los datos operativos

Cada ejecución de `levantar.ps1` que complete la fase de reconstrucción reemplaza la base activa.

Esto significa que se pierden los datos locales que no estén incluidos en los SQL de inicialización, por ejemplo:

- Usuarios creados manualmente durante las pruebas.
- Solicitudes de grado de prueba.
- Documentos y estados registrados en la base.
- Comentarios e información transaccional.

Los usuarios base y demás datos incluidos en los scripts se vuelven a cargar.

**No ejecutes este script contra una base de datos de producción ni contra una base con información que debas conservar.**

### Respaldos locales

Antes de reemplazar la base, el script genera un respaldo SQL en la carpeta:

```text
backups/
```

Ejemplo de estructura:

```text
backups/
├── checku_20261020_103000.sql
└── checku_20261020_110000.sql
```

Los nombres incluyen una marca de fecha y hora para distinguir las copias.

El respaldo se genera desde PostgreSQL e incluye el esquema y los datos de la base existente mediante sentencias `INSERT`.

Los respaldos son archivos locales y no deben subirse al repositorio. La carpeta raíz `backups/` debe estar incluida en `.gitignore`:

```gitignore
/backups/
```

Antes de eliminar la base anterior, el script debe comprobar que el respaldo se haya generado y que el archivo no esté vacío.

Si el respaldo falla, la operación debe detenerse antes de borrar la base.

### Restauración de un respaldo

Un respaldo SQL permite recuperar los datos anteriores si se necesita investigar un problema o recuperar información de pruebas.

La restauración debe realizarse en una base vacía compatible con el respaldo y utilizando las credenciales correctas. No se recomienda importar el archivo sobre la base activa sin evaluar primero el efecto de las sentencias SQL.

Conserva las copias que necesites y elimina manualmente las que ya no sean necesarias, verificando antes que no sean la única copia de información importante.

### Eliminar y recrear el contenedor

Recrear el contenedor y reconstruir la base de datos son operaciones diferentes.

Para recrear el contenedor sin borrar el volumen:

```powershell
docker compose -f docker-compose.local.yml up -d --force-recreate db
```

Los datos persistidos en el volumen pueden seguir existiendo.

Para reinicializar el contenido desde los SQL, utiliza el flujo de `levantar.ps1`.

Evita ejecutar `docker compose down -v` como solución rutinaria: puede eliminar el volumen que contiene los datos persistidos.

## Verificación del funcionamiento

Después de iniciar los servicios, comprueba lo siguiente.

### 1. PostgreSQL

```powershell
docker ps
docker exec checku-db-local pg_isready -U checku -d checku_local
```

Se espera que PostgreSQL acepte conexiones.

### 2. Backend

El backend debe terminar de arrancar sin errores y mostrar un mensaje de conexión exitosa a PostgreSQL cuando la base esté configurada.

Consulta el endpoint de salud:

```text
http://localhost:3000/api/health
```

Este endpoint permite comprobar que la API responde. Su respuesta no necesariamente verifica por sí sola todas las tablas o dependencias de la aplicación.

### 3. Frontend

Abre:

```text
http://localhost:3001
```

Comprueba que la aplicación cargue correctamente y que el navegador no muestre errores de conexión con la API.

### 4. Autenticación

Verifica el inicio de sesión, la consulta de la sesión actual y el cierre de sesión mediante los endpoints disponibles.

Utiliza únicamente cuentas de prueba autorizadas y configuradas para el entorno local.

### 5. Base de datos

Consulta las tablas creadas:

```powershell
docker exec checku-db-local psql -U checku -d checku_local -c "\dt"
```

Confirma que existan las tablas previstas en `01-schema.sql` y que los datos base de `02-userbase.sql` se hayan insertado correctamente.

## Endpoints principales

El backend tiene configurado el prefijo global `/api`.

| Método | Endpoint | Propósito |
|---|---|---|
| `GET` | `/api/health` | Consultar el endpoint de salud de la API. |
| `POST` | `/api/auth/login` | Iniciar sesión. |
| `GET` | `/api/auth/me` | Consultar la sesión del usuario actual. |
| `POST` | `/api/auth/logout` | Cerrar sesión. |

Para el desarrollo local, la API está prevista en `http://localhost:3000` y el frontend en `http://localhost:3001`.

Las rutas y su comportamiento efectivo deben verificarse en los controladores y servicios de la versión desplegada.

## Requisitos documentales

### Documentos para pregrado

El estudiante debe presentar cinco documentos:

1. **Documento de identidad**
   - Cédula de ciudadanía o documento de identidad compatible con los validadores implementados.
   - Permite extraer y comparar los datos de identificación.

2. **Evaluación de Grado expedida por Banner**
   - Contiene información académica del estudiante.
   - Se utiliza para revisar los requisitos académicos definidos para el proceso de grado.

3. **Paz y Salvo de Biblioteca**
   - Documento expedido por Biblioteca.
   - Se contempla verificar la correspondencia con el estudiante y la autenticidad e integridad de la firma criptográfica cuando esta integración esté disponible.

4. **Comprobante de pago de la estampilla Pro-Cultura**
   - Comprobante correspondiente al pago exigido por la institución.
   - Se contempla validar los datos del pago y los requisitos definidos para la solicitud.

5. **Resultados de las pruebas Saber Pro**
   - Reporte de resultados del estudiante.
   - Se prevé extraer el nombre, identificación, número de registro, fecha de aplicación y puntaje global.
   - El umbral definido para el proyecto es un puntaje global mayor o igual a 100 puntos.

### Documentos para posgrado

El alcance documental definido para posgrado contempla:

1. Documento de identidad.
2. Paz y Salvo de Biblioteca.
3. Comprobante de pago de la estampilla Pro-Cultura.

Dentro de este alcance, las solicitudes de posgrado no requieren la Evaluación de Grado de Banner ni los resultados de Saber Pro.

La selección de documentos debe realizarse de acuerdo con el nivel académico de la solicitud.

## Proceso de prevalidación

El flujo previsto comprende las siguientes actividades:

1. El estudiante diligencia la información de su solicitud de grado.
2. Carga los documentos correspondientes a su nivel académico.
3. El sistema procesa los archivos y extrae información mediante lectura directa u OCR.
4. Se aplican las reglas de validación documental.
5. Se comparan los datos pertinentes entre los documentos de la solicitud.
6. El sistema registra los resultados y las observaciones.
7. El estudiante consulta los resultados y corrige o reenvía los documentos que lo requieran.
8. El personal encargado puede revisar los casos que necesitan intervención manual.

Los estados contemplados para la validación son:

- `valido`: el documento cumple las reglas automáticas aplicables.
- `no_valido`: no cumple uno o varios requisitos definidos.
- `inconsistente`: existen discrepancias entre los datos o documentos.
- `por_revisar`: no hay evidencia suficiente para decidir automáticamente.

Los nombres exactos de los estados en la base de datos y en la API deben mantenerse consistentes con la implementación vigente.

## Motor OCR y validación documental

El motor OCR es el componente encargado de procesar documentos y extraer información útil para las reglas de validación.

### Procesamiento de documentos

Se contempla el uso de:

- OpenCV para preprocesamiento de imágenes.
- Tesseract OCR para reconocimiento de texto.
- PyMuPDF para la lectura y conversión de PDF.
- Poppler como alternativa de procesamiento cuando sea necesario.
- `zxing-cpp` para la lectura de códigos de barras compatibles.
- RapidFuzz para comparar cadenas de texto.

Entre las operaciones de preprocesamiento pueden encontrarse el escalado, la corrección de inclinación y la binarización de imágenes.

### Documento de identidad

Se contempla el procesamiento de formatos de identidad colombianos compatibles con los validadores:

- Cédula digital: lectura de la zona de lectura mecánica y contraste con los datos visibles.
- Cédula amarilla con hologramas: lectura del código PDF417 cuando esté presente, junto con el procesamiento de la información visible.

La compatibilidad efectiva depende del formato, la calidad del archivo y las capacidades de los módulos disponibles.

### Comparación de nombres

Se contempla normalizar mayúsculas, tildes y otros elementos del texto antes de comparar los datos extraídos.

La comparación aproximada mediante RapidFuzz permite medir la similitud entre los nombres detectados y los datos de referencia. El umbral previsto para determinadas comparaciones de identidad es del 85 %.

Un resultado de similitud no demuestra por sí solo la identidad de una persona. Debe interpretarse junto con las demás reglas y fuentes de información autorizadas.

### Consulta de fuentes externas

El proyecto contempla una posible integración con servicios institucionales o fuentes oficiales para contrastar información. La disponibilidad de cada consulta depende de la autorización, autenticación, conectividad y condiciones de uso del servicio correspondiente.

No debe asumirse que todas las consultas externas están operativas en cualquier entorno.

### Casos que requieren revisión

Un documento debe quedar pendiente de revisión cuando:

- No se puedan extraer los datos necesarios.
- La imagen tenga baja resolución o esté incompleta.
- El archivo esté dañado o use un formato no compatible.
- Existan datos ambiguos o discrepancias entre documentos.
- Una consulta externa necesaria no esté disponible.
- No se pueda comprobar una condición exigida con suficiente confianza.

El sistema no debe inventar información faltante ni aprobar automáticamente un caso cuando no dispone de evidencia suficiente.

### Ejecución y puesta en marcha del motor OCR

El motor de extracción y validación documental se expone como un microservicio HTTP desarrollado en Flask sobre Python 3.11+, el cual es consumido por el backend de NestJS mediante el endpoint `/analizar`.

#### 1. Requisitos previos
- **Python 3.11 o superior** instalado y configurado en el `PATH`.
- **Tesseract OCR** con el paquete de idioma en español (`spa.traineddata`).
  - Instalación en Windows mediante `winget`:
    ```powershell
    winget install -e --id UB-Mannheim.TesseractOCR
    ```
  - Comprueba que la carpeta de instalación (por ejemplo, `C:\Program Files\Tesseract-OCR`) esté agregada a la variable `PATH` del sistema.

#### 2. Entorno virtual e instalación de dependencias
Desde la raíz del repositorio (`check_u/`):

```powershell
# Crear el entorno virtual si aún no existe
python -m venv venv

# Activar el entorno virtual (PowerShell)
.\venv\Scripts\Activate.ps1

# Instalar las dependencias de procesamiento documental
pip install flask pytesseract opencv-python pillow pymupdf zxing-cpp rapidfuzz requests
```

#### 3. Iniciar el servicio HTTP del motor
Ejecuta desde la raíz del proyecto con el entorno virtual activo:

```powershell
python -m modules.api.app
```
*(Alternativamente: `flask --app modules.api.app run --port 5001`)*

El servicio quedará disponible en `http://127.0.0.1:5001` con los endpoints:
- `GET /salud`: Verifica el estado operativo y lista los validadores soportados.
- `POST /analizar`: Recibe los archivos (`multipart/form-data`) y datos del estudiante para la ejecución de las reglas de validación documental.

#### 4. Integración con el Backend
El backend de NestJS se conecta a este servicio a través de la variable de entorno `MOTOR_URL` en `backend/.env`:

```env
MOTOR_URL=http://127.0.0.1:5001
```
Si el motor no está en ejecución al procesar una solicitud de análisis, el backend responderá con error `503 Service Unavailable`.

## Frontend

El frontend está desarrollado con Next.js, React y TypeScript.

Contempla interfaces diferenciadas por rol.

### Portal del estudiante

- Consulta de requisitos documentales.
- Presentación y seguimiento de la solicitud.
- Visualización de estados y observaciones.
- Corrección y reenvío de documentos que lo requieran.

### Panel administrativo

- Consulta de solicitudes.
- Filtrado por estado.
- Visualización de detalles y observaciones.
- Estadísticas y gráficos cuando estén implementados.
- Herramientas de revisión y seguimiento de expedientes.

### Experiencia de usuario

La interfaz contempla componentes reutilizables, navegación contextual y comunicación con el backend mediante solicitudes HTTP.

La sesión del usuario debe gestionarse respetando las configuraciones de cookies, credenciales y políticas CORS del backend.

## Backend

El backend utiliza NestJS y TypeScript para exponer la API y organizar los servicios del sistema.

### Autenticación y sesiones

Los endpoints principales permiten iniciar sesión, consultar la sesión actual y cerrarla.

La configuración contempla cookies de sesión, incluida la cookie `checku.sid`, con opciones de seguridad que deben ajustarse al entorno.

La cookie `httpOnly` dificulta que JavaScript acceda directamente a ella, pero no elimina todos los riesgos de seguridad de una aplicación web.

### Arquitectura modular

La estructura modular de NestJS permite organizar controladores, servicios y módulos por responsabilidad.

Se prevé que funcionalidades como solicitudes, documentos, notificaciones y validaciones puedan integrarse mediante módulos independientes.

### Base de datos

El servicio de base de datos utiliza PostgreSQL a través del paquete `pg`.

En la configuración local actual, el backend verifica la conexión ejecutando una consulta de prueba al inicializarse.

**La conexión exitosa no implica que toda la persistencia de la aplicación esté implementada.** La autenticación, las solicitudes y los demás datos deben comprobarse individualmente para determinar si ya utilizan PostgreSQL o si siguen utilizando almacenamiento temporal.

### Health check y CORS

La API dispone de un endpoint de salud y una configuración CORS que permite los orígenes definidos para el entorno.

Si cambia el puerto o dominio del frontend, debe actualizarse la configuración CORS de acuerdo con el entorno correspondiente.

## Seguridad y protección de datos

CheckU procesa información personal y documentos que pueden contener datos sensibles o confidenciales. Por ello, se deben aplicar controles adecuados durante el desarrollo, las pruebas y el despliegue.

- No subir archivos `.env`, contraseñas, tokens ni claves privadas al repositorio.
- Mantener los respaldos locales dentro de una carpeta excluida por `.gitignore`.
- Utilizar cuentas y documentos de prueba autorizados.
- Anonimizar documentos cuando sea posible y contar con las autorizaciones requeridas antes de realizar pruebas con documentos reales.
- Restringir el acceso a expedientes y documentos según el rol del usuario.
- Evitar registrar en logs números de identificación, documentos completos, contraseñas o secretos.
- Utilizar HTTPS en entornos desplegados.
- Revisar las opciones `Secure`, `HttpOnly` y `SameSite` de las cookies de sesión.
- Aplicar las medidas de protección frente a CSRF que correspondan a la estrategia de autenticación.
- No confiar exclusivamente en las validaciones del frontend; las reglas de acceso deben comprobarse en el backend.
- Proteger los endpoints que permiten consultar, modificar o descargar documentos.
- Gestionar las credenciales y permisos de servicios externos de forma segura.

La integración con fuentes institucionales, como sistemas académicos o de Biblioteca, debe respetar las autorizaciones, las condiciones de uso y las políticas de tratamiento de datos de la institución.

## Solución de problemas

### Docker no está iniciado

Comprueba que Docker Desktop esté abierto y ejecuta:

```powershell
docker info
```

### El contenedor PostgreSQL no está saludable

Consulta los registros:

```powershell
docker logs checku-db-local
```

Comprueba también que el puerto local no esté ocupado por otro servicio.

### El backend no encuentra las variables de entorno

Verifica que exista `backend/.env` y que las variables necesarias estén definidas.

Comprueba especialmente `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`.

Si una variable aparece como `undefined`, revisa el nombre exacto, la codificación del archivo y la lógica de carga de variables de entorno.

### No se puede conectar a PostgreSQL

Comprueba que el contenedor esté activo:

```powershell
docker ps
```

Verifica la disponibilidad de PostgreSQL:

```powershell
docker exec checku-db-local pg_isready -U checku -d checku_local
```

Confirma que las credenciales del backend coincidan con las configuradas para el contenedor local.

### La reconstrucción SQL falla

Revisa:

- Que existan `db/init/01-schema.sql` y `db/init/02-userbase.sql`.
- Que ambos archivos sean compatibles con una base recién creada.
- Que el usuario de PostgreSQL tenga permisos suficientes.
- Que no haya errores de sintaxis o dependencias entre tablas.
- Que el orden de ejecución sea correcto.

Si la importación falla después de eliminar la base anterior, el respaldo puede utilizarse para recuperar la información previa.

### El frontend no puede comunicarse con el backend

Comprueba que ambos servicios estén ejecutándose y que la URL de la API sea la correcta.

Revisa también la configuración CORS y las solicitudes de red en las herramientas de desarrollo del navegador.

### El login no funciona

Verifica que el endpoint de inicio de sesión esté disponible, que las credenciales correspondan al entorno y que las cookies de sesión se estén enviando correctamente.

No des por hecho que los usuarios base se pueden autenticar hasta confirmar su esquema, sus credenciales y el mecanismo de autenticación implementado.

## Consideraciones y limitaciones

- CheckU es un sistema de prevalidación y no reemplaza la decisión administrativa de la Universidad.
- La extracción por OCR puede producir errores, especialmente en documentos borrosos, inclinados, incompletos o de baja resolución.
- Las reglas automáticas solo pueden verificar condiciones para las que existan datos y mecanismos de comprobación adecuados.
- Una firma criptográfica debe verificarse con los mecanismos y certificados apropiados; la presencia de una imagen de firma no garantiza autenticidad.
- Las consultas a fuentes externas requieren acceso autorizado y pueden fallar por indisponibilidad, cambios de API o restricciones de autenticación.
- Los archivos SQL de inicialización no sustituyen un mecanismo formal de migraciones para actualizar bases de datos persistentes.
- El script `levantar.ps1` está diseñado para desarrollo local y puede eliminar los datos operativos existentes al reconstruir la base.
- Los respaldos locales no sustituyen una estrategia de copias de seguridad externas para datos que deban conservarse.
- La existencia de un endpoint de salud no garantiza por sí sola que todos los componentes funcionen correctamente.
- Las funcionalidades descritas pueden encontrarse en diferentes etapas de desarrollo. Su estado debe verificarse en el código y en las pruebas de la versión utilizada.

---

## Licencia y uso

El uso, distribución y despliegue del proyecto deben ajustarse a la licencia y a las políticas establecidas por sus responsables y por la Universidad Tecnológica de Bolívar.

