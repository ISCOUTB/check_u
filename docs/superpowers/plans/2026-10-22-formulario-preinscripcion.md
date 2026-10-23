# Formulario de preinscripción: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** la página `/estudiante/iniciar_preinscripcion?nivel=…` con índice lateral de progreso, secciones por nivel, carga de PDF, guardar borrador y enviar, todo con datos simulados.

**Architecture:**
- La lógica pura (lista de documentos, validación, progreso y API simulada) va en módulos sin React, probados en Node con Playwright.
- La página es un componente de servidor que lee `searchParams` y monta el formulario cliente.
- Las secciones, el índice, la barra de acciones y la zona de documentos son componentes de la carpeta de la página.
- `Field` se amplía con `opciones` y se crea `Opciones` en `app/components/ui`.

**Tech Stack:** Next.js 16 (App Router, CSS Modules), React 19, Playwright 1.64 + @axe-core/playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-formulario-preinscripcion-design.md`

## Global Constraints

- Comandos desde `frontend/`. Pruebas: `npx playwright test <archivo>`; el servidor de desarrollo lo levanta `playwright.config.ts`.
- Antes de escribir código de Next, leer la guía pertinente en `node_modules/next/dist/docs/` (`frontend/AGENTS.md`). `searchParams` es una promesa en el `page.tsx` de servidor.
- Solo variables de `globals.css`: nada de `#hex` ni `rgb()` en los CSS (lo revisa `e2e/colores.spec.ts`). Sin dependencias nuevas, sin Tailwind.
- Movimiento: `var(--ease-out)`, `var(--duracion)` y `var(--duracion-rapida)`.
  - Los campos que aparecen entran en 180 ms (opacidad y 4 px) con `@starting-style`.
  - Nada se anima por el teclado.
  - Con `prefers-reduced-motion`, solo opacidad.
- Accesibilidad:
  - `<label>` en todo;
  - errores con `aria-describedby` y `aria-invalid`;
  - "(obligatorio)" en el texto de la etiqueta;
  - `<fieldset>` y `<legend>` por sección;
  - objetivos de 44 px o más;
  - foco visible y no tapado (`scroll-padding` arriba y abajo);
  - celular en 768 y 480 px.
- Datos personales: nunca en `localStorage`, `sessionStorage`, la URL ni la consola. El borrador vive en memoria y no sobrevive a recargar la página, y la pantalla lo dice.
- Textos tuteando, como en `PRODUCT.md`. Fechas con `Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota" })`. `<input type="date">` se trata como texto `aaaa-mm-dd`, sin convertir desde UTC.
- Claves de documentos del contrato: `identification`, `academic_evaluation`, `paz_y_salvo_bib`, `estampilla_pro_cultura` y `saber_pro`.
- No tocar el backend, el panel del funcionario, `estudiante/preinscripcion` ni la lógica de `home`. En `home/api.ts` solo cambia de dónde sale `DOCUMENTOS_POR_NIVEL`.

## Review Focus

1. **Pegar un número de documento con puntos** ("1.043.640.743"): quedan solo los dígitos y se avisa una vez (Task 4: `pegar con puntos deja solo dígitos`).
2. **Quitar el segundo programa con su estampilla ya cargada:** el segundo comprobante deja de exigirse y de contarse (Task 3: `progreso sin segundo programa no cuenta la segunda estampilla`).
3. **Hacer doble clic en "Enviar":** se manda un solo envío con una sola clave de idempotencia (Task 5: `doble clic envía una vez`).
4. **Fecha de nacimiento en el borde del día** (por ejemplo, `2000-01-01` con la zona de Bogotá): se guarda igual que se escribió (Task 3: `la fecha se guarda tal cual`).
5. **Un archivo `.pdf` que en realidad es una imagen** (tipo `image/png`): se rechaza por su tipo (Task 3: `rechaza un png con extensión pdf`).

---

### Task 1: Lista única de documentos requeridos

**Files:**
- Create: `frontend/app/estudiante/documentos-requeridos.ts`
- Modify: `frontend/app/estudiante/home/api.ts`: `DOCUMENTOS_POR_NIVEL` sale de la lista nueva, con las mismas etiquetas de hoy
- Test: `frontend/e2e/documentos_requeridos.spec.ts` (Node, sin navegador)

**Interfaces:**
- Produces:
  - `Nivel = "PREGRADO" | "POSGRADO"`;
  - `TipoDocumento = "identification" | "academic_evaluation" | "paz_y_salvo_bib" | "estampilla_pro_cultura" | "saber_pro"`;
  - `DocumentoRequerido { tipo: TipoDocumento; etiqueta: string; retirando?: true; unoPorPrograma?: true }`;
  - `DOCUMENTOS_REQUERIDOS: Record<Nivel, readonly DocumentoRequerido[]>`;
  - `DocumentoDelFormulario { id: string; tipo: TipoDocumento; etiqueta: string }`;
  - `documentosRequeridos(nivel: Nivel, segundoPrograma: boolean): DocumentoDelFormulario[]`.
- Ids y etiquetas:
  - los ids son `tipo`, y `estampilla_pro_cultura-2` para el segundo comprobante;
  - las etiquetas son "Cédula de ciudadanía", "Evaluación de Grado (Banner)", "Paz y Salvo de Biblioteca", "Estampilla Pro-Cultura", "Resultados Saber Pro" y "Estampilla Pro-Cultura (segundo programa)";
  - en posgrado la primera etiqueta es "Documento de identidad".

- [ ] **Step 1: Write the failing tests:**
  - `pregrado pide 5 documentos en orden` (las 5 claves en el orden de la issue);
  - `posgrado pide 3`;
  - `segundo programa en pregrado agrega la segunda estampilla al final, con id estampilla_pro_cultura-2`;
  - `segundo programa en posgrado no agrega comprobante`;
  - `el paz y salvo lleva la marca retirando`;
  - `DOCUMENTOS_POR_NIVEL de home conserva sus etiquetas`: la lista de hoy, tal cual.
- [ ] **Step 2:** `npx playwright test e2e/documentos_requeridos.spec.ts`. Expected: FAIL (no existe el módulo).
- [ ] **Step 3:** Implementar. `home/api.ts` importa la lista y deriva `DOCUMENTOS_POR_NIVEL` (pregrado conserva "Cédula de ciudadanía").
- [ ] **Step 4:** Repetir, más `npx playwright test e2e/inicio.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 25: lista única de documentos requeridos".

### Task 2: Tipos, constantes y API simulada

**Files:**
- Create: `frontend/app/estudiante/iniciar_preinscripcion/tipos.ts`, `constantes.ts` y `api.ts`
- Modify: `frontend/.env.example`: `# NEXT_PUBLIC_TAMANO_MAXIMO_PDF_MB=` comentada, con su explicación
- Test: `frontend/e2e/preinscripcion_api.spec.ts` (Node)

**Interfaces:**
- Produces (`tipos.ts`):
  - `Modalidad = "VIRTUAL" | "PRESENCIAL"`;
  - `PerfilEstudiante`, `ProgramaSolicitud { orden: 1 | 2; programa; modalidad: Modalidad | ""; tipoOpcionGrado }`, `InformacionPregrado`, `InformacionPosgrado` y `ExperienciaLaboral { orden: 1 | 2; empresa; cargo; tiempo }` (los campos de la sección 6 del spec, con string vacío como "sin llenar" y booleanos como `boolean | null`);
  - `DocumentoCargado { id: string; nombre: string; tamano: number }` (sin el contenido);
  - `BorradorPreinscripcion { nivel; nombres; apellidos; correo; codigoEstudiantil; perfil; segundoPrograma: boolean | null; programas: ProgramaSolicitud[]; pregrado; posgrado; experiencia: ExperienciaLaboral[]; documentos: Record<string, DocumentoCargado>; guardadoEn: string | null }`;
  - `borradorVacio(nivel: Nivel, correo: string): BorradorPreinscripcion`.
- Produces (`constantes.ts`, cada lista con `// TODO: sin confirmar con el formulario real`):
  - `TIPOS_DOCUMENTO`, `GENEROS`, `OPCIONES_GRADO`, `TIPOS_CONTRATO` y `NIVELES_ESTUDIO`, como `readonly { valor: string; etiqueta: string }[]`;
  - `MODALIDADES` (Virtual o Presencial).
- Produces (`api.ts`):
  - `Escenario = "ninguno" | "borrador" | "rechazo" | "enviada"`;
  - `escenarioDesde(valor: string | undefined): Escenario`: en `production` siempre `"ninguno"`;
  - `cargarPreinscripcion(nivel, correo, escenario): Promise<{ estado: "sin_borrador" | "borrador" | "enviada"; borrador: BorradorPreinscripcion }>`;
  - `guardarBorrador(borrador): Promise<{ guardadoEn: string }>`;
  - `enviarPreinscripcion(borrador, claveIdempotencia, escenario): Promise<{ ok: true } | { ok: false; motivos: string[] }>`;
  - `tamanoMaximoPdfBytes(valor = process.env.NEXT_PUBLIC_TAMANO_MAXIMO_PDF_MB): number | null`;
  - `formatearGuardado(iso: string): string` ("22/10/2026, 3:40 p. m.", con `es-CO` y America/Bogota).
  - Cada función simulada lleva `// TODO: endpoint pendiente (…)`.

- [ ] **Step 1: Write the failing tests:**
  - `escenarioDesde` reconoce "borrador", "rechazo" y "enviada", y devuelve "ninguno" para cualquier otro valor;
  - `cargarPreinscripcion`:
    - con "ninguno" da `sin_borrador` y un borrador vacío con el correo;
    - con "borrador" da un borrador parcial con datos inventados ("Ana", "Prueba"…);
    - con "enviada" da `enviada`;
  - `guardarBorrador` devuelve una fecha ISO;
  - `enviarPreinscripcion` con "rechazo" da `ok: false` y al menos un motivo; con "ninguno", `ok: true`;
  - `tamanoMaximoPdfBytes`: "5" da 5242880, y `undefined`, "" o "abc" dan `null`;
  - `formatearGuardado("2026-10-22T20:40:00Z")` contiene "22/10/2026" y "3:40".
- [ ] **Step 2:** `npx playwright test e2e/preinscripcion_api.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implementar. La simulación espera 300 ms para que se vean los estados "Guardando…" y "Enviando…".
- [ ] **Step 4:** Repetir. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 25: tipos, constantes y API simulada".

### Task 3: Validación y progreso

**Files:**
- Create: `frontend/app/estudiante/iniciar_preinscripcion/validacion.ts`
- Test: `frontend/e2e/preinscripcion_validacion.spec.ts` (Node)

**Interfaces:**
- Consumes: `documentosRequeridos` (Task 1) y `BorradorPreinscripcion` (Task 2).
- Produces:
  - `SeccionId = "identificacion" | "contacto" | "academico" | "saber_pro" | "estudios" | "documentos"`;
  - `SECCIONES: Record<SeccionId, string>`: los títulos "Identificación", "Contacto y residencia", "Información académica", "Saber Pro y vinculación con la UTB", "Estudios y experiencia" y "Documentos";
  - `seccionesDelNivel(nivel): SeccionId[]`: pregrado sin "estudios" y posgrado sin "saber_pro";
  - `CampoFaltante { id: string; seccion: SeccionId; etiqueta: string; mensaje: string }`: `id` es el id del elemento en la página, por ejemplo `campo-nombres`, `campo-programa-2` o `documento-saber_pro`;
  - `faltantes(borrador): CampoFaltante[]`: los obligatorios de la sección 4 del spec; con `segundoPrograma === true`, también los del segundo programa; y los documentos requeridos sin cargar;
  - `progreso(borrador): { secciones: { id: SeccionId; titulo: string; faltan: number }[]; documentos: { cargados: number; requeridos: number }; seccionesPendientes: number; documentosPendientes: number; listo: boolean }`;
  - `limpiarNumeroDocumento(texto: string): string` (solo `[A-Za-z0-9]`);
  - `validarPdf(archivo: { name: string; type: string; size: number }, maximo: number | null): string | null`.
- Mensajes fijos:
  - `"Solo se aceptan archivos PDF."`;
  - `"El archivo está vacío."`;
  - `"El archivo pesa más de {N} MB, el máximo permitido."`;
  - obligatorio: `"Completa este campo."`;
  - documento: `"Carga este documento en PDF."`.

- [ ] **Step 1: Write the failing tests:**
  - borrador vacío de pregrado: los faltantes incluyen nombres, apellidos, tipo y número de documento, código, programa, modalidad y los 5 documentos; el correo no, porque viene de la sesión;
  - con segundo programa: más programa 2 y modalidad 2, y la segunda estampilla en pregrado;
  - `progreso sin segundo programa no cuenta la segunda estampilla` (se marca sí, se carga la segunda estampilla y luego se marca no: requeridos 5, cargados sin contarla);
  - borrador completo: `listo === true`, `seccionesPendientes === 0`;
  - `limpiarNumeroDocumento("1.043 640,743")` da `"1043640743"`, y `"AB-12"` da `"AB12"`;
  - `validarPdf`:
    - `{name:"a.pdf", type:"application/pdf", size:10}` da `null`;
    - `rechaza un png con extensión pdf` (`type:"image/png"`): "Solo se aceptan archivos PDF.";
    - `size:0` da "El archivo está vacío.";
    - `size` mayor que el máximo da el mensaje de MB;
  - `la fecha se guarda tal cual`: `faltantes` no reescribe `perfil.fechaNacimiento` ("2000-01-01" sigue igual).
- [ ] **Step 2:** `npx playwright test e2e/preinscripcion_validacion.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Repetir. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 25: validación y progreso".

### Task 4: Página, campos, secciones e índice

**Files:**
- Modify: `frontend/app/components/ui/Field.tsx` (+ `.module.css`)
  - prop `opciones?: readonly { valor: string; etiqueta: string }[]`: con ella dibuja `<select>`, con una primera opción "Selecciona una opción" (`value=""`);
  - prop `obligatorio?: boolean`: agrega " (obligatorio)" a la etiqueta y `required`.
- Create: `frontend/app/components/ui/Opciones.tsx` (+ `.module.css`): `{ leyenda: string; nombre: string; opciones; valor: string; alCambiar: (valor: string) => void; obligatorio?: boolean; error?: string; id?: string }`, con `<fieldset>`, `<legend>` y radios de 44 px.
- Create, en `frontend/app/estudiante/iniciar_preinscripcion/`:
  - `page.tsx`;
  - `FormularioPreinscripcion.tsx`;
  - `IndiceProgreso.tsx`;
  - `secciones/Identificacion.tsx`, `Contacto.tsx`, `Academico.tsx`, `SaberProVinculacion.tsx` y `EstudiosExperiencia.tsx`;
  - `iniciar_preinscripcion.module.css`.
- Test: `frontend/e2e/iniciar_preinscripcion.spec.ts` (con navegador; esta tarea crea el archivo)

**Interfaces:**
- Consumes: Tasks 1-3, `useSesion("estudiante")`, `Navbar`, `PageHeader`, `Card` y `Field`.
- Produces:
  - `page.tsx` (servidor) exporta `metadata = { title: "Iniciar preinscripción" }` y recibe `searchParams: Promise<…>`; pasa `nivel` (string o undefined) y `escenario` a `<FormularioPreinscripcion>`;
  - las secciones reciben `{ borrador, cambiar: (cambio: (b: BorradorPreinscripcion) => BorradorPreinscripcion) => void, errores: Record<string, string> }`;
  - los ids de los campos siguen la forma `campo-<nombre>`, la de `CampoFaltante.id`;
  - `IndiceProgreso` recibe `{ progreso, secciones: SeccionId[] }`, y cada sección tiene `id={"seccion-" + id}`.
- Redirecciones (con `router.replace`):
  - si el nivel no es válido, o si `usuario.nivel` existe y es distinto, a `/estudiante/bienvenida`;
  - con `estado: "enviada"`, a `/estudiante/preinscripcion`.
- El número de documento filtra al teclear y al pegar (`limpiarNumeroDocumento`). Si quitó caracteres, muestra la ayuda en error: "Solo letras y números, sin puntos ni espacios".

- [ ] **Step 1: Write the failing tests** (con `sesionComo(page, "estudiante")`):
  - `pregrado muestra sus 5 secciones y el índice con "Te faltan"`;
  - `posgrado muestra Estudios y experiencia y no Saber Pro`;
  - `segundo programa: al marcar Sí aparecen programa 2, modalidad 2 y opción de grado 2`;
  - `tipo de contrato solo si es empleado` y `registro y fecha Saber Pro solo si los conoce`;
  - `escribir puntos en el número de documento no los deja y avisa`, y `pegar con puntos deja solo dígitos`;
  - `el índice marca Identificación como Completa al llenar sus obligatorios`;
  - `nivel inválido redirige a /estudiante/bienvenida` (se espera la URL, no la página);
  - `el correo viene de la sesión y es de solo lectura`;
  - `accesible y sin desborde`, con `revisarPagina` en claro y oscuro a 320, 768 y 1280.
- [ ] **Step 2:** `npx playwright test e2e/iniciar_preinscripcion.spec.ts`. Expected: FAIL (la ruta no existe).
- [ ] **Step 3:** Implementar, con el índice:
  - fijo en 768 px o más;
  - en celular, un botón de divulgación (`aria-expanded`) con "Te faltan…";
  - los enlaces llevan a `#seccion-<id>`, y la sección visible se marca con `aria-current="location"` (con `IntersectionObserver`).
  
  Leer antes `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`.
- [ ] **Step 4:** Repetir, más `npx playwright test e2e/login.spec.ts e2e/colores.spec.ts`, porque `Field` cambió. Expected: PASS.
- [ ] **Step 5: Commit** — "Tarea 25: página, campos, secciones e índice".

### Task 5: Documentos, guardar, enviar y salir sin guardar

**Files:**
- Create: `frontend/app/estudiante/iniciar_preinscripcion/ZonaDocumento.tsx`, `secciones/Documentos.tsx`, `BarraAcciones.tsx`, `ResumenErrores.tsx` y `useCambiosSinGuardar.ts`
- Modify: `FormularioPreinscripcion.tsx` (guardar, enviar y diálogos)
- Test: `frontend/e2e/iniciar_preinscripcion.spec.ts` (se amplía)

**Interfaces:**
- Consumes: `validarPdf`, `faltantes`, `guardarBorrador`, `enviarPreinscripcion`, `formatearGuardado`, `tamanoMaximoPdfBytes` y `Dialog`.
- Produces:
  - `ZonaDocumento { documento: DocumentoDelFormulario; cargado?: DocumentoCargado; error?: string; alCargar: (archivo: File) => void; alQuitar: () => void }`, con un `<input type="file" accept="application/pdf,.pdf" id={"documento-" + id}>` real;
  - `useCambiosSinGuardar(sucio: boolean): { salidaPendiente: string | null; confirmarSalida: () => void; cancelarSalida: () => void }`:
    - `beforeunload` cuando está sucio;
    - en fase de captura, intercepta los clics en `a[href^="/"]` fuera del formulario y guarda la ruta en `salidaPendiente`.
- Textos fijos:
  - contador: "{N} de {M} documentos cargados";
  - botones: "Guardar para continuar después" ("Guardando…") y "Enviar preinscripción" ("Enviando…");
  - estado: "Borrador guardado el {fecha}";
  - nota: "Simulación: el borrador no se conserva si recargas la página.";
  - resumen: "Revisa estos campos antes de enviar" y un enlace por faltante;
  - diálogo de envío: "Revisa tu información antes de enviar", con "Volver a editar" y "Enviar";
  - diálogo de salida: "Tienes cambios sin guardar", con "Guardar y salir", "Salir sin guardar" y "Seguir aquí".

- [ ] **Step 1: Write the failing tests:**
  - `archivo que no es PDF se rechaza y no cuenta`;
  - `PDF vacío se rechaza`;
  - `cargar y quitar actualiza el contador`;
  - `segundo programa en pregrado pide la segunda estampilla`;
  - `envío incompleto muestra el resumen, mueve el foco y el enlace lleva al campo`;
  - `borrador parcial se carga (?escenario=borrador) y Guardar muestra la hora`;
  - `envío rechazado muestra los motivos (?escenario=rechazo)`;
  - `envío completo abre el diálogo, envía y navega a /estudiante/preinscripcion`;
  - `doble clic envía una vez`: tras el primer clic en "Enviar" del diálogo, el botón queda deshabilitado de inmediato ("Enviando…") y se navega una sola vez. Sin contadores de prueba en el código;
  - `solicitud ya enviada redirige a /estudiante/preinscripcion` (`?escenario=enviada`);
  - `cambios sin guardar: tocar el logo abre el diálogo y "Seguir aquí" se queda`;
  - `axe con el resumen de errores y con el diálogo abiertos (claro y oscuro)`.
- [ ] **Step 2:** `npx playwright test e2e/iniciar_preinscripcion.spec.ts`. Expected: FAIL en los nuevos.
- [ ] **Step 3:** Implementar.
  - La clave de idempotencia es `crypto.randomUUID()` por envío.
  - Un `useRef` evita el doble envío.
  - Los archivos se guardan solo como `{ id, nombre, tamano }` en el estado, sin leer su contenido.
- [ ] **Step 4:** Toda la suite: `npx playwright test`, `npm run lint` y `npm run build`. Expected: PASS y build sin errores.
- [ ] **Step 5:** Revisión visual en el navegador de la app, de una sola pasada: pregrado y posgrado en claro, oscuro y 360 px. Arreglar en un solo lote lo que salga.
- [ ] **Step 6: Commit** — "Tarea 25: documentos, guardar, enviar y salida sin guardar".
