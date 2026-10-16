# Check_U

# Descripción general del proyecto
CheckU es un sistema web de preinscripción automatizada a grado para la Universidad Tecnológica de Bolívar. Recibe los documentos de la solicitud de grado y los valida de forma preliminar, antes de que pasen a la revisión manual del personal encargado.

Hoy cada solicitud de grado se revisa a mano, aunque llegue incompleta, inconsistente o con documentos que no cumplen. Eso consume tiempo, genera reprocesos, aumenta la carga del personal, permite errores humanos y dificulta detectar inconsistencias entre documentos. La pregunta de ingeniería es cómo automatizar la recepción y validación preliminar para reducir las solicitudes no válidas que llegan a revisión manual.

Para ello, los estudiantes cargan los documentos de su solicitud (cédula, evaluación de grado de Banner, comprobante de la estampilla Pro-Cultura, Saber Pro y Paz y Salvo de Biblioteca). El sistema los analiza con OCR y reglas de validación, y detecta documentos faltantes, inconsistencias y requisitos incumplidos antes de la inscripción formal.

El sistema atiende a tres tipos de usuarios:

Estudiantes: ven los resultados del análisis y reenvían los documentos que requieran corrección hasta que sean válidos.
Personal de grados: filtra las solicitudes por estado (válida, no válida, inconsistente o por revisar), deja comentarios y consulta estadísticas en gráficos.
Personal de Biblioteca: firma criptográficamente los Paz y Salvo para que CheckU pueda verificar después su autenticidad.

# Cómo correr CheckU

En Windows, con **Python 3.11+** y **Node.js 22 LTS** (mínimo 20.19) instalados, desde la carpeta del proyecto:

```powershell
.\iniciar.ps1
```

También funciona con clic derecho sobre `iniciar.ps1` → "Ejecutar con PowerShell".

La primera vez instala lo que falte: el entorno de Python, Tesseract con español, los paquetes del backend y del frontend y `frontend/.env.local`. Las siguientes veces se salta lo que ya está instalado y va directo a arrancar. Si cambia un `package-lock.json` (por ejemplo, después de un `git pull`), reinstala solo esa parte.

Levanta las tres partes en la misma ventana y abre el navegador en la aplicación:

| Parte | Dirección |
|---|---|
| Aplicación (frontend) | http://localhost:3001 |
| API (backend) | http://localhost:3000/api |
| Panel de prueba del lector de cédulas (`webapp/`) | http://localhost:5000 |

**Ctrl+C** en esa ventana, o cerrarla, apaga las tres. Si alguno de los puertos ya está ocupado, por ejemplo por otra copia de CheckU, el script lo dice y no arranca nada.

Los usuarios de prueba están en [`backend/README.md`](backend/README.md#endpoints).

# Elementos o partes del proyecto


## Motor OCR y de validación
Es el núcleo de procesamiento de Check_U, desarrollado en **Python** (usando librerías como OpenCV, Tesseract OCR, PyMuPDF, `zxing-cpp` y RapidFuzz). Su objetivo es procesar las imágenes o PDFs de los documentos de identidad suministrados por los estudiantes, extraer su información de forma automática y verificar su validez frente a bases de datos oficiales.
* **Reconocimiento inteligente de formatos colombianos:**
  * **Cédula digital (policarbonato):** Detección y lectura de la zona de lectura mecánica (MRZ de 3 líneas y 30 caracteres) y cruce posicional con las etiquetas del frente (NUIP, nombres y apellidos).
  * **Cédula amarilla con hologramas:** Decodificación del código de barras bidimensional **PDF417** del reverso, lectura de la línea de producción y OCR del frente mediante heurística posicional (reconociendo que las etiquetas van ubicadas debajo de los valores).
* **Preprocesamiento y lectura:** Conversión de PDFs con PyMuPDF (o Poppler como respaldo), corrección de inclinación (*deskew*), escalado y binarización para maximizar la precisión de Tesseract con el paquete de idioma español (`spa.traineddata`).
* **Consulta automatizada al RUI (DNP):** A partir del número de cédula extraído, se consulta en tiempo real la API de la Ventanilla Social del Departamento Nacional de Planeación (DNP) para obtener el nombre oficial registrado del ciudadano.
* **Algoritmo de validación y similitud:** Se implementa comparación difusa con `token_sort_ratio` (RapidFuzz), normalizando tildes, mayúsculas y orden de nombres vs. apellidos con un umbral del **85 %**.
* **Clasificación del resultado:** Asigna automáticamente un estado a cada documento y caso:
  * `valida`: Coincidencia igual o superior al 85 % con el registro oficial.
  * `inconsistente`: El documento no coincide con el RUI o presenta discrepancias entre documentos del mismo caso.
  * `por_revisar`: Documentos de baja resolución, sin respuesta del RUI o no legibles automáticamente, requiriendo revisión humana.

## Frontend
Es la interfaz web de usuario orientada a la comunidad universitaria, desarrollada con **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, **TypeScript** y **Chart.js**. Ofrece experiencias diferenciadas según el rol del usuario autenticado:
* **Portal del Candidato a Grado (Estudiante):**
  * Entorno guiado para conocer los requisitos documentales previos.
  * Carga y seguimiento del estado de la solicitud y prevalidación en tiempo real.
  * Visualización de alertas y observaciones sobre documentos rechazados o inconsistentes antes de la radicación formal.
* **Dashboard Administrativo (Funcionario de Grados):**
  * Panel de control centralizado con métricas e indicadores de preinscripciones.
  * Visualización gráfica de la distribución de solicitudes mediante diagramas de barras y circulares (*doughnut*) en Chart.js.
  * Filtros dinámicos por estado (`Válidas`, `No válidas`, `Inconsistentes`, `Por revisar`).
  * Tabla de auditoría para consultar expedientes individuales, historial y detalles de cada solicitud.
* **Diseño y Usabilidad:**
  * Componentes reutilizables como la barra de navegación (`Navbar`) con información de contexto (nivel académico, perfil, rol).
  * Manejo seguro de sesiones mediante cookies de sesión HTTP-only (`credentials: 'include'`).

## Backend
Es la API central construida con **NestJS 12** sobre **Node.js** y **Express** con TypeScript, encargada de orquestar la lógica de negocio, gestionar la autenticación y comunicar el frontend con los servicios de almacenamiento y procesamiento documental.
* **Control de Acceso y Autenticación (RBAC):**
  * Sistema de autenticación con control de acceso basado en roles (`estudiante` y `funcionario`).
  * Manejo de sesiones mediante cookies seguras e `httpOnly` (`checku.sid`) con expiración temporal para evitar vulnerabilidades de tipo XSS.
  * Endpoints modulares para inicio de sesión (`/api/auth/login`), validación de sesión activa (`/api/auth/me`) y cierre seguro (`/api/auth/logout`).
* **Arquitectura Modular y Escalable:**
  * Estructura modular basada en estándares de NestJS (módulos, controladores, servicios e inyección de dependencias), facilitando la adición de futuros módulos (p. ej., `solicitudes`, `documentos`, `notificaciones`).
* **Monitoreo y Observabilidad:**
  * Integración con `@nestjs/observe` para rastreo distribuido de peticiones, métricas de rendimiento y telemetría de errores.
* **Health Check & CORS:**
  * Verificación del estado del servicio en tiempo real (`/api/health`) y políticas CORS configuradas para comunicación segura con el cliente Next.js.

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