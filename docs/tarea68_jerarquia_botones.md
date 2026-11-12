# Tarea 68 — Jerarquía de botones (primario / secundario / terciario)

Componente: `frontend/app/components/ui/Button.tsx`  
Variantes: `primario` | `secundario` | `terciario`

## Reglas de uso

| Variante       | Peso visual                           | Cuándo usarla                                                               | Ejemplos                                                                 |
| -------------- | ------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **primario**   | Máximo (fondo accent)                 | La acción principal del contexto. Idealmente **una** por grupo de acciones. | Enviar, Confirmar, Guardar y salir, Continuar                            |
| **secundario** | Medio (borde + surface)               | Acciones importantes pero no principales; cancelar / volver / alternativas. | Cancelar, Volver a editar, Guardar borrador, Reintentar (bloque), Editar |
| **terciario**  | Mínimo (sin fondo, tipografía ligera) | Acciones auxiliares o de bajo impacto.                                      | Ver todas, Quitar archivo, ¿Olvidaste tu contraseña?, Seguir aquí        |

## Principios

1. **Un primario por zona de acciones.** Si hay dos botones “fuertes”, uno debe bajar a secundario o terciario.
2. **Las acciones destructivas no se abren en primario.** El botón que _abre_ el diálogo de cancelación/eliminación es secundario; el que _confirma_ dentro del diálogo sí puede ser primario.
3. **Reintentar:**
   - En un bloque de error de página → `secundario`.
   - Inline dentro de un mensaje → `terciario`.
4. **Usar siempre el componente `Button`.** No crear estilos ad-hoc de botón que compitan con la jerarquía.
5. **Tema claro y oscuro:** los tokens (`--color-accent`, `--color-surface`, etc.) ya cubren ambos; no hardcodear colores.

## Checklist al añadir un botón

- [ ] ¿Es la acción principal de esta pantalla/diálogo? → `primario`
- [ ] ¿Es alternativa o cancelación? → `secundario`
- [ ] ¿Es auxiliar / de bajo peso? → `terciario`
- [ ] ¿Hay ya otro primario en el mismo grupo? → reconsiderar
