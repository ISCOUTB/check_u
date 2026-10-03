# Frontend CheckU

## Pasos para ejecutar el Frontend

1. Descargar PHP en formato ZIP desde [aquí](https://downloads.php.net/~windows/releases/archives/php-8.5.11-nts-Win32-vs17-x64.zip).

2. Crear una carpeta llamada `php` en la raíz del disco (por ejemplo, `C:\php`) y descomprimir allí el contenido del ZIP descargado.

3. Agregar la carpeta `C:\php` al **PATH** en las variables de entorno de Windows.

4. Verificar que PHP esté correctamente configurado ejecutando en la terminal:

```powershell
php --version
```

5. Dirigirse a la carpeta del frontend:

```powershell
cd check_u/frontend
```

6. Levantar el servidor PHP:

```powershell
php -S localhost:8000 -t public
```

7. Abrir en el navegador:

```text
http://localhost:8000
```

8. ¡Listo! Ya podrás acceder al **LOGIN de CheckU**.
