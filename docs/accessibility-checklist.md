# Checklist de accesibilidad para FácilPDF

Usa esta lista antes de publicar o modificar una herramienta PDF.

## Estructura y navegación

- La página tiene un único `<h1>` descriptivo.
- Los bloques principales usan `section`, `article`, `nav`, `header`, `main` o `footer` cuando corresponde.
- El contenido principal se puede saltar con el enlace `Saltar al contenido` del layout.
- Los enlaces tienen texto claro; evita enlaces genéricos como “clic aquí”.
- Los controles que abren/cambian menús usan `aria-expanded` y `aria-controls`.

## Formularios y carga de archivos

- Cada input tiene label visible o `aria-label` claro.
- La dropzone se puede usar con teclado y abre el selector de archivos con Enter/Espacio al ser botón.
- La ayuda de la dropzone está asociada con `aria-describedby`.
- Los errores de validación se anuncian con `role="alert"` o `aria-live="assertive"`.
- Los estados informativos se anuncian con `role="status"` o `aria-live="polite"`.

## Botones y acciones

- Los botones tienen texto visible suficiente o `aria-label` específico.
- En listas de archivos, los botones de subir, bajar y eliminar incluyen el nombre del archivo en el `aria-label`.
- Los botones deshabilitados comunican el estado con `disabled` real cuando no son accionables.
- Las áreas táctiles deben ser cómodas en móvil: objetivo recomendado de 44px de alto/ancho.

## Estados de herramienta

- Procesando: usar `ToolProcessingState` o un patrón equivalente con `aria-busy` y `aria-live`.
- Resultado: usar `ToolResultCard` o modal con título, descripción y acción principal de descarga.
- Error: usar `ToolErrorNotice` o un patrón equivalente con mensaje claro y acción de reinicio cuando proceda.
- No bloquear la interfaz sin feedback visual o textual.

## Drag and drop y ordenación

- Las operaciones críticas deben tener alternativa por botones, no depender solo de arrastrar.
- Si una lista se puede reordenar, debe tener botones “Subir” y “Bajar”.
- Tras mover o eliminar elementos, el cambio debe reflejarse en texto o estado visible.

## Color, contraste y movimiento

- El texto normal debe mantener contraste suficiente sobre el fondo.
- No usar solo color para transmitir errores, éxito o advertencias; añade texto o icono.
- Todas las animaciones deben respetar `prefers-reduced-motion`.
- El foco visible no debe eliminarse; usa `:focus-visible` con sombra o borde claro.

## Imágenes, iconos y previews

- Iconos decorativos llevan `aria-hidden="true"`.
- Iconos informativos usan `label` o texto cercano equivalente.
- Las miniaturas de páginas PDF deben tener `alt` descriptivo: página, número y archivo origen.
- Las vistas previas en iframe deben tener `title` descriptivo.

## Idiomas

- El atributo `lang` del documento debe coincidir con la versión (`es` o `en`).
- Los textos generados por componentes deben usar el idioma actual.
- No mezclar etiquetas de acción en español dentro de la versión inglesa ni al revés.

## Comprobaciones manuales rápidas

1. Navega solo con Tab, Enter, Espacio y Escape.
2. Sube un archivo con teclado.
3. Genera un error y verifica que se anuncia visualmente y por `role="alert"`.
4. Ejecuta una operación larga y verifica que el usuario entiende que está procesando.
5. Prueba el ancho de 320px y confirma que no hay scroll horizontal.
6. Activa “reducir movimiento” en el sistema y confirma que no hay animaciones innecesarias.
