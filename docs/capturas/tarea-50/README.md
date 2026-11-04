# Capturas de la Tarea 50 (#125)

Capturas de la aplicación corriendo en local, el 04/11/2026: backend, frontend y motor de esta rama,
sobre una base de datos PostgreSQL 16 aparte, con el esquema de `levantar.ps1`. Las respuestas no son
simuladas en el navegador; lo único simulado es ALMA, con
`modules/validadores/fuentes/alma/alma_simulacion.example.json`.

- **Estudiante:** el de prueba de `02-userbase.sql` (T00000001), con un número de documento inventado.
- **PDF de los otros cuatro documentos:** generados con el texto «DOCUMENTO DE PRUEBA» y datos
  inventados. Por eso esos documentos salen «Corrección requerida»; no tienen que ver con el
  Paz y Salvo.

Para cada escenario se cambia el JSON de simulación y se vuelve a consultar Biblioteca.

| Capturas | Escenario | Resultado |
|---|---|---|
| `01-*` | Paz y salvo | Válido; tabla «Al día» |
| `02-*` | Préstamo activo | No válido; préstamos pendientes |
| `03-*` | Solicitudes pendientes | No válido; 2 solicitudes |
| `04-*` | Multa de $15.000 COP | No válido; multas pendientes |
| `05-*` | Combinado (préstamo, multa y solicitud) | No válido; las tres pendientes y sus acciones |
| `06-*` | Documento distinto en ALMA | Inconsistente, sin tabla; la funcionaria ve «Marcar válido / no válido» |
| `07-*` | Código que no está en ALMA | Por revisar |
| `08-*` | El estudiante se pone al día y pulsa «Consultar de nuevo» en su inicio | De No válido a Válido (le cuenta como uno de sus 3 reenvíos del día) |
| `09-*` | Preinscripción del estudiante y diálogo de análisis | La misma tabla dentro del análisis |
| `10-*` | La funcionaria resuelve a mano un Inconsistente | Válido, «Revisado por la funcionaria.», también en el inicio del estudiante |
| `11-*` | Formulario de preinscripción | Pide 4 documentos; el Paz y Salvo ya no se sube |

En cada escenario hay dos capturas:

- `*-estudiante-inicio`: la tarjeta «Mi solicitud de grado» en `estudiante/home`;
- `*-funcionaria-detalle`: el Paz y Salvo en `funcionario/detalle_preinscripcion/[id]`.
