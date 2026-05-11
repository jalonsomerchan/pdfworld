# Checklist responsive móvil de FácilPDF

Usa esta lista antes de cerrar una herramienta o pantalla nueva.

## Anchos mínimos a revisar

- 320 px: móviles pequeños.
- 375 px: iPhone base.
- 390 px: móviles actuales comunes.
- 430 px: móviles grandes.
- 768 px: tablet vertical.
- 1024 px: tablet horizontal o portátil pequeño.

## Reglas generales

- No debe aparecer scroll horizontal accidental.
- Los contenedores principales deben usar `width: 100%`, `max-width: 100%` y `min-width: 0` cuando estén dentro de grids/flex.
- Textos largos, nombres de archivos y mensajes técnicos deben usar `overflow-wrap: anywhere` o truncado controlado.
- Evita columnas fijas en móvil; pasa a una sola columna por debajo de 720 px o 520 px según el componente.
- Los modales deben ocupar casi todo el alto disponible y mantener botones visibles.

## Áreas táctiles

- Botones principales: mínimo recomendado de 44 px de alto.
- Botones secundarios o chips: mínimo de 40-44 px cuando sean acciones táctiles.
- En móvil, las acciones principales de descarga/procesar deberían ocupar el 100% del ancho disponible.
- Evita poner más de 2-3 botones pequeños en una misma fila en móvil.

## Flujo de herramienta PDF

1. Subida: la dropzone debe ser grande, clara y pulsable.
2. Lista de archivos: el nombre puede truncarse, pero las acciones deben seguir siendo accesibles.
3. Opciones: formularios y selects deben ocupar todo el ancho en móvil.
4. Procesando: usar `ToolProcessingState`, con barra completa y texto legible.
5. Resultado: usar `ToolResultCard`, con descarga como botón ancho en móvil.
6. Errores: usar `ToolErrorNotice`, evitando mensajes largos sin salto de línea.

## Pruebas rápidas

- Subir un archivo con nombre muy largo en 320 px.
- Generar un error y verificar que el texto no rompe el layout.
- Abrir el resultado y comprobar que el botón de descarga es cómodo.
- Rotar el dispositivo o simular 768 px para revisar que el layout no queda demasiado estrecho.
- Activar modo oscuro y revisar contraste en móvil.
