# Check_U

# Descripción general del proyecto
CheckU es un sistema web de preinscripción automatizada a grado para la Universidad Tecnológica de Bolívar. Recibe los documentos de la solicitud de grado y los valida de forma preliminar, antes de que pasen a la revisión manual del personal encargado.

Hoy cada solicitud de grado se revisa a mano, aunque llegue incompleta, inconsistente o con documentos que no cumplen. Eso consume tiempo, genera reprocesos, aumenta la carga del personal, permite errores humanos y dificulta detectar inconsistencias entre documentos. La pregunta de ingeniería es cómo automatizar la recepción y validación preliminar para reducir las solicitudes no válidas que llegan a revisión manual.

Para ello, los estudiantes cargan los documentos de su solicitud (cédula, evaluación de grado de Banner, comprobante de la estampilla Pro-Cultura, Saber Pro y Paz y Salvo de Biblioteca). El sistema los analiza con OCR y reglas de validación, y detecta documentos faltantes, inconsistencias y requisitos incumplidos antes de la inscripción formal.

El sistema atiende a tres tipos de usuarios:

Estudiantes: ven los resultados del análisis y reenvían los documentos que requieran corrección hasta que sean válidos.
Personal de grados: filtra las solicitudes por estado (válida, no válida, inconsistente o por revisar), deja comentarios y consulta estadísticas en gráficos.
Personal de Biblioteca: firma criptográficamente los Paz y Salvo para que CheckU pueda verificar después su autenticidad.

# Elementos o partes del proyecto

## Motor OCR y de validación

## Frontend

## Backend

# Requisitos documentales previos de una solicitud de grado

