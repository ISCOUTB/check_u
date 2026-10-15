# CheckU · backend (API)

API de CheckU en **NestJS 12** (TypeScript, ESM). Es la aplicación principal del sistema: recibe las solicitudes de grado y sus documentos, y coordina el motor de lectura y validación (`modules/`, en Python). Ver la decisión D1 en [`docs/gap_analysis.md`](../docs/gap_analysis.md).

Hoy expone el chequeo de salud y el inicio de sesión. Todavía **no tiene base de datos**: los dos usuarios de prueba están escritos en el código y las sesiones viven en memoria, así que se pierden al reiniciar. Eso se reemplaza en las tareas 03 y 13.

## Requisitos

- **Node.js 22 LTS** (22.12 o superior; como mínimo 20.19, que es lo que exige `oxlint`).

## Instalación

Desde `backend/`:

```bash
npm ci
```

## Configuración

Opcional. Copia `.env.example` como `.env`, que no se sube a git. El backend lo lee al arrancar si existe (`src/entorno.ts`); sin él usa los valores por defecto. Las variables que ya estén definidas en el sistema no se reemplazan.

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `3000` | Puerto del backend. |
| `NODE_ENV` | — | Con `production`, la cookie de sesión solo viaja por HTTPS. |
| `OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET` | vacías | Activan [Observe](https://observe.nestjs.com) (trazas y métricas). Si falta alguna, el backend arranca sin Observe. Nunca subas las claves reales. |

## Ejecutar

```bash
npm run start:dev
```

La API queda en **http://localhost:3000/api**. El frontend corre en el puerto **3001**.

| Puerto | Qué |
|---|---|
| 3000 | backend (esta API) |
| 3001 | frontend (Next.js) |

**CORS:** el backend acepta peticiones con cookies desde `http://localhost:3001` (desarrollo) y `https://checku.iscoutb.dev` (producción). Están en `src/main.ts`.

Para producción: `npm run build` y luego `npm run start:prod`, que ejecuta `dist/main.js`.

## Endpoints

Todos van con el prefijo `/api`.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/health` | Responde `{status, service, message}` si el servicio está arriba. |
| POST | `/api/auth/login` | Cuerpo `{username, password}`. Devuelve `{user}` (201) y la cookie de sesión `checku.sid` (HttpOnly, 30 minutos), o 401. |
| GET | `/api/auth/me` | Devuelve `{user}` de la sesión actual, o 401. |
| POST | `/api/auth/logout` | Cierra la sesión y borra la cookie (201). |

**Usuarios de prueba** (fijos en `src/auth/auth.service.ts`; se reemplazan en la Tarea 13):

| Usuario | Rol | Clave |
|---|---|---|
| `lizapata@utb.edu.co` | estudiante | `12345` |
| `rmarriaga@utb.edu.co` | funcionario | `12345` |

## Pruebas y calidad

```bash
npm test
```
Pruebas unitarias (Vitest): `src/**/*.spec.ts`.

```bash
npm run test:e2e
```
Pruebas de la API completa con supertest: `test/**/*.e2e-spec.ts`.

```bash
npm run lint
```
oxlint con chequeo de tipos.

```bash
npm run build
```
Compila a `dist/`.

## Estructura

```
src/
├── main.ts            # arranque: carga .env, prefijo /api, CORS y puerto
├── entorno.ts         # lee backend/.env si existe
├── app.module.ts      # módulo raíz
├── app.controller.ts  # GET /api/health
├── observabilidad.ts  # Observe, solo si hay claves
└── auth/              # login, me, logout (en memoria)
test/                  # pruebas e2e
```
