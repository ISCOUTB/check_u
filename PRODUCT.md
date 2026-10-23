# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Estudiante a punto de graduarse** (usuario principal): estudiante de pregrado o posgrado de la Universidad Tecnológica de Bolívar (UTB) que solicita su grado. Tiene los documentos dispersos (cédula, Evaluación de Grado de Banner, Paz y Salvo de Biblioteca, estampilla Pro-Cultura, Saber Pro en pregrado). A veces trabaja desde el celular y llena la preinscripción en más de una sesión. Quiere saber qué le falta o qué debe corregir antes de enviar.
- **Funcionario de la oficina de grados** (secundario): revisa las preinscripciones, ve el resultado de la validación automática de cada documento y decide en los casos marcados "por revisar".

## Product Purpose

CheckU **prevalida** los documentos de la solicitud de grado antes de la solicitud formal: los lee, aplica las reglas de cada documento y le dice al estudiante qué corregir. Así llegan menos solicitudes incompletas a la oficina de grados.

CheckU **no aprueba grados ni reemplaza la decisión oficial**. "Lista para la solicitud formal" no es "grado aprobado". Una fuente externa que no responde nunca se presenta como una falla del estudiante.

## Positioning

Separa lo que se puede comprobar de lo que no. Cada regla da cumple, no cumple o no evaluable, con su motivo. Lo que no se puede verificar automáticamente (baja calidad, firma no verificable, fuente externa caída) va a revisión humana, en vez de rechazarse o aprobarse a ciegas.

## Operating Context

- Flujo del estudiante:
  1. inicia sesión;
  2. ve la bienvenida o su inicio;
  3. llena la preinscripción, que puede guardar como borrador;
  4. sube los documentos en PDF;
  5. la envía (entrega inicial);
  6. consulta los resultados y corrige con reenvíos, que tienen un límite diario.
- Flujo del funcionario: tablero de preinscripciones y detalle de cada una, con el análisis automático por documento.
- Documentos por nivel:
  - pregrado: cédula, Evaluación de Grado (Banner), Paz y Salvo de Biblioteca, estampilla Pro-Cultura (dos si hay segundo programa) y Saber Pro;
  - posgrado: documento de identidad, Paz y Salvo y estampilla Pro-Cultura.
  
  El Paz y Salvo está "próximo a retirar", porque se consultará en ALMA, el sistema de la Biblioteca.
- Fuentes externas: el RUI, sin acuerdo formal (si falla, el resultado es "no evaluable"); Banner, sin integrar (queda pendiente); ALMA.

## Capabilities and Constraints

- Una sola aplicación: frontend Next.js 16 (CSS Modules), backend NestJS y motor de validación en Python como trabajador. Sin microservicios.
- El backend hoy solo tiene autenticación (`/auth/login`, `/auth/me`, `/auth/logout`) y `/health`. Las solicitudes, los borradores y la carga de archivos todavía no existen: el frontend los simula, y lo dice.
- Contratos de datos compartidos en `docs/contratos.md` y `contratos/esquemas/` (Tarea 02). Las fechas van en America/Bogota.
- Pendientes de confirmar con el formulario real: las listas de valores (tipo de documento, género, opción de grado, contrato, nivel de estudios), el formato del código estudiantil y del registro Saber Pro, y cuáles campos son obligatorios.

## Brand Commitments

- Nombre: **CheckU**. Institución: Universidad Tecnológica de Bolívar (logo en `frontend/public/icons/`).
- Voz: en español de Colombia, **tuteando**, cercana y clara. Por ejemplo: "Accede a CheckU para validar tus documentos de grado" y "Tu solicitud de grado, más sencilla".
- Los colores salen de las variables de `frontend/app/globals.css` (tema claro y oscuro), sin colores fijos. Lo verifica `e2e/colores.spec.ts`.

## Evidence on Hand

- Documentos de muestra:
  - `modules/test_data/` (cédulas);
  - `firma_electronica/test/samples/` (Paz y Salvo de pruebas);
  - `contratos/ejemplos/` (resultados del contrato).
- No hay testimonios, métricas de uso ni datos de estudiantes reales para la interfaz: no se inventan.

## Product Principles

1. **Prevalidar, no decidir:** ayudar a corregir antes de la solicitud formal sin prometer aprobación.
2. **Decir siempre qué hacer después:** cada estado lleva la acción del estudiante (corregir, esperar revisión, subir una nueva versión).
3. **Honestidad sobre lo incierto:** lo no verificable va a revisión humana, nunca a "no cumple".
4. **Los datos personales se cuidan:** no se guardan en el navegador, la URL ni la consola.

## Accessibility & Inclusion

WCAG 2.2 AA en todas las pantallas:
- etiquetas visibles;
- errores enlazados;
- foco visible y no tapado;
- objetivos táctiles de 44 px;
- contraste AA en claro y oscuro;
- movimiento reducido respetado.

Celular primero (cortes de 768 y 480 px), y se prueba con Playwright y axe.
