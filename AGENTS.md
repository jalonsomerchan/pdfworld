# AGENTS.md

## Normas para desarrollar herramientas en FácilPDF / PDFWorld

Este proyecto está pensado como una colección de herramientas PDF privadas, frontend y coherentes entre sí. Antes de crear o modificar una herramienta, revisa estas reglas.

## Componentes compartidos obligatorios

### Subida de PDFs

Todas las herramientas que necesiten cargar uno o varios archivos PDF deben reutilizar el componente compartido:

- `src/components/PdfDropzone.svelte`

No crees un uploader nuevo salvo que exista una razón técnica clara y documentada. El `PdfDropzone` centraliza:

- selección de archivos;
- drag and drop;
- validación básica de tipo/extensión;
- microcopy de privacidad;
- transferencia local entre herramientas mediante IndexedDB cuando aplica;
- estilos consistentes con el sistema visual.

Si una herramienta necesita aceptar otro tipo de archivo, intenta extender `PdfDropzone` mediante sus props (`accept`, `acceptedTypes`, `acceptedExtensions`) antes de duplicar UI.

### Vista previa y descarga de PDFs

Todas las herramientas que generen un PDF como resultado deben reutilizar el modal compartido:

- `src/components/PdfResultModal.svelte`

El flujo esperado es:

1. Generar el PDF localmente en el navegador.
2. Crear un `Blob` de tipo `application/pdf`.
3. Crear un `blob:` URL con `URL.createObjectURL(...)`.
4. Mostrar la vista previa con `PdfResultModal`.
5. Permitir descargar desde el modal usando el atributo `download`.
6. Liberar la URL con `URL.revokeObjectURL(...)` al limpiar, regenerar o desmontar el componente.

Evita descargar automáticamente el PDF sin mostrar vista previa, salvo que el usuario haya elegido explícitamente una acción de descarga directa.

## Privacidad

No subas PDFs, imágenes o datos del usuario a servidores externos para procesarlos. Las herramientas deben funcionar localmente en el navegador siempre que sea posible.

El copy de carga y resultado debe ser honesto: se puede decir que el archivo se procesa localmente, pero no prometas cosas que dependan del sistema operativo, extensiones del navegador, copias de seguridad o políticas corporativas del dispositivo.

## UX y accesibilidad

- Mantén botones, formularios y mensajes con etiquetas claras.
- Usa mensajes de error accionables.
- Añade estados de carga cuando una operación tarde.
- Respeta `prefers-reduced-motion` si añades animaciones.
- Las herramientas deben ser responsive.

## Estructura recomendada para una nueva herramienta

1. Registrar la herramienta en `src/data/tools.ts`.
2. Crear la página en `src/pages/[lang]/...`.
3. Crear componente Svelte en `src/components/...`.
4. Añadir claves i18n/SEO en `src/i18n/ui.ts`.
5. Reutilizar `PdfDropzone.svelte` para carga de PDFs.
6. Reutilizar `PdfResultModal.svelte` para previsualización/descarga de PDFs generados.


## Regla principal

Todas las webs de este repositorio deben seguir la guía visual, técnica, SEO y responsive definida en:

- `docs/design-system.md`

El agente debe consultar y aplicar esa guía antes de tocar cualquier archivo relacionado con:

- páginas
- layouts
- componentes
- CSS
- Tailwind
- Svelte/Astro/React/Vue
- HTML
- metadatos SEO
- modo dark/light
- accesibilidad
- rendimiento frontend

## Prioridad

Estas instrucciones tienen prioridad sobre estilos antiguos del proyecto, salvo que el usuario indique lo contrario en la tarea concreta.

## Principios obligatorios

- Mobile first.
- Diseño profesional, limpio, moderno y vistoso.
- Light mode y dark mode en todos los componentes.
- No usar fuentes externas de Google Fonts, Adobe Fonts ni CDNs similares.
- Usar system fonts.
- Evitar dependencias innecesarias.
- Cuidar Core Web Vitals.
- HTML semántico.
- Buen SEO técnico.
- Accesibilidad mínima WCAG AA.
- Componentes reutilizables.
- Variables CSS globales para colores, radios, sombras, espaciados y transiciones.