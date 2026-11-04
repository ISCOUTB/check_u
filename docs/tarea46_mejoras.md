# Ajuste de acciones del home del estudiante

## Resumen

Se reorganizaron las acciones del inicio del estudiante para separar las acciones generales de las acciones propias de la solicitud más reciente.

- El encabezado del saludo ahora puede mostrar acciones alineadas a la derecha.
- **Solicitudes** aparece en el encabezado cuando el estudiante tiene al menos una solicitud previa.
- **Nueva preinscripción** aparece en el encabezado solo cuando no existe ninguna preinscripción activa.
- El mensaje de la solicitud más reciente conserva únicamente su acción contextual:
  - **Continuar mi preinscripción** si la solicitud está activa.
  - **Revisar** si la solicitud fue cancelada por el estudiante.
  - Sin botón para otros estados.

No se modificaron endpoints, contratos, reglas de negocio ni la forma de consultar los datos. Los cambios son de presentación y organización de la interfaz.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `frontend/app/components/ui/PageHeader.tsx` | Agrega la prop opcional `acciones` y renderiza su contenido debajo de la descripción del saludo. |
| `frontend/app/components/ui/PageHeader.module.css` | Define el contenedor de acciones con `flex`, separación y alineación a la derecha. |
| `frontend/app/estudiante/home/page.tsx` | Calcula `hayActiva`, coloca **Solicitudes** y **Nueva preinscripción** en el encabezado y oculta la segunda cuando hay una solicitud activa. |
| `frontend/app/estudiante/home/SeccionBienvenida.tsx` | Deja solo la acción contextual de la solicitud reciente: **Continuar mi preinscripción** o **Revisar**. |
| `frontend/app/estudiante/home/home.module.css` | Alinea a la derecha las acciones de bienvenida y ajusta el layout del bloque en pantallas anchas. |

## Comportamiento resultante

| Situación | Encabezado | Mensaje de la solicitud reciente |
| --- | --- | --- |
| Sin solicitudes previas | Sin acciones | Sin acciones |
| Con solicitudes y al menos una activa | **Solicitudes** | **Continuar mi preinscripción** |
| Con solicitudes y ninguna activa, la más reciente cancelada | **Solicitudes** y **Nueva preinscripción** | **Revisar** |
| Con solicitudes y ninguna activa, la más reciente en otro estado | **Solicitudes** y **Nueva preinscripción** | Sin acciones |

El botón **Revisar** enlaza al detalle histórico de la solicitud cancelada mediante `/estudiante/preinscripcion?solicitud=<id>`.

## Validación

- `npx tsc --noEmit` finaliza sin errores.
- ESLint conserva un error previo en `frontend/app/estudiante/home/page.tsx` (`react-hooks/set-state-in-effect`), no introducido por este cambio.
- No se realizaron commits.
