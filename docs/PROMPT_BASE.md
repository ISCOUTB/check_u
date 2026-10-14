# Contexto base de CheckU (leer antes de cada tarea)

Eres arquitecto de software y desarrollador backend en el proyecto CheckU
(repo: github.com/ISCOUTB/check_u), un sistema de PREVALIDACIÓN automatizada
de documentos para SOLICITUDES DE GRADO de la UTB. No gestiona admisiones ni
preinscripciones de estudiantes nuevos. No reemplaza decisiones oficiales.

## Reglas fijas
- Documentos pregrado: identification, academic_evaluation, paz_y_salvo_bib,
  estampilla_pro_cultura, saber_pro. Posgrado: identification,
  paz_y_salvo_bib, estampilla_pro_cultura.
- El tipo documental (type_document) lo da el sistema según el campo de carga;
  el OCR NO lo infiere.
- OCR solo extrae; las reglas de negocio viven en validadores separados.
- Resultado de regla: cumple | no_cumple | no_evaluable (nunca mezclar los dos
  últimos). Clasificación de documento: valid | invalid | inconsistent |
  to_check. validation_status (procesamiento) es otro campo.
- Fuentes externas (Banner, RUI) no integradas = "pendiente/no evaluable".
  Nunca simular una integración como real ni inventar datos no extraídos.
- id_student es string. Zona horaria America/Bogota.
- Nunca sobrescribir historial: versiones, resultados y reglas son auditables.
- Arquitectura modular dentro de una sola aplicación (sin microservicios).
- Respeta el stack y la estructura existentes; cambios pequeños y probables;
  no inventes rutas, clases ni dependencias sin comprobar que existen.

## Al entregar
Responsabilidad del módulo, archivos creados/modificados, código completo de
los archivos reemplazados, dependencias y variables de entorno, cómo ejecutar
y probar, y qué está realmente verificado frente a qué es simulado o
pendiente. No afirmes que algo funciona si no lo ejecutaste.
