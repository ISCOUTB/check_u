# Pruebas de flujo (Tarea 53, #133)

Recorren la aplicación real con Playwright: frontend, backend, PostgreSQL y motor. A diferencia de `e2e/`, no
simulan el backend y no corren con `npx playwright test`, porque necesitan su propio entorno.

Los resultados y hallazgos están en [`docs/pruebas/tarea53/informe.md`](../../docs/pruebas/tarea53/informe.md).

## Ejecutar

Requiere Docker Desktop abierto y las dependencias de `backend/` y `frontend/` instaladas. Desde la raíz del
repositorio:

```powershell
.\frontend\e2e-flujo\levantar-entorno.ps1
```

Cuando el backend y el frontend terminen de arrancar:

```powershell
cd frontend
npx playwright test -c playwright.flujo.config.ts
```

Para un solo archivo: `npx playwright test -c playwright.flujo.config.ts e2e-flujo/02`. Las capturas se
sobrescriben en `docs/pruebas/tarea53/capturas/`. La suite completa tarda unos 7 minutos: el backend admite 8 envíos
por minuto y, al llegar a ese límite, la prueba espera y reintenta.

Para apagar, cierra las tres ventanas que se abrieron y ejecuta:

```powershell
.\frontend\e2e-flujo\levantar-entorno.ps1 -Apagar
```

El entorno usa contenedores y puertos propios (base en 5443, motor en 5013 y 5014) y no toca los de
`levantar.ps1`. Sí necesita libres los puertos 3000 y 3001.

**Cada prueba borra los datos de su base de prueba.** Las credenciales y los datos son inventados y solo existen
en este entorno.

## Qué significa una prueba en rojo

Una prueba en rojo corresponde a un hallazgo del informe, y se pondrá en verde cuando se corrija:

| Prueba | Hallazgo |
|---|---|
| E2.1 | H-08 |
| E5.1 | H-10 |
| E8, E13 | H-02 |
| E11 | H-09 |
| E12 | H-03, H-05, H-06 |
| E14 | H-04 |

## Archivos

| Archivo | Para qué |
|---|---|
| `01-preinscripcion` | Escenarios 1 y 2 |
| `02-reenvios` | Escenario 3 |
| `03-resultados` | Escenarios 4 a 7 |
| `04-cancelacion` | Escenario 8 |
| `05-funcionaria` | Escenarios 9, 10 y 11 |
| `06-gestion` | Escenarios 12, 13 y 14 |
| `soporte.ts` | Inicio de sesión, formulario, base de datos y evidencias |
| `motor-de-prueba.mjs` | Se pone delante del motor real; en modo `controlado` responde lo que pide cada escenario |
| `levantar-entorno.ps1` | Levanta y apaga el entorno |

Cada escenario elige el motor con `motor("real")` o `motor("controlado", { saber_pro: "invalid" })`, y el resultado
de Biblioteca con `alma("combinado")`. Las respuestas controladas llevan `motor-de-prueba@1` como versión de
validación.
