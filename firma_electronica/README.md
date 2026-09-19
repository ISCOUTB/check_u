# Módulo de Firma Electrónica — CheckU

Módulo desarrollado para la gestión de la firma electrónica de documentos **Paz y Salvo de Biblioteca**.

El sistema permite seleccionar documentos PDF generados por el sistema existente de Biblioteca, visualizarlos y generar una copia firmada digitalmente, manteniendo el documento original sin modificaciones.

La firma utiliza un certificado y una clave privada institucional para garantizar la integridad del documento firmado.

## Tecnologías

* Python 3
* Tkinter
* PyMuPDF
* pyHanko
* Pillow

## Estructura del proyecto

```text
firma_electronica/
│
├── app/
│   ├── document_service.py
│   └── signature_service.py
│
├── certificados/
│   ├── biblioteca.crt
│   └── biblioteca.key
│
├── domain/
│   └── document.py
│
├── infra/
│   ├── file_system.py
│   ├── pdf_handler.py
│   ├── pdf_signer.py
│   └── signature_validator.py
│
├── test/
│   ├── firmar_pdf.py
│   ├── modificar_pdf.py
│   ├── validar_pdf.py
│   └── paz_y_salvo.pdf
│
└── ui/
    └── main.py
```

## Instalación

Instalar las dependencias necesarias:

```bash
pip install pymupdf pyhanko pillow
```

## Certificados

El módulo utiliza los siguientes archivos:

```text
certificados/
├── biblioteca.crt
└── biblioteca.key
```

* `biblioteca.crt`: certificado utilizado para identificar al firmante.
* `biblioteca.key`: clave privada utilizada para realizar la firma.

> La clave privada debe mantenerse protegida y no debe ser expuesta a los usuarios del sistema.

## Ejecución

Desde la carpeta raíz del proyecto:

```bash
python -m ui.main
```

No se recomienda ejecutar directamente:

```bash
python ui/main.py
```

porque los módulos del proyecto utilizan la raíz `firma_electronica` como referencia para sus importaciones.

## Funcionalidades actuales

### Selección de directorio

El usuario puede seleccionar mediante el explorador de Windows el directorio donde se encuentran los documentos PDF generados por Biblioteca.

### Listado de documentos

El sistema identifica los archivos con extensión `.pdf` presentes en el directorio seleccionado y los muestra en la interfaz.

### Previsualización

El documento seleccionado puede visualizarse antes de realizar la firma.

El visor permite:

* visualizar todas las páginas;
* desplazamiento horizontal y vertical;
* aumentar el zoom;
* disminuir el zoom;
* restablecer el zoom.

### Firma del documento

Al seleccionar un documento y presionar **Firmar documento**, el sistema:

1. toma el PDF original;
2. agrega la identificación visual de la Biblioteca;
3. genera una copia temporal preparada para la firma;
4. aplica la firma criptográfica;
5. genera un nuevo archivo terminado en `_firmado.pdf`;
6. conserva el documento original sin modificar.

La identificación visual agregada al documento es:

```text
PDF firmado por la Biblioteca
```

### Validación

El módulo incluye un componente para validar las firmas digitales presentes en los documentos PDF.

La validación permite comprobar aspectos como:

* existencia de una firma digital;
* integridad del documento;
* modificaciones realizadas después de la firma;
* información relacionada con la confianza del certificado.

## Pruebas

Las pruebas se encuentran en la carpeta:

```text
test/
```

### Firma

Para probar la generación de una firma:

```bash
python -m test.firmar_pdf
```

Esto genera un documento firmado a partir del PDF de prueba.

### Modificación

Para comprobar el comportamiento de la firma ante una modificación posterior:

```bash
python -m test.modificar_pdf
```

Esta prueba genera una copia modificada del documento firmado sin alterar el archivo original.

### Validación

Para validar el PDF firmado y el PDF modificado:

```bash
python -m test.validar_pdf
```

Se utilizan dos documentos para comprobar diferentes escenarios:

```text
paz_y_salvo_firmado.pdf
paz_y_salvo_modificado.pdf
```

## Certificado de prueba

Actualmente se utiliza un certificado de prueba para desarrollar y comprobar el funcionamiento del módulo.

Al ser un certificado autofirmado, aplicaciones como Adobe Acrobat pueden mostrar la firma como **desconocida o no confiable**, aunque la firma criptográfica y la integridad del documento sean correctas.

Esto es diferente de una modificación posterior del documento.

Por ejemplo:

```text
PDF firmado:
Firma presente
Documento modificado: No
Certificado: no confiable / autofirmado
```

Mientras que un documento modificado después de la firma debe producir:

```text
PDF modificado:
Firma: No válida
Documento modificado: Sí
```

Para el entorno institucional deberá utilizarse el mecanismo de certificación definido por la Universidad.

## Principio de conservación del documento original

El sistema no sobrescribe el documento original.

Por ejemplo:

```text
PAZ Y SALVO BIBLIOTECA.pdf
PAZ Y SALVO BIBLIOTECA firmado.pdf
```

El primer archivo permanece sin modificaciones y el segundo contiene la versión firmada.

## Flujo general

```text
PDF generado por Biblioteca
          │
          ▼
Selección del directorio
          │
          ▼
Listado de documentos
          │
          ▼
Selección del PDF
          │
          ▼
Previsualización
          │
          ▼
Firmar documento
          │
          ▼
Agregar identificación visual
          │
          ▼
Aplicar firma criptográfica
          │
          ▼
Generar copia firmada
          │
          ▼
PDF firmado
          │
          ▼
Validación posterior en CheckU
```

## Estado actual

El módulo cuenta actualmente con:

* selección de directorios;
* listado de archivos PDF;
* selección de documentos;
* previsualización de PDF;
* zoom y desplazamiento;
* generación de copia firmada;
* firma criptográfica mediante pyHanko;
* identificación visual de la Biblioteca;
* conservación del documento original;
* pruebas de modificación posterior a la firma;
* componente inicial de validación de firmas.

## Próximos pasos

Como parte de la integración con CheckU, se deberá completar el proceso de validación para comprobar:

1. que el documento contiene una firma;
2. que la firma mantiene su integridad;
3. que el documento no fue modificado después de la firma;
4. que el certificado corresponde al mecanismo de firma establecido para Biblioteca.

También deberá definirse el mecanismo institucional definitivo para la protección y administración de la clave privada y el certificado de firma.
