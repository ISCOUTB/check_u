# Análisis del repositorio y de brechas (Tarea 01)

**Fecha:** 14/10/2026 · **Commit analizado:** `9fdf946` (`main` de ISCOUTB/check_u) · **Autor:** Héctor Cabarcas · **Issue:** #5

Este documento es solo análisis: **no se modificó código**. Las reglas del proyecto se tomaron de `docs/PROMPT_BASE.md` y del `README.md`. `docs/PROMPT_MAESTRO.md` no existe en ningún repositorio (ver la sección 9).

## 1. Carpetas: activas, legado y experimentos

| Carpeta | Qué es | Estado | Actividad |
|---|---|---|---|
| `backend/` | API en **NestJS 12** (TypeScript, Express). Tiene `/api/health` y el login con sesión en memoria. | **Activa**, recién iniciada | 09-10/10/2026 |
| `frontend/` | Interfaz en **Next.js 16** (React 19). El login está conectado al backend; el dashboard y el detalle tienen datos fijos en el código. | **Activa** | 15/08 a 10/10/2026 |
| `webapp/` | Panel en **Flask** (Python) con su propia interfaz HTML: carga cédulas, aplica OCR, consulta el RUI y compara documentos. Guarda los casos como archivos JSON en disco. | **Legado como interfaz**, pero tiene la única lógica de procesamiento que funciona de punta a punta | 18/09/2026 |
| `modules/cedula/` | Lectura de cédula de ciudadanía, digital (MRZ) y amarilla (OCR + PDF417), con coordenadas. | **Activa**, la usa `webapp/` | 01/10/2026 |
| `modules/mrz/` | Lectura y validación del MRZ. | **Activa**, la usan `cedula/` y `webapp/` | 01/10/2026 |
| `modules/ocr_module/` | Preprocesamiento (lo usa `cedula/`), `OCRPipeline`, `TextStructurer` (extrae `acta_grado` e `icfes`) y `DocumentAgent` (modelo de lenguaje local con Ollama). | **Parcial:** el preprocesamiento está activo; el pipeline, la estructuración y el agente son **experimentos** que nadie importa fuera de sus pruebas | 18/09/2026 |
| `modules/check_id/` | `rui/consultar.py` consulta el RUI del DNP; `orquestador.py` está **vacío**. | **Activa** (RUI, vía `webapp/`) | 18/09/2026 |
| `modules/extract_text_pdf/` | Script suelto para comparar `pypdf` y `pdfplumber`. | **Experimento** | 08/09/2026 |
| `firma_electronica/` | App de **escritorio** (Tkinter + pyHanko) con la que Biblioteca firma el Paz y Salvo; también lo valida. | **Activa**, pero separada de CheckU | 08/10/2026 |
| `ocr_tuner.py` | Herramienta para ajustar el preprocesamiento en vivo. | **Experimento / legado** | 15/06/2026 |
| `iniciar.ps1` | Instala Python, Tesseract y dependencias y abre `webapp/`. | **Legado** (sirve al panel Flask) | 18/09/2026 |
| `Obsidian/` | Bóveda de documentación del panel Flask y de la lectura de cédulas. | **Desactualizada**: describe el estado al 17-18/09, antes de NestJS y Next.js | 18/09/2026 |

**`frontend/` frente a `webapp/`:** `frontend/` es la interfaz nueva y la que el equipo está construyendo. La interfaz HTML de `webapp/` queda como legado. En cambio, la lógica de Python que `webapp/app.py` conecta (`modules/cedula`, `mrz`, `check_id`) es el único motor de lectura y validación que existe y conviene reutilizarlo, no reescribirlo.

## 2. Stack actual

| Pieza | Qué se usa hoy |
|---|---|
| Backend | NestJS 12, Express, TypeScript 6, ESM (`"type": "module"`), Vitest 4, oxlint, supertest. **Sin ORM, sin base de datos y sin validación de esquemas** (no hay class-validator ni zod). |
| Frontend | Next.js 16.3.8, React 19, Chart.js. Tailwind 4 está instalado pero casi no se usa: los estilos van en CSS Modules. |
| Motor (Python 3.11) | Flask, Tesseract (`pytesseract`), OpenCV, PyMuPDF, `pdf2image`, Pillow, `zxing-cpp` (PDF417), `rapidfuzz` (similitud de nombres), `requests` (RUI). Lo instala `iniciar.ps1`; no hay `requirements.txt` para `webapp/` ni `modules/`. |
| Modelo de lenguaje | `DocumentAgent` llama a Ollama (`gemma3:1b`, `localhost:11434`). Es experimental y no se instala con `iniciar.ps1`. |
| Firma | pyHanko + asn1crypto + PyMuPDF + Tkinter (`firma_electronica/requirements.txt`). |
| Base de datos | **Ninguna.** `webapp/` guarda JSON e imágenes en `webapp/data/casos/<id>/`. |
| Cola | **Ninguna.** `webapp/` procesa cada documento en un hilo y avisa el progreso por SSE con un `queue.Queue` en memoria. |
| Autenticación | Solo en `backend/`: 2 usuarios escritos en el código (clave `12345`) y sesiones en un `Map` en memoria, con cookie `checku.sid`. `webapp/` no tiene autenticación. |

## 3. Endpoints actuales

**`backend/`** (prefijo `/api`, puerto 3000):

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/health` | Responde `{status, service, message}`. |
| POST | `/api/auth/login` | Valida contra los 2 usuarios fijos y crea la cookie de sesión (30 min). |
| GET | `/api/auth/me` | Devuelve el usuario de la sesión, o 401. |
| POST | `/api/auth/logout` | Borra la sesión. |

**`webapp/`** (Flask, puerto 5000):
- `GET /`: el panel HTML.
- `GET /api/casos` y `POST /api/casos`: listar y crear casos.
- `GET /api/casos/<id>` y `DELETE /api/casos/<id>`: ver y borrar un caso.
- `POST /api/casos/<id>/documentos`: subir un documento; lanza el procesamiento en un hilo.
- `DELETE /api/casos/<id>/documentos/<doc>` y `GET …/paginas/<n>`: borrar un documento y ver la imagen de una página.
- `GET /api/trabajos/<id>/stream`: el progreso por SSE.
- `GET /api/salud`: chequeo del entorno (Tesseract, etc.).

**`frontend/`** (páginas):
- `/`: login.
- `/connect`: prueba de conexión con el backend.
- `/estudiante/home`.
- `/estudiante/preinscripcion`: **el archivo está vacío**.
- `/funcionario/dashboard`.
- `/funcionario/detalle_preinscripcion/[id]`.

## 4. Modelos de datos actuales

- **`backend/`:** `SafeUser {id, username, name, role}` y `Session {user, expiresAt}`, solo en memoria.
- **`webapp/`:**
  - un caso es `caso.json` con `documentos[]`, `comparaciones[]`, `estado` y `titulo`;
  - cada documento guarda `resultado.json` con `tipo`, `formato`, `campos` (valor, caja y página), `mrz`, `rui`, `validacion {estado, …}`, `avisos` y `errores`.
- **`frontend/`:** interfaces de TypeScript con datos fijos (`Solicitud`, `Documento`, `DocumentAnalysisData`). No consume ningún modelo del backend salvo el usuario.
- **Diseño del equipo (no implementado):** el modelo de 7 tablas de Javier (usuarios, solicitud_grado, documentos, rutas, validaciones, historial_validaciones, revisiones). Está en la issue #15 del repositorio anterior (LisoProgrammer/check_u).

## 5. Flujo actual de procesamiento (solo existe en `webapp/`, para cédula)

1. Se sube un archivo a un caso y se lanza un hilo (`procesar_documento`).
2. `cargar_paginas` convierte el PDF o la imagen en páginas (PyMuPDF, con `pdf2image` de respaldo).
3. `modules.cedula.leer_cedula`:
   - preprocesa cada página (escalado, limpieza e inclinación, con `ocr_module.preprocess`);
   - aplica OCR con coordenadas;
   - **detecta el formato**: si hay MRZ es la cédula digital; si no, la amarilla;
   - extrae los campos del formato que corresponda (MRZ o PDF417, más OCR).
4. `validar_contra_rui` consulta el RUI con el número leído y compara el nombre con 85 % de similitud mínima. Devuelve `valida`, `inconsistente` o `por_revisar`.
5. `comparar_documentos` cruza los campos entre los documentos del caso (está escrito para N documentos).
6. `estado_del_caso` toma el peor estado de los documentos y de las comparaciones.
7. Se guardan `resultado.json` y `caso.json` y se avisa a la interfaz por SSE.

## 6. Validadores que existen en `modules/`

| Documento (nombre en `PROMPT_BASE`) | Qué existe |
|---|---|
| `identification` | **Parcial.** Cédula de ciudadanía digital (MRZ, 3/3 muestras) y amarilla (OCR + PDF417; número correcto en 7/11 muestras de baja resolución, según `Obsidian/Pruebas`), más la validación contra el RUI. No soporta cédula de extranjería. |
| `academic_evaluation` | **Falta.** Solo datos fijos en `frontend/`. |
| `paz_y_salvo_bib` | **Parcial y fuera de CheckU.** `firma_electronica/infra/sign_validator.py` verifica la firma con pyHanko, pero solo dentro de la app de escritorio; CheckU no lo llama. No hay extracción de datos del Paz y Salvo. |
| `estampilla_pro_cultura` | **Falta.** |
| `saber_pro` | **Parcial y experimental.** `ocr_module/postprocess/structure.py` intenta extraer `puntaje_global` (tipo `icfes`), pero nadie lo usa. **La regla del puntaje ≥ 100 no está implementada**: solo aparece como texto fijo en `frontend/`. |

## 7. Estado por componente

| Componente | Estado | Detalle |
|---|---|---|
| API de solicitudes | **Falta** | `backend/` no tiene endpoints de solicitudes. `webapp/` tiene `/api/casos`, pero es un prototipo en Flask, sin usuarios ni autenticación. |
| Gestión documental | **Parcial** | `webapp/` guarda los archivos en disco por caso y permite reemplazarlos, sin metadatos formales (hash, tamaño, tipo MIME validado). |
| Versiones de documento | **Falta** | Reemplazar un documento borra el anterior. |
| Cola de procesamiento | **Falta** | Solo hilos en memoria: un reinicio pierde el trabajo y no hay reintentos. |
| Orquestador | **Parcial** | `modules/cedula/lectura.py` orquesta la cédula; `OCRPipeline` existe pero no se usa; `check_id/orquestador.py` está vacío. No hay un registro de pipelines por tipo de documento. |
| OCR | **Existe** (para cédula) | Tesseract con preprocesamiento propio; la precisión depende de la resolución de las muestras. |
| Validadores por tipo | **Parcial** | Solo `identification` (sección 6). |
| Validación cruzada | **Parcial** | `comparar_documentos` en `webapp/`: compara campos entre N documentos, pero hoy solo hay cédulas. |
| Consolidador | **Parcial** | `estado_del_caso` toma el peor estado; no hay máquina de estados ni transiciones controladas. |
| Persistencia e historial | **Falta** | Solo JSON en disco que se sobrescribe; no hay base de datos ni historial. |
| Reenvíos y límite diario | **Falta** | — |
| Notificaciones y estados | **Parcial** | Progreso por SSE en `webapp/`. Los estados no coinciden entre módulos (sección 8). |

## 8. Discrepancias entre el código y las reglas del proyecto

1. **Estados de solicitud:** hay tres juegos distintos y ninguno es el de la Tarea 02.

   | Dónde | Estados |
   |---|---|
   | `webapp/` | `valida`, `inconsistente`, `por_revisar` |
   | `frontend/` (dashboard) | `valida`, `no-valida`, `inconsistente`, `por-revisar` |
   | Tarea 02 (solicitud) | `queued`, `processing`, `awaiting_review`, `correction_required`, `ready_for_formal_submission`, `closed` |

2. **Clasificación de documento:**
   - `PROMPT_BASE` usa `valid`, `invalid`, `inconsistent` y `to_check`;
   - `frontend/` muestra "Válido", "No válido", "Inconsistente" y "Por revisar";
   - `webapp/` mezcla en un mismo campo `estado` la clasificación y el resultado del RUI.
3. **Resultado de regla:** `cumple`, `no_cumple` y `no_evaluable` no existen en el código. `webapp/` usa `por_revisar` tanto para "no se pudo leer" como para "el RUI no respondió", que es justo la mezcla que `PROMPT_BASE` prohíbe.
4. **Nombres de tipos documentales:**
   - `PROMPT_BASE`: `identification`, `academic_evaluation`, `paz_y_salvo_bib`, `estampilla_pro_cultura`, `saber_pro`;
   - `frontend/`: `cedula`, `banner`, `estampilla`, `biblioteca`, `saber-pro`;
   - `webapp/`: `cedula`;
   - `structure.py`: `acta_grado`, `icfes`.
5. **"El OCR solo extrae; las reglas viven en validadores separados":** en `webapp/app.py` la validación contra el RUI y el cálculo del estado están mezclados con el flujo de lectura.
6. **Cédula de extranjería:** no está soportada.
   - `rui/consultar.py` envía siempre el tipo de documento `"3"` (supuesto: cédula de ciudadanía; no se verificó contra el DNP).
   - `cedula/digital.py` solo marca como aviso que el MRZ "puede ser de un extranjero".
7. **Saber Pro ≥ 100:** no está implementado (sección 6).
8. **Firma criptográfica del Paz y Salvo:** la firma y su verificación existen, pero en la app de escritorio. CheckU no verifica nada todavía.
9. **Roles:**
   - `backend/` tiene `estudiante` y `funcionario`, escritos en el código y con la misma clave;
   - no hay rol de Biblioteca, que hoy usa la app de escritorio;
   - `webapp/` no tiene usuarios;
   - `frontend/` revisa la sesión solo en el navegador, y la API no protege rutas por rol porque aún no hay rutas que proteger.
10. **`id_student` (texto):** no existe el concepto de estudiante; `backend/` usa un `id` numérico de usuario.
11. **Zona horaria America/Bogota:** `webapp/` usa `datetime.now()` sin zona horaria y `backend/` no maneja fechas.
12. **Fuentes externas:** el RUI **sí** está integrado, con llamadas reales a `ventanillasocial.dnp.gov.co`. No es una API documentada para terceros, así que puede cambiar o bloquearse. Banner no está integrado y debe tratarse como "pendiente / no evaluable", sin simularlo.
13. **"Una sola aplicación, sin microservicios":** hoy hay **cuatro aplicaciones**: `backend/` (NestJS), `frontend/` (Next.js), `webapp/` (Flask, que tiene el motor) y `firma_electronica/` (escritorio). Hay que decidir cómo se cumple esta regla (decisión D1).

## 9. Problemas técnicos encontrados (verificados al ejecutar)

| # | Problema | Cómo se verificó |
|---|---|---|
| P1 | **`npm ci` falla en `backend/`**: `package-lock.json` no coincide con `package.json` (falta `typescript@5.9.3`). Un `npm install` normal lo corrige: el lockfile cambia en 16 líneas agregadas y 54 quitadas. | Se ejecutó `npm ci` (falla) y luego `npm install`; después se devolvió el lockfile a su estado original. |
| P2 | **3 de las 4 pruebas del backend fallan**: son pruebas de la plantilla de NestJS que no se actualizaron (esperan "Hello World!" y una ruta `/` que ya no existe), y `AuthController` no se puede crear en la prueba sin `AuthService`. | `npm test`: 2 de 3 fallan; `npm run test:e2e`: 1 de 1 falla (404). |
| P3 | **Lint del backend: 1 error** (`no-floating-promises` en `src/main.ts`). | `npm run lint`. |
| P4 | **El build de producción del frontend falla**: `app/estudiante/preinscripcion/page.tsx` está vacío y Next no lo acepta como página. | `npm run build`: "Failed to type check". El lint del frontend da 0 errores y 7 advertencias. |
| P5 | **Choque de puertos sin documentar**: el backend escucha en 3000 y solo acepta CORS desde `localhost:3001`, pero `npm run dev` del frontend también usa el 3000. No hay `.env.example` que diga que el frontend necesita `NEXT_PUBLIC_API_URL`. | Lectura de `backend/src/main.ts`, `frontend/package.json` y los README. |
| P6 | Los README de `backend/` y `frontend/` siguen siendo las plantillas de NestJS y de create-next-app. | Lectura. |
| P7 | `AppModule` registra `ObserveModule` con claves de relleno (`YOUR_APP_KEY`). | Lectura (no se probó contra el servicio). |
| P8 | `frontend/app/layout.tsx` declara `lang="en"` en una aplicación en español. | Lectura. |
| P9 | `docs/PROMPT_MAESTRO.md` no existe; las issues lo citan. Este PR agrega `docs/PROMPT_BASE.md`, copiado tal cual del repositorio de prompts. | Búsqueda en todas las ramas de ISCOUTB/check_u y en LisoProgrammer/CHECK_U_PROMPTS. |

Positivo: el backend **compila** (`npm run build`), todo el Python **compila** (`compileall`) y no hay certificados ni llaves en el repositorio (el `.gitignore` excluye `*.crt` y `*.key`).

## 10. Decisiones que debes tomar

> **Decidida el 14/10/2026: D1 = A.** NestJS es la aplicación y el motor de Python (`modules/`) corre como proceso trabajador del mismo despliegue, no como servicio aparte. Las demás siguen abiertas.

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | **Cómo se cumple "una sola aplicación"**: el backend está en TypeScript y el motor en Python. | **A.** NestJS como aplicación principal; el motor de Python como **librería** que el mismo despliegue ejecuta como proceso trabajador o proceso hijo (no como servicio HTTP aparte). **B.** Rehacer el backend en Python (FastAPI) para importar `modules/` directamente y dejar NestJS. **C.** NestJS más un servicio HTTP de Python, que contradice la regla. | **A**: conserva el trabajo de NestJS y de `modules/`, y la regla se cumple si el motor no se despliega como servicio independiente. Conviene confirmarlo con Lisandro, que escribió la regla. |
| D2 | Base de datos y ORM | PostgreSQL; el ORM depende de D1 (TypeORM o Prisma con A; SQLAlchemy con Alembic con B). | **PostgreSQL**. |
| D3 | Dónde se guardan los archivos | En disco con su ruta (modelo de Javier) o dentro de la base. | Se decide en la Tarea 03 o 04, con Javier. |
| D4 | Cola de procesamiento | Una tabla de trabajos en PostgreSQL (`SKIP LOCKED`), BullMQ con Redis, o Celery. | **Tabla en PostgreSQL**: no agrega otro servicio, cumple la regla y deja auditable cada intento. |
| D5 | Mecanismo de esquemas (Tarea 02) | Depende de D1: class-validator o zod con A; Pydantic con B. Si el motor queda en Python (A), también le sirve Pydantic. | Se decide con D1. |
| D6 | `webapp/` (Flask) | Retirar su interfaz, conservar su lógica como motor y retirar `iniciar.ps1` cuando exista el nuevo flujo. | Retirarla de forma gradual. |
| D7 | Estados y nombres | Adoptar los de `PROMPT_BASE` y la Tarea 02 en todo el código y mapear la interfaz a etiquetas en español. | Sí. |
| D8 | Cédula de extranjería | Incluirla en `identification`: no tiene MRZ colombiano y el RUI necesita otro tipo de documento. | Incluirla, marcando "no evaluable" cuando no se pueda leer o consultar. |

## 11. Plan por etapas

| Etapa | Contenido | Tareas |
|---|---|---|
| 0. Saneamiento | Regenerar el lockfile del backend (P1); actualizar o reemplazar las pruebas de plantilla (P2); arreglar el lint (P3); página mínima de preinscripción para que compile el frontend (P4); puertos y `.env.example` (P5); README reales (P6). | Fuera de las tareas numeradas; se propone como PR corto. |
| 1. Fundamentos | Contratos y enums; modelo de datos, migraciones y repositorios. | 02, 03 |
| 2. Documentos y entrega | Gestión documental con versiones; API de solicitudes y entrega inicial. | 04, 05 |
| 3. Procesamiento | Cola y trabajadores; orquestador con registro de pipelines. Aquí se extrae el motor de `webapp/` como librería. | 06, 07 |
| 4. Validadores | `identification`, `academic_evaluation`, `paz_y_salvo_bib` (integrando `sign_validator`), `estampilla_pro_cultura` y `saber_pro`. | 08a-08e |
| 5. Consolidación | Validación cruzada; consolidador y máquina de estados. | 09, 10 |
| 6. Reenvíos | Gestor de reenvíos y límite diario por estudiante y fecha local. | 11 |
| 7. Consulta | API de resultados y conexión del frontend (reemplazar los datos fijos). | 12 |
| 8. Seguridad | Roles, protección de rutas en el servidor y auditoría. | 13 |
| 9. Pruebas | Flujo completo y criterios de aceptación. | 14 |

**Riesgos:**
- **Calidad del OCR:** las muestras de cédula amarilla son de baja resolución (277-472 px); con escaneos reales la precisión puede cambiar en cualquier dirección.
- **RUI:** es un servicio externo sin acuerdo formal; si cambia o limita las consultas, `identification` queda en "no evaluable".
- **Privacidad:** documentos de identidad reales. Nunca deben subirse al repositorio ni usarse en datos de ejemplo.
- **Dos lenguajes (D1):** si no se define pronto cómo se comunican TypeScript y Python, las tareas 06 a 10 se bloquean.
- **Instalación en Windows:** Tesseract y sus paquetes de idioma son un requisito para todos los que procesen documentos.

## 12. Qué se verificó y qué no

| Verificado ejecutando | Solo leído (no ejecutado) | Pendiente |
|---|---|---|
| `npm ci` del backend falla (P1); `npm install` lo resuelve, y se restauró el lockfile | Endpoints, modelos y flujo de `webapp/` | Correr `webapp/` con documentos (requiere Tesseract y muestras; no se usaron cédulas reales) |
| Backend: build correcto, pruebas 1 de 4, lint con 1 error | Validadores y experimentos de `modules/` | Pruebas de `modules/` (`test_precision.py` usa muestras reales que no están en el repo; `test_agent.py` requiere Ollama) |
| Frontend: build de producción falla (P4); lint con 0 errores y 7 advertencias | `firma_electronica/` (estructura, dependencias y `sign_validator`) | Probar la firma y su verificación |
| Todo el Python compila (`compileall`) | Que `pTipDoc "3"` del RUI sea cédula de ciudadanía | Confirmarlo contra el DNP |
| No hay llaves ni certificados en git | — | `docs/PROMPT_MAESTRO.md` (no existe) |

Tras el análisis, `git status` quedó limpio: no se modificó ningún archivo versionado (las dependencias instaladas y la caché de Python están en `.gitignore`).
