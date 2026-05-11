# Microinteracciones de FácilPDF

Las microinteracciones deben hacer que la interfaz parezca más cuidada sin bloquear, marear ni ralentizar el uso de herramientas PDF.

## Principios

- Movimiento corto: 120-260ms.
- Cambios sutiles: sombra, elevación, opacidad, desplazamiento pequeño.
- Nada esencial debe depender de una animación.
- Siempre respetar `prefers-reduced-motion`.
- No añadir dependencias pesadas para animaciones.

## Patrones aplicados

- Cards de herramientas: elevación ligera y pequeño movimiento en icono.
- Botones: feedback de hover y estado active con escala mínima.
- Estados de herramienta: aparición suave para procesando, resultado, errores, tarjetas y bloques editoriales.
- Dropzone: mantiene feedback visual al arrastrar archivos.
- Error notice: entrada suave e icono con aparición breve.

## Cuándo no animar

- Operaciones que ya tardan mucho y puedan parecer bloqueadas.
- Cambios de layout que puedan mover el foco del usuario.
- Elementos con contenido crítico para accesibilidad.
- Animaciones repetitivas salvo spinner/progreso.

## Checklist rápida

1. La animación se desactiva con `prefers-reduced-motion`.
2. No provoca scroll horizontal ni salto de layout.
3. No oculta información importante.
4. Dura menos de 300ms salvo casos muy justificados.
5. Funciona igual con teclado y ratón.
