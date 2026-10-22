# Formulario de preinscripción del estudiante (Tarea 25)

**Fecha:** 22/10/2026 · **Autor:** Héctor Cabarcas · **Issue:** ISCOUTB/check_u#53 · **Rama:** `tarea_25_formulario_preinscripcion` (desde `main`)

Contexto: `docs/PROMPT_BASE.md`, `docs/contratos.md`, `PRODUCT.md` (nuevo en esta tarea, paso *init* de impeccable), el spec del frontend accesible (`docs/superpowers/specs/2026-10-16-frontend-accesible-design.md`) y el modelo de datos del formulario en la issue #40 (comentario de Lisandro del 22/10). Diseño con las skills **impeccable** (modo *Operate*, superficie nueva dentro del mundo visual que ya existe) y **emil-design-eng** (movimiento).

## 1. Objetivo y éxito

La página `/estudiante/iniciar_preinscripcion?nivel=PREGRADO|POSGRADO`, donde el estudiante:
- llena su información;
- sube sus documentos en PDF;
- guarda un borrador para seguir después;
- envía la preinscripción (la entrega inicial).

**Éxito (Héctor):** el estudiante **sabe siempre qué le falta** para poder enviar, aunque lo llene en varias sesiones.

**Lo que haría sentir mal el resultado:**
- un muro de campos sin orden;
- pasos que no dejan saltar;
- perder lo escrito;
- que parezca un trámite estatal.

Los datos (borrador, envío y archivos) son **simulados**: el backend aún no tiene esos endpoints. Lo único real es la sesión.

**Criterios de la issue:**
- [ ] `npm run lint` y `npm run build` pasan.
- [ ] Pasa la prueba de colores.
- [ ] Funcionan los casos de verificación de la sección 8.
- [ ] Se revisa en claro, oscuro y celular.
- [ ] Una nota separa lo real de lo simulado.

## 2. Decisiones (Héctor, 22/10/2026)

| # | Tema | Decisión |
|---|---|---|
| 1 | Estructura | **Índice lateral con progreso.** Elegida en la página de decisión de impeccable, entre acordeón con estado, índice lateral y pasos libres. Todo el formulario en una página, con un índice fijo que marca cada sección y documento. |
| 2 | Lista de documentos | La crea esta tarea, en `app/estudiante/documentos-requeridos.ts`, moviendo ahí `DOCUMENTOS_POR_NIVEL` de `home/api.ts` (home la sigue usando igual). La #52 (bienvenida, Lisandro) la reutiliza, y se le avisa en el PR. |
| 3 | Campos | `Field` se amplía con `opciones` (se dibuja como `<select>`), sin cambiar lo que ya lo usa. Componente nuevo **Opciones** para las preguntas sí/no y las de una sola opción: `<fieldset>`, `<legend>` y radios reales. Los dos van en `app/components/ui`. |
| 4 | Departamento, ciudad y programa | Texto libre, con TODO para cambiarlos a listas cuando existan las oficiales. En la base (#40) también son texto. |
| 5 | Tamaño máximo del PDF | `NEXT_PUBLIC_TAMANO_MAXIMO_PDF_MB`, opcional y documentada en `.env.example`. Sin ella, el cliente no limita el tamaño (TODO: el backend es la autoridad). Nunca se escribe un valor fijo en el código. |
| 6 | Salir con cambios sin guardar | Al recargar o cerrar, el aviso del navegador (`beforeunload`). Al tocar un enlace interno, un diálogo propio (`Dialog`): "Tienes cambios sin guardar", con Guardar y salir / Salir sin guardar / Seguir aquí. Next 16 no trae bloqueo de navegación, así que se intercepta el clic. |
| 7 | Casos simulados | `?escenario=borrador` o `?escenario=rechazo`, **solo en desarrollo** (en producción se ignora). Sin parámetro: sin borrador. No lleva datos personales. |
| 8 | Pruebas | Playwright + axe, como en la #36: claro, oscuro y celular, con los casos de la sección 8. Además, `lint`, `build` y la prueba de colores. |
| 9 | Voz | Tutea, cercana y clara (`PRODUCT.md`). |

## 3. Mundo visual y movimiento

- **Se hereda el mundo visual que ya existe.** Tokens de `globals.css` (claro y oscuro), Geist, la `Navbar` y los componentes de `app/components/ui`. Sin colores fijos: lo verifica `e2e/colores.spec.ts`. No se agregan dependencias.
- **Movimiento** (emil-design-eng):
  - un campo condicional que aparece (segundo programa, tipo de contrato, registro Saber Pro) entra en 180 ms con `var(--ease-out)`, solo con opacidad y un desplazamiento de 4 px, usando `@starting-style`; al desaparecer, se va sin animación;
  - las marcas del índice cambian de color en 150 ms;
  - los botones conservan el `scale(0.97)` al presionarlos;
  - nada se anima por una acción de teclado ni por el desplazamiento;
  - con movimiento reducido, solo cambia la opacidad.

## 4. Estructura de la página

- **Encabezado:** `PageHeader`, con la ruta *Inicio / Iniciar preinscripción*, el título "Preinscripción de grado · Pregrado/Posgrado" y una línea que explica que puede guardar y seguir después.
- **Escritorio (768 px o más):** dos columnas.
  - **Índice** a la izquierda, fijo debajo de la barra (`position: sticky`). Arriba, el resumen **"Te faltan N secciones y M documentos"**, o "Todo listo para enviar". Debajo, un enlace por sección y uno a "Documentos", cada uno con su marca:
    - completa: ícono ✓ y el texto "Completa";
    - pendiente: "Faltan N campos";
    - documentos: "N de M documentos cargados".
    
    El estado va en el texto, no solo en el color. La sección visible se marca con `aria-current="location"`.
  - **Contenido** a la derecha: una tarjeta (`Card`) por sección, cada una con un `<fieldset>` y su `<legend>`.
- **Celular (menos de 768 px):** el índice se vuelve una barra de progreso al inicio del contenido, que se despliega (patrón de divulgación, botón con `aria-expanded`). En 480 px los campos pasan a una sola columna.
- **Barra de acciones fija abajo:**
  - "Guardar para continuar después" (secundario) y "Enviar preinscripción" (primario);
  - el estado del borrador ("Borrador guardado el 22/10/2026, 3:40 p. m.", hora de Bogotá, en `role="status"`);
  - la nota "Simulación: el borrador no se conserva si recargas la página".
  
  Los objetivos táctiles miden 44 px o más, y la barra no tapa el foco (`scroll-padding-bottom`).
- **Secciones:**
  - **A. Identificación:** nombres, apellidos, tipo de documento, número de documento, fecha de nacimiento y género.
  - **B. Contacto y residencia:**
    - correo, precargado de la sesión, de solo lectura y sin confirmación;
    - teléfono fijo (opcional) y celular;
    - departamento, ciudad o municipio y dirección.
  - **C. Información académica:**
    - código estudiantil, con la ayuda "Ejemplo: T00012345";
    - modalidad (virtual o presencial), en Opciones;
    - programa;
    - solo pregrado: tipo de opción de grado;
    - "¿Solicitas grado en un segundo programa?" en Opciones. Si es sí, aparecen la modalidad, el programa y (pregrado) la opción de grado del segundo programa. En pregrado, el segundo programa agrega un segundo comprobante de estampilla en Documentos.
  - **D. Solo pregrado, Saber Pro y vinculación con la UTB:**
    - "¿Conoces tu número de registro?"; si es sí, el número (ayuda "Ejemplo: EK202012345678") y la fecha del examen;
    - "¿Eres empleado de la UTB?"; si es sí, el tipo de contrato;
    - "¿Eres hijo o hija de un empleado de la UTB?".
  - **E. Solo posgrado, estudios y experiencia:**
    - nivel de estudios alcanzado, título obtenido y "¿Eres egresado de pregrado de la UTB?";
    - los dos últimos cargos, del más reciente al más antiguo: dos grupos (`<fieldset>`) con empresa, cargo y tiempo.
    
    Posgrado también muestra el segundo programa como en C, sin el segundo comprobante (pendiente de confirmar).
  - **Documentos:**
    - una zona de carga por documento: `<input type="file" accept="application/pdf,.pdf">` real con su `<label>`, operable con el teclado;
    - al cargar, se muestran el nombre del archivo y el botón "Quitar";
    - arriba, el contador "N de M documentos cargados".
- **Obligatorios:** se indican con el texto "(obligatorio)" en la etiqueta, no con asteriscos ni solo con color. Según la propuesta de la issue, son: nombres, apellidos, tipo y número de documento, correo, código estudiantil, programa y modalidad (y los del segundo programa si dice que sí), más todos los documentos requeridos. Lo demás es opcional hasta confirmarlo con el formulario real.

## 5. Archivos

```
frontend/
  .env.example                                  + NEXT_PUBLIC_TAMANO_MAXIMO_PDF_MB (comentada, sin valor)
  app/components/ui/Field.tsx (+ .module.css)   + prop opciones -> <select>
  app/components/ui/Opciones.tsx (+ .module.css) nuevo: <fieldset>/<legend> con radios
  app/estudiante/documentos-requeridos.ts       nuevo: lista única por nivel
  app/estudiante/home/api.ts                    DOCUMENTOS_POR_NIVEL se deriva de la lista única
  app/estudiante/iniciar_preinscripcion/
    page.tsx                                    servidor: lee searchParams (nivel, escenario) y metadata
    FormularioPreinscripcion.tsx                cliente: estado, sesión, carga, guardar, enviar
    IndiceProgreso.tsx                          índice (escritorio) y barra desplegable (celular)
    BarraAcciones.tsx                           Guardar / Enviar / estado del borrador
    ResumenErrores.tsx                          resumen con enlaces a cada campo
    ZonaDocumento.tsx                           carga de un PDF: input real, nombre, Quitar
    secciones/{Identificacion,Contacto,Academico,SaberProVinculacion,EstudiosExperiencia,Documentos}.tsx
    tipos.ts                                    tipos alineados con la #40
    constantes.ts                               listas de valores (TODO: sin confirmar)
    validacion.ts                               funciones puras: obligatorios, formato, PDF, progreso
    api.ts                                      simulado en memoria, con TODO por endpoint
    useCambiosSinGuardar.ts                     beforeunload + intercepción de enlaces internos
    iniciar_preinscripcion.module.css
  e2e/iniciar_preinscripcion.spec.ts            pruebas de la página
```

`page.tsx` es un componente de servidor que lee `searchParams` (una promesa en Next 16) y se los pasa al formulario. Así se evita `useSearchParams` en el cliente, que en Next 16 exige un `Suspense` o rompe el `build` (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`).

## 6. Datos

### Tipos (`tipos.ts`, calcando el mapeo de la #40)

- `PerfilEstudiante`: tipo y número de documento, fecha de nacimiento (`aaaa-mm-dd`, fecha local), género, teléfonos, departamento, ciudad y dirección.
- `ProgramaSolicitud`: `orden` 1 o 2, programa, modalidad (`VIRTUAL` o `PRESENCIAL`) y tipo de opción de grado (nulo en posgrado).
- `InformacionPregrado`: conoce el registro Saber Pro, número de registro, fecha del examen, es empleado de la UTB, tipo de contrato y es hijo de un empleado.
- `InformacionPosgrado`: nivel de estudios alcanzado, título obtenido y es egresado de pregrado de la UTB.
- `ExperienciaLaboral`: `orden` 1 o 2, empresa, cargo y tiempo (texto).
- `BorradorPreinscripcion`: nivel, nombres, apellidos, correo, código estudiantil, perfil, programas, la información por nivel, la experiencia, los documentos cargados (`{ tipo, archivo }`, sin el contenido en ningún almacenamiento) y `guardadoEn`.

Los tipos documentales usan las claves del contrato (`TypeDocument`): `identification`, `academic_evaluation`, `paz_y_salvo_bib`, `estampilla_pro_cultura` y `saber_pro`.

### `documentos-requeridos.ts`

```ts
export interface DocumentoRequerido {
    tipo: TypeDocument;
    etiqueta: string;          // lo que ve el estudiante
    retirando?: true;          // el Paz y Salvo: retirarlo es quitar esta entrada; no se muestra
    unoPorPrograma?: true;     // la estampilla en pregrado: segundo comprobante con segundo programa
}
export const DOCUMENTOS_REQUERIDOS: Record<Nivel, readonly DocumentoRequerido[]>;
export function documentosRequeridos(nivel: Nivel, segundoPrograma: boolean): DocumentoRequerido[]; // con el segundo comprobante si aplica
```

`home/api.ts` sigue exportando `DOCUMENTOS_POR_NIVEL` (las etiquetas), derivado de esta lista, así que `home` no cambia.

### `api.ts` (simulado)

```ts
cargarPreinscripcion(nivel, escenario): Promise<{ estado: "sin_borrador" | "borrador" | "enviada"; borrador?: BorradorPreinscripcion }>
guardarBorrador(borrador): Promise<{ guardadoEn: string }>      // TODO: endpoint pendiente
enviarPreinscripcion(borrador, claveIdempotencia): Promise<{ ok: true } | { ok: false; motivos: string[] }>
tamanoMaximoPdfBytes(): number | null                            // de NEXT_PUBLIC_TAMANO_MAXIMO_PDF_MB
```

- Todo vive en memoria: el borrador no sobrevive a recargar la página, y se dice en pantalla.
- El escenario `borrador` trae un borrador parcial con datos inventados; `rechazo` hace que `enviarPreinscripcion` devuelva motivos.
- Nada se guarda en `localStorage`, `sessionStorage` ni la URL, y no se escriben datos personales en la consola.

## 7. Comportamiento

- **Entrada:**
  - Solo estudiantes, con el patrón de `useSesion`.
  - Si `nivel` no es `PREGRADO` ni `POSGRADO`, o si `usuario.nivel` existe y no coincide, redirige a `/estudiante/bienvenida`. Esa página es la #52 y todavía no existe: mientras tanto da 404, y queda anotado.
  - Si ya hay una solicitud enviada, redirige a `/estudiante/preinscripcion`.
  - Si hay un borrador, lo carga.
- **Validación:**
  - **Número de documento:** solo letras y dígitos. Los caracteres no permitidos (comas, espacios, puntos) no se dejan escribir, porque se filtran al teclear y al pegar, y además se avisa: "Solo letras y números, sin puntos ni espacios".
  - **Documentos:** solo PDF, por extensión y tipo; no vacíos; y dentro del tamaño máximo si está configurado. Un archivo rechazado no se carga y su zona muestra el error.
  - **Código estudiantil y registro Saber Pro:** sin restricción de formato. Solo llevan el ejemplo como ayuda, hasta confirmar el formato.
  - **Fechas:** `<input type="date">`, tratadas como fecha local (el valor `aaaa-mm-dd` sin convertir desde UTC).
- **Guardar para continuar después:**
  - no exige nada y deja el botón ocupado ("Guardando…") mientras tanto;
  - al terminar, muestra "Borrador guardado el …";
  - un borrador no es una entrega y no consume ningún reenvío.
- **Enviar preinscripción:**
  1. Valida todo: los obligatorios de la sección 4 y todos los documentos requeridos.
  2. **Con errores:** muestra arriba un resumen (`role="alert"`) con un enlace a cada campo y mueve el foco al resumen. Cada campo marca su error (`aria-invalid` y `aria-describedby`).
  3. **Sin errores:** abre el `Dialog` "Revisa tu información antes de enviar", con un resumen de lo que va a enviar y la advertencia de que después de enviada es de solo consulta (supuesto que hay que confirmar con el equipo). Los botones son Volver a editar y Enviar.
  4. **Al confirmar:** deshabilita el botón ("Enviando…"), genera una clave de idempotencia por envío (`crypto.randomUUID()`) y, si sale bien, navega a `/estudiante/preinscripcion`. Si el backend rechaza el envío, muestra sus motivos en el resumen.
- **Estados:**
  - cargando el borrador (`aria-busy`);
  - error al cargar, guardar o enviar, con "Reintentar";
  - cambios sin guardar (decisión 6).
- **Errores técnicos:** nunca llevan datos personales.

## 8. Pruebas (`e2e/iniciar_preinscripcion.spec.ts`)

Mismo soporte que la #36 (`sesionComo`, `revisarAxe` y el backend simulado con `page.route`):
- pregrado sin segundo programa;
- pregrado con segundo programa: aparece el segundo comprobante de estampilla;
- posgrado: secciones E y Documentos de posgrado, sin el segundo comprobante;
- condicionales: tipo de contrato solo si es empleado, y registro y fecha de Saber Pro solo si los conoce;
- número de documento con caracteres no permitidos: no se escriben y se avisa;
- archivo que no es PDF, y PDF vacío, rechazados;
- envío incompleto: resumen de errores, foco y enlaces;
- borrador parcial (`?escenario=borrador`): se carga, y "Guardar" muestra la hora;
- envío rechazado (`?escenario=rechazo`): se muestran los motivos;
- envío correcto: diálogo, clave de idempotencia y navegación;
- nivel que no coincide con el del usuario, y nivel inválido: redirección;
- cambios sin guardar: el diálogo al tocar un enlace de la barra;
- axe en claro, oscuro y celular, con el diálogo abierto y con el resumen de errores;
- el índice refleja el progreso: marcas y conteos.

Además, `npm run lint`, `npm run build` y `e2e/colores.spec.ts`, más una revisión visual en claro, oscuro y celular con el navegador.

## 9. Real frente a simulado, y pendientes

- **Real:** la sesión (`/auth/me`), los componentes y la validación del cliente.
- **Simulado:** el borrador, el envío, los rechazos y la carga de archivos (los archivos no salen del navegador).
- **Pendientes:**
  - los endpoints de solicitudes, borradores y archivos;
  - las listas de valores;
  - qué es obligatorio de verdad;
  - el formato del código y del registro Saber Pro;
  - el segundo comprobante en posgrado;
  - la solo consulta después de enviar;
  - la página `/estudiante/bienvenida` (#52);
  - el valor del tamaño máximo del PDF.
