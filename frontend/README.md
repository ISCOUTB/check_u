# CheckU · frontend

Interfaz web de CheckU en **Next.js 16** (React 19). Tiene las pantallas del estudiante y del personal de grados, y consume la API del [backend](../backend/README.md).

> Esta versión de Next.js tiene cambios importantes frente a versiones anteriores: antes de programar, lee [`AGENTS.md`](AGENTS.md) y la documentación en `node_modules/next/dist/docs/`.

## Requisitos

- **Node.js 22 LTS** (como mínimo 20.9, que es lo que exige Next.js).
- El **backend** corriendo en http://localhost:3000. Sin él no funciona el inicio de sesión.

## Instalación

Desde `frontend/`:

```bash
npm ci
```

## Configuración

Copia `.env.example` como `.env.local`, que no se sube a git:

| Variable | Valor en desarrollo | Para qué |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api` | URL de la API del backend, con el prefijo `/api`. Sin ella, el login muestra "No está configurada la URL del backend." |

## Ejecutar

```bash
npm run dev
```

Abre **http://localhost:3001**. El frontend usa el puerto 3001 porque el backend ocupa el 3000, y el CORS del backend solo acepta `localhost:3001`.

**Usuarios de prueba:** los del [README del backend](../backend/README.md#endpoints).

Para producción: `npm run build` y luego `npm run start`. `start` no fija puerto: usa el 3000, o el que indique `PORT`.

## Pruebas y calidad

```bash
npm run lint
```
ESLint (configuración de Next.js).

```bash
npm run build
```
Compila y comprueba los tipos.

## Páginas

| Ruta | Qué es | Estado |
|---|---|---|
| `/` | Inicio de sesión | Conectado al backend |
| `/connect` | Prueba de conexión con el backend | Conectado |
| `/estudiante/home` | Inicio del estudiante | La sesión es real (`/auth/me`); la solicitud activa, las notificaciones y la política de reenvíos son datos simulados (ver `app/estudiante/home/api.ts`) |
| `/estudiante/preinscripcion` | Carga de documentos | Página provisional; la real es otra tarea |
| `/funcionario/dashboard` | Solicitudes del personal de grados | Datos de ejemplo escritos en el código |
| `/funcionario/detalle_preinscripcion/[id]` | Detalle de una solicitud | Datos de ejemplo escritos en el código |
