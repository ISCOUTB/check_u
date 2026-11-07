# Tarea 53: informe de las pruebas de flujo (#133)

Pruebas de extremo a extremo de los flujos del estudiante y de la funcionaria de grados, ejecutadas el
06/11/2026 sobre `main` en el commit `5ecce0b`.

## Resultado general

Se ejecutaron los **14 escenarios**: **7 exitosos** y **7 fallidos**. En los fallidos,
el flujo principal funciona y falla alguna comprobación concreta; el más incompleto es el 13.
Quedan registrados **13 hallazgos**: 3 de severidad alta, 4 media, 1 por aclarar y 5 baja.

**Repetición del 07/11/2026** sobre `main` en `7c5738c`, con las pruebas al día con los campos de la Tarea 54:
24 pruebas, 15 en verde y 9 en rojo. Las rojas son las de la tabla del
[README](../../../frontend/e2e-flujo/README.md), y **H-01 sigue presente**. Las capturas son las del 06/11.

| # | Escenario | Resultado | Motor | Hallazgos |
|---|---|---|---|---|
| 1 | Preinscripción de pregrado | ✅ Exitoso | Real y controlado | H-11, H-13 |
| 2 | Preinscripción de posgrado | ❌ Fallido | Real | **H-01**, H-08 |
| 3 | Reenvío de documentos | ✅ Exitoso | Real y controlado | |
| 4 | Resultado: Válida | ✅ Exitoso | Controlado | |
| 5 | Resultado: No válida | ✅ Exitoso con observación | Real y controlado | H-10 |
| 6 | Resultado: Inconsistente | ✅ Exitoso | Controlado | |
| 7 | Resultado: Por revisar | ✅ Exitoso con observación | Controlado | H-12 |
| 8 | Cancelación por el estudiante | ❌ Fallido | Controlado | **H-02** |
| 9 | Dashboard de la funcionaria | ✅ Exitoso | Datos sembrados | |
| 10 | Administración de periodos | ❌ Fallido | No aplica | H-07 |
| 11 | Filtrado de solicitudes | ❌ Fallido | Datos sembrados | H-09 |
| 12 | Revisión y gestión | ❌ Fallido | Controlado | **H-03**, H-05, H-06 |
| 13 | Historial de solicitudes | ❌ Fallido | Controlado | **H-02** |
| 14 | Anulación por la funcionaria | ❌ Fallido | Controlado | H-04 |

## Cómo se probó

- **Aplicación real:** frontend, backend y base PostgreSQL 16 de `main`, con el esquema que aplica `levantar.ps1`. Un navegador Chromium (1280 × 900) sigue los pasos por pantalla con Playwright. No se simula ninguna respuesta del backend.
- **Repetible:** `frontend/e2e-flujo/`; instrucciones en su [README](../../../frontend/e2e-flujo/README.md). Una prueba en rojo corresponde a un hallazgo de este informe.
- **Datos:** todos inventados, también la identidad del estudiante y de la funcionaria.

### Qué es real y qué es simulado

| Parte | Cómo se usó |
|---|---|
| **Motor real** | Los validadores de `modules/` con PDF inventados. Los rechazan por no ser los documentos pedidos, así que prueba el camino «No válido», no el de un documento correcto. |
| **Motor controlado** | `motor-de-prueba.mjs` responde la clasificación que pide cada escenario, marcada `motor-de-prueba@1`. Se usó para Válida, Inconsistente y Por revisar. |
| **ALMA** | Siempre simulado, con el ejemplo de la Tarea 50. |
| **Otros estudiantes** | Sembrados por SQL en los escenarios 9 y 11, porque el inicio de sesión solo admite un estudiante y una funcionaria. |

### Límites de estas pruebas

- **Los validadores reales no se probaron con documentos correctos.** No hay ninguna Evaluación de Banner de prueba ni un juego completo válido. Los escenarios 4, 6 y 7 prueban cómo reacciona la aplicación a cada resultado, no si el motor los detecta bien.
- **«Estudiante nuevo»** significa reiniciar los datos: el inicio de sesión no permite varios estudiantes a la vez.
- **Solo escritorio:** Chromium a 1280 × 900; no se revisó en celular ni en otros navegadores.
- **Servidor de desarrollo:** el círculo «N» de las capturas es de Next.js y no es parte de la aplicación.

## Hallazgos

| ID | Severidad | Resumen | Escenario |
|---|---|---|---|
| H-01 | Alta | Posgrado: el formulario dice «Todo listo», pero el envío se rechaza | 2 |
| H-02 | Alta | El historial solo muestra las acciones de la funcionaria | 8, 13 |
| H-03 | Alta | Una solicitud aceptada se le muestra al estudiante «en curso» | 12 |
| H-04 | Media | El motivo de la anulación no llega al estudiante | 14 |
| H-05 | Media | El estudiante no puede leer completo un comentario | 12 |
| H-06 | Media | «Solicitar corrección» pisa el estado calculado | 12 |
| H-07 | Media | Se pueden crear dos periodos con el mismo nombre | 10 |
| H-08 | Por aclarar | Documentos de posgrado: la #133 y las reglas del proyecto no coinciden | 2 |
| H-09 | Baja | Los filtros no se pueden usar sin periodo ni sin nivel | 11 |
| H-10 | Baja | El estudiante ve «Inválida» y la funcionaria «No válida» | 5 |
| H-11 | Baja | El programa se muestra como código interno | 1, 13 |
| H-12 | Baja | Con el motor caído, el mensaje no corresponde a un primer envío | 7 |
| H-13 | Baja | Detalles de texto en las pantallas del estudiante | 1, 8 |

### H-01. Posgrado: el formulario dice «Todo listo», pero el envío se rechaza (alta)

- **Pasos:** en posgrado, llenar solo lo marcado como obligatorio, adjuntar los documentos y enviar.
- **Esperado:** si el formulario dice «Todo listo para enviar», el envío se acepta; o el formulario marca esos campos como obligatorios.
- **Observado:** «Estudios y experiencia» aparece como *Opcional* y el índice dice «Todo listo para enviar», pero el backend responde «Debe completar nivel de estudios y título obtenido».
- **Impacto:** ningún estudiante de posgrado puede enviar sin descubrir el error al final.
- **Causa:** el backend los exige (`backend/src/solicitudes/solicitudes.service.ts:854`) y `validacion.ts` del formulario no.
- **Recomendación:** marcarlos obligatorios en el formulario de posgrado, o quitar la exigencia del backend.
- **Evidencia:** [02-x](capturas/02-x-posgrado-rechazado-con-todo-listo.png). Prueba: E2.0.

### H-02. El historial solo muestra las acciones de la funcionaria (alta)

- **Pasos:** crear una solicitud, reenviar un documento, comentar y anular; abrir «Historial de revisiones». También, cancelar una solicitud y abrir su historial.
- **Esperado (#133, escenario 13):** creación, envíos y reenvíos, resultados de los análisis, cambios de estado, comentarios, acciones de la funcionaria, cancelaciones y anulaciones.
- **Observado:**

  | Evento | ¿Aparece? |
  |---|---|
  | Comentarios | Sí |
  | Acciones de la funcionaria y anulación | Sí |
  | Creación de la solicitud | No |
  | Envíos y reenvíos | No |
  | Resultados de los análisis | No |
  | Cambios de estado | No |
  | Cancelación por el estudiante | No: dice «No hay revisiones registradas» |

- **Impacto:** la funcionaria no puede reconstruir qué pasó con una solicitud, y una cancelada parece no tener historia.
- **Causa:** la pestaña lista solo la tabla `revisiones`. Los datos existen: en la prueba había 2 entregas (`INICIAL`, `CORRECCION`) y 6 validaciones guardadas.
- **Recomendación:** armar una línea de tiempo con `entregas`, `validaciones`, `historial_validaciones`, `revisiones` y la cancelación.
- **Evidencia:** [13-a](capturas/13-a-historial-funcionaria.png), [08-f](capturas/08-f-historial-funcionaria.png). Pruebas: E13 y E8.

### H-03. Una solicitud aceptada se le muestra al estudiante «en curso» (alta)

- **Pasos:** la funcionaria acepta una solicitud válida; el estudiante abre su inicio.
- **Esperado:** el inicio dice claramente que fue aceptada, como ya lo hace con «Anulada».
- **Observado:** el título dice «Tu solicitud de grado está en curso», ofrece «Continuar mi preinscripción» y la tarjeta no muestra el estado. Lo único que lo indica es la notificación.
- **Impacto:** el estudiante puede no enterarse de la decisión más importante del proceso.
- **Causa:** `reciente.activa` es verdadero para `ACEPTADA` (`frontend/app/estudiante/home/SeccionBienvenida.tsx:21-22`), y el estado de la tarjeta solo se muestra si no está activa (`TarjetaSolicitudReciente.tsx:221`).
- **Recomendación:** tratar `ACEPTADA` como estado final en el inicio.
- **Evidencia:** [12-h](capturas/12-h-estudiante-tras-aceptar.png), y para comparar, [14-c](capturas/14-c-estudiante-tras-anular.png). Prueba: E12.

### H-04. El motivo de la anulación no llega al estudiante (media)

- **Pasos:** la funcionaria anula con el comentario «Motivo de anulación de prueba.»; el estudiante abre su inicio.
- **Esperado (#133, escenario 14):** se muestra el estado de anulación «y la información asociada».
- **Observado:** el estado sí se ve, pero el estudiante solo lee «Tu solicitud fue anulada. Incumpliste ciertos requisitos.», sin el motivo. El mensaje afirma un incumplimiento aunque, en esta prueba, los 5 requisitos estaban válidos.
- **Causa:** es un texto fijo en el disparador de notificaciones (`db/init/01-schema.sql:722` y `:899`).
- **Recomendación:** incluir el comentario de la funcionaria y usar un texto neutro.
- **Evidencia:** [14-c](capturas/14-c-estudiante-tras-anular.png). Prueba: E14.

### H-05. El estudiante no puede leer completo un comentario (media)

- **Pasos:** la funcionaria envía un comentario; el estudiante revisa su inicio y el detalle de su preinscripción.
- **Esperado (#133, escenario 12):** el estudiante puede leer el comentario.
- **Observado:** la notificación muestra solo los primeros 15 caracteres («Comentario de p…») y el texto completo no aparece en el detalle. La pantalla de la funcionaria avisa que «el historial conserva el texto completo», pero ese historial es de ella.
- **Recomendación:** mostrar el comentario completo al estudiante, en la notificación o en su detalle.
- **Evidencia:** [12-e](capturas/12-e-estudiante-tras-comentario.png), [12-e2](capturas/12-e2-estudiante-detalle-tras-comentario.png). Prueba: E12.

### H-06. «Solicitar corrección» pisa el estado calculado (media)

- **Pasos:** con una solicitud No válida (un documento `NO_VALIDO`), la funcionaria usa «Solicitar corrección».
- **Esperado:** el estado sigue siendo el calculado a partir de los documentos (No válida), como definió la Tarea 42.
- **Observado:** pasa a `POR_REVISAR`, aunque ningún documento está por revisar. El dashboard la cuenta mal hasta el siguiente recálculo.
- **Causa:** `backend/src/notificaciones/notificaciones.service.ts:259-263` asigna `recarga: 'POR_REVISAR'` en vez de recalcular.
- **Recomendación:** recalcular con `recalcularEstado`, o confirmar con el equipo si es intencional.
- **Evidencia:** [12-f](capturas/12-f-estudiante-tras-correccion.png). Prueba: E12.

### H-07. Se pueden crear dos periodos con el mismo nombre (media)

- **Pasos:** crear «Grados 2027-1» y luego otro con el mismo nombre y otras fechas.
- **Esperado (#133, escenario 10):** evitar periodos duplicados.
- **Observado:** solo se rechaza el duplicado de las mismas fechas de recepción. Con el mismo nombre se crea un segundo periodo.
- **Causa:** la validación de `backend/src/periodos/periodos.service.ts` compara solo las fechas.
- **Recomendación:** validar también el nombre, si el equipo lo considera un duplicado.
- **Evidencia:** [10-e](capturas/10-e-nombre-duplicado.png). Prueba: E10.

### H-08. Documentos de posgrado: la #133 y las reglas del proyecto no coinciden (por aclarar)

No es necesariamente un error de código: los documentos del proyecto se contradicen.

| Fuente | Posgrado, un programa |
|---|---|
| #133 | Cédula, **Evaluación de Banner** y Estampilla |
| `docs/PROMPT_BASE.md` («Reglas fijas») | Identidad, Paz y Salvo y Estampilla |
| La aplicación | Identidad y Estampilla, más el Paz y Salvo por consulta |

La aplicación sigue a `PROMPT_BASE.md`. Con **dos programas**, para lo que la #133 pide verificar la configuración, el formulario pide los mismos 2 documentos: una sola estampilla, mientras que pregrado pide una por programa.

- **Pregunta para quien definió la tarea:** ¿posgrado debe pedir Evaluación de Banner? ¿Y una estampilla por programa?
- **Evidencia:** [02-a](capturas/02-a-formulario-posgrado-un-programa.png), [02-d](capturas/02-d-formulario-posgrado-dos-programas.png). Pruebas: E2.1 (en rojo hasta aclararlo) y E2.2.

### H-09. Los filtros no se pueden usar sin periodo ni sin nivel (baja)

Todas las combinaciones de periodo, nivel, estado y fechas devolvieron lo correcto. Pero la #133 pide usarlos también individualmente, y sin periodo la tabla dice «Selecciona un periodo», mientras que el nivel no tiene una opción «Todos». Evidencia: [11-d](capturas/11-d-sin-periodo.png). Prueba: E11.

### H-10. El estudiante ve «Inválida» y la funcionaria «No válida» (baja)

El mismo estado tiene dos nombres, y en la misma pantalla del estudiante los documentos dicen «No válido». `frontend/app/estudiante/solicitudes/listado.ts:41` indica que es intencional, pero la #133 y el dashboard usan «No válida». Evidencia: [05-a](capturas/05-a-no-valida-motor-real.png). Prueba: E5.1.

### H-11. El programa se muestra como código interno (baja)

El encabezado del detalle muestra `INGENIERIA_DE_SISTEMAS_Y_COMPUTACION` en vez de «Ingeniería de Sistemas y Computación», tanto al estudiante como a la funcionaria. Evidencia: [01-d](capturas/01-d-resultado-tras-enviar.png), [13-a](capturas/13-a-historial-funcionaria.png).

### H-12. Con el motor caído, el mensaje no corresponde a un primer envío (baja)

Si el motor falla en un primer envío, el comportamiento es seguro: la solicitud queda en `BORRADOR` y el formulario conserva lo escrito. Pero el mensaje dice «Los resultados anteriores se conservan» y «Corrige lo que se indica», cuando no hay resultados anteriores ni nada que corregir. Conviene un mensaje del tipo «El servicio no está disponible; intenta más tarde». Evidencia: [07-d](capturas/07-d-motor-caido.png). Prueba: E7.3.

### H-13. Detalles de texto en las pantallas del estudiante (baja)

- Con una solicitud activa, el inicio dice «puedes… iniciar una nueva preinscripción», pero no ofrece el botón ([12-e](capturas/12-e-estudiante-tras-comentario.png)).
- El panel «Antes de enviar» sigue apareciendo después de enviar ([14-c](capturas/14-c-estudiante-tras-anular.png)).
- Un mismo documento No válido muestra a la vez las etiquetas «No válido» y «Por revisar» ([01-d](capturas/01-d-resultado-tras-enviar.png)).
- Algunos mensajes del motor no llevan tildes: «numero», «cedula», «resolucion» ([01-d](capturas/01-d-resultado-tras-enviar.png)).
- Con «Sin periodo disponible», el formulario se puede llenar entero sin que nada avise antes de enviar ([08-d](capturas/08-d-periodo-deshabilitado.png)).

## Resultados por escenario

### 1. Preinscripción de pregrado: ✅ exitoso

- Desde `estudiante/home`, «Nueva preinscripción» e «Iniciar preinscripción para pregrado» llevan al formulario ([01-a](capturas/01-a-estudiante-nuevo-inicio.png), [01-b](capturas/01-b-formulario-pregrado-un-programa.png)).
- **Un programa:** pide Cédula, Evaluación de Banner, Estampilla y Saber Pro.
- **Dos programas:** pide además la segunda Evaluación y la segunda Estampilla, 6 en total, y guarda ambos programas ([01-f](capturas/01-f-formulario-pregrado-dos-programas.png), [01-g](capturas/01-g-resultado-dos-programas.png)).
- Muestra el avance del análisis con barra y porcentaje ([01-c](capturas/01-c-progreso-analisis.png)).
- Al terminar, separa los documentos por corregir de los que pasaron ([01-d](capturas/01-d-resultado-tras-enviar.png), [01-e](capturas/01-e-inicio-con-resultados.png), [01-h](capturas/01-h-inicio-resultado-mixto.png)).

### 2. Preinscripción de posgrado: ❌ fallido (H-01, H-08)

- **Funciona:** la navegación, el formulario, el progreso y los resultados, una vez llenos el nivel de estudios y el título ([02-a](capturas/02-a-formulario-posgrado-un-programa.png), [02-b](capturas/02-b-progreso-analisis.png), [02-c](capturas/02-c-resultado-posgrado.png), [02-e](capturas/02-e-resultado-posgrado-dos-programas.png)).
- **Falla:** el envío se rechaza con el formulario en «Todo listo» (H-01), y los documentos pedidos no coinciden con la #133 (H-08).

### 3. Reenvío de documentos: ✅ exitoso

Probado en pregrado y en posgrado con el motor real.

- El contador baja de 3 a 0, y cada reenvío crea una versión, una entrega `CORRECCION` y un análisis nuevos ([03-a](capturas/03-a-pregrado-antes-de-reenviar.png), [03-a posgrado](capturas/03-a-posgrado-antes-de-reenviar.png)).
- **Cuarto envío:** la pantalla ya no ofrece «Volver a cargar», y al intentarlo directo contra la API responde 409 ([03-b](capturas/03-b-pregrado-tras-tres-reenvios.png), [03-b posgrado](capturas/03-b-posgrado-tras-tres-reenvios.png)).
- Con el motor controlado, un documento corregido pasa a Válido y la solicitud a Válida ([03-c](capturas/03-c-reenvio-actualiza-resultado.png)).

### 4. Resultado Válida: ✅ exitoso (motor controlado)

El estudiante ve «5 de 5 requisitos válidos» y ya no se le ofrece reenviar; la funcionaria ve «Válida» ([04-a](capturas/04-a-valida-estudiante-inicio.png), [04-b](capturas/04-b-valida-estudiante-detalle.png), [04-c](capturas/04-c-valida-funcionaria.png)).

### 5. Resultado No válida: ✅ exitoso con observación (H-10)

- **Motor real:** los PDF inventados se rechazan, con un motivo claro por documento ([05-a](capturas/05-a-no-valida-motor-real.png), [05-b](capturas/05-b-no-valida-funcionaria.png)).
- **Biblioteca:** con obligaciones pendientes, la tabla las detalla junto con las acciones por hacer ([05-c](capturas/05-c-no-valida-biblioteca.png)).

### 6. Resultado Inconsistente: ✅ exitoso (motor controlado)

Señala el documento inconsistente y su motivo, tanto cuando el documento no coincide con el formulario como cuando ALMA no coincide con CheckU ([06-a](capturas/06-a-inconsistente-estudiante.png), [06-b](capturas/06-b-inconsistente-funcionaria.png), [06-c](capturas/06-c-inconsistente-biblioteca.png)).

### 7. Resultado Por revisar: ✅ exitoso con observación (H-12)

- La funcionaria ve «Marcar válido» y «Marcar no válido»; al resolver, la solicitud se recalcula a Válida ([07-a](capturas/07-a-por-revisar-estudiante.png), [07-b](capturas/07-b-por-revisar-funcionaria.png)).
- Un código que no está en ALMA queda Por revisar ([07-c](capturas/07-c-por-revisar-biblioteca.png)).

### 8. Cancelación por el estudiante: ❌ fallido (H-02)

- **Funciona:** pide confirmación, sale del dashboard, el periodo queda deshabilitado para el estudiante y su listado muestra «Cancelada» ([08-a](capturas/08-a-confirmar-cancelacion.png), [08-b](capturas/08-b-solicitud-cancelada.png), [08-c](capturas/08-c-dashboard-sin-la-solicitud.png), [08-d](capturas/08-d-periodo-deshabilitado.png), [08-e](capturas/08-e-historial-estudiante.png)).
- **Falla:** el historial de la funcionaria no registra la cancelación ([08-f](capturas/08-f-historial-funcionaria.png)).

### 9. Dashboard: ✅ exitoso (datos sembrados)

Los contadores, porcentajes, gráficos y filas coinciden con la base de datos por estado, nivel y periodo, y las canceladas quedan fuera ([09-a](capturas/09-a-dashboard-pregrado-periodo-a.png), [09-b](capturas/09-b-dashboard-posgrado-periodo-a.png), [09-c](capturas/09-c-dashboard-pregrado-periodo-b.png)).

### 10. Administración de periodos: ❌ fallido (H-07)

- **Funciona:**
  - crear ([10-a](capturas/10-a-periodo-creado.png));
  - rechazar fin antes del inicio ([10-b](capturas/10-b-fin-antes-de-inicio.png)) y graduación antes del fin ([10-c](capturas/10-c-graduacion-antes-de-fin.png));
  - rechazar las mismas fechas de recepción ([10-d](capturas/10-d-periodo-duplicado.png));
  - editar y cerrar ([10-f](capturas/10-f-periodo-editado.png));
  - el estudiante ve los cambios: sin periodo cuando se cierra ([10-g](capturas/10-g-estudiante-sin-periodo-abierto.png)) y con el nombre nuevo al reabrirlo ([10-h](capturas/10-h-estudiante-con-periodo-editado.png)).
- **Falla:** acepta dos periodos con el mismo nombre ([10-e](capturas/10-e-nombre-duplicado.png)).

### 11. Filtrado: ❌ fallido (H-09)

Periodo, nivel, estado y rango de fechas devuelven lo correcto, solos y combinados ([11-a](capturas/11-a-filtro-estado.png), [11-b](capturas/11-b-filtro-rango.png), [11-c](capturas/11-c-filtros-combinados.png)). Falla que no se pueden usar sin periodo ni sin nivel ([11-d](capturas/11-d-sin-periodo.png)).

### 12. Revisión y gestión: ❌ fallido (H-03, H-05, H-06)

Acciones realizadas y lo que ve el estudiante en `estudiante/home` después de cada una:

| Acción de la funcionaria | Estado de la solicitud | Notificación | Inicio del estudiante |
|---|---|---|---|
| Comentario | Sin cambios | «Nuevo comentario», truncado (H-05) | «En curso» ([12-e](capturas/12-e-estudiante-tras-comentario.png)) |
| Solicitar corrección | Pasa a Por revisar (H-06) | «Documentos por volver a subir» | «En curso» ([12-f](capturas/12-f-estudiante-tras-correccion.png)) |
| Aceptar (ya Válida) | Aceptada | «Solicitud aceptada» | Sigue «en curso» (H-03) ([12-h](capturas/12-h-estudiante-tras-aceptar.png)) |

- **Funciona:** seleccionar en el dashboard y ver la información y el análisis ([12-a](capturas/12-a-detalle-resumen.png), [12-b](capturas/12-b-detalle-informacion.png), [12-c](capturas/12-c-analisis-documento.png), [12-d](capturas/12-d-comentario-registrado.png), [12-g](capturas/12-g-solicitud-aceptada.png)).
- **Funciona:** no se puede aceptar una solicitud que no es válida; la opción está deshabilitada y la API responde 409.

### 13. Historial: ❌ fallido (H-02)

Registra comentarios, acciones de la funcionaria y anulaciones. Faltan creación, envíos y reenvíos, análisis, cambios de estado y cancelaciones ([13-a](capturas/13-a-historial-funcionaria.png)).

### 14. Anulación por la funcionaria: ❌ fallido (H-04)

- **Funciona:** el estado se actualiza (en la base es `CERRADA`, en pantalla «Anulada»), y el estudiante lo ve al volver a entrar. Queda en el historial con su motivo ([14-a](capturas/14-a-acciones-antes-de-anular.png), [14-b](capturas/14-b-solicitud-anulada.png), [14-d](capturas/14-d-historial-anulacion.png)).
- **Falla:** el motivo no le llega al estudiante ([14-c](capturas/14-c-estudiante-tras-anular.png)).

## Recomendaciones

1. **Antes de la próxima entrega:** H-01, que impide enviar en posgrado sin un error al final, y H-03, que oculta la aceptación.
2. **Aclarar con el equipo:** H-08 (documentos de posgrado) y H-06 (si el cambio de estado es intencional).
3. **Luego:** H-02 (historial completo), H-04 y H-05 (que la información llegue al estudiante) y H-07.
4. **Repetir con documentos reales:** cuando exista un juego completo válido, probar los escenarios 4, 6 y 7 con el motor real, en local y sin subir esos documentos ni sus capturas.
