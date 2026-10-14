# Check_U

# Descripción general del proyecto

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

