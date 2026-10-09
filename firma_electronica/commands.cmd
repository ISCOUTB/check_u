New-Item -ItemType Directory -Force C:\ProgramData\FirmaBiblioteca\certificados
Copy-Item secrets\biblioteca.key, secrets\biblioteca.crt C:\ProgramData\FirmaBiblioteca\certificados\

//Se mueven los certificados a la carpeta de certificados de la biblioteca, para que la aplicación pueda encontrarlos.