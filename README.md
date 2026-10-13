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

## Documentos para pregrado

El estudiante debe cargar los siguientes cinco documentos:

1. **Documento de identidad**
   - Cédula de ciudadanía o de extranjería.
   - Permite extraer los datos de identificación del estudiante y
     compararlos con la información registrada en la solicitud.

2. **Evaluación de Grado expedida por Banner**
   - Contiene información académica del estudiante.
   - Se utiliza para revisar los requisitos académicos definidos
     para el proceso de grado.

3. **Paz y Salvo de Biblioteca**
   - Documento expedido por la dependencia de Biblioteca.
   - Se contempla verificar su correspondencia con el estudiante,
     así como su autenticidad e integridad mediante firma criptográfica.

4. **Comprobante de pago de la estampilla Pro-Cultura**
   - Comprobante correspondiente al pago de la estampilla de la
     Gobernación de Bolívar.
   - Se contempla validar la información del pago y las condiciones
     requeridas para la solicitud de grado.

5. **Resultados de las pruebas Saber Pro**
   - Reporte de resultados del estudiante.
   - Se extraen el nombre, la identificación, el número de registro,
     la fecha de aplicación y el puntaje global.
   - El requisito de puntaje se considera cumplido cuando el
     puntaje global es mayor o igual a **100 puntos**.

## Documentos para posgrado

El estudiante debe cargar los siguientes tres documentos:

1. **Documento de identidad**
   - Cédula de ciudadanía o de extranjería.

2. **Paz y Salvo de Biblioteca**
   - Documento expedido por la dependencia de Biblioteca.

3. **Comprobante de pago de la estampilla Pro-Cultura**
   - Comprobante correspondiente al pago de la estampilla de la
     Gobernación de Bolívar.

Dentro del alcance documental definido para CheckU, las solicitudes
de posgrado no requieren la Evaluación de Grado de Banner ni los
resultados de Saber Pro.

## Proceso de prevalidación

El flujo previsto comprende las siguientes actividades:

1. El estudiante diligencia la información de su solicitud.
2. Carga los documentos correspondientes a su nivel de formación.
3. El sistema extrae la información mediante lectura directa del
   documento o reconocimiento óptico de caracteres (OCR).
4. Se aplican las reglas de validación correspondientes.
5. Se presentan los resultados y las observaciones.
6. El estudiante puede corregir y reenviar los documentos que
   lo requieran.

## Documentos que requieren revisión

Un documento debe marcarse como **requiere revisión** cuando:

- No se puedan extraer los datos necesarios.
- La imagen o el escaneo no permita una lectura confiable.
- La información esté incompleta o sea ambigua.
- Existan inconsistencias que necesiten revisión manual.
- El archivo esté dañado o su formato no sea compatible.

Los datos que no puedan extraerse no deben inventarse ni utilizarse
para aprobar automáticamente una solicitud.

## Alcance de la validación

Las funcionalidades descritas corresponden al alcance previsto del
proyecto; su disponibilidad depende del avance de cada componente.

La extracción de información y la comprobación de requisitos no
demuestran, por sí solas, la autenticidad de todos los documentos.

CheckU apoya la revisión del personal encargado del proceso de grados.
La prevalidación no sustituye la revisión institucional ni la decisión
administrativa final de la Universidad.