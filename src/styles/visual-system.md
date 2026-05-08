# FácilPDF visual system

FácilPDF usa una identidad clara, directa y preparada para escalar a muchas herramientas PDF. La referencia funcional es la simplicidad de productos como iLovePDF, pero la marca evita el clon: coral/rojo más cálido, tarjetas con radios amplios, fondos documentales claros, microinteracciones suaves y un lenguaje de componentes propio.

## Principios

- **Claridad primero**: una acción principal por pantalla, textos legibles y jerarquía fuerte.
- **Privacidad visible**: estados, badges y ayudas deben reforzar que las herramientas funcionan en navegador.
- **Escalable**: las categorías, tarjetas y formularios deben poder repetirse para decenas de herramientas sin rediseñar cada página.
- **Profesional pero amable**: superficies blancas, bordes sutiles, sombras contenidas y acento coral para acciones.

## Tokens principales

Los tokens están definidos en `src/styles/design-system.css` con prefijo `--pw-*`.

### Color

- Acción principal: `--pw-color-brand-500` a `--pw-color-brand-700`.
- Texto fuerte: `--pw-color-ink-strong`.
- Texto normal: `--pw-color-ink`.
- Texto secundario: `--pw-color-muted` y `--pw-color-muted-strong`.
- Superficies: `--pw-color-surface`, `--pw-color-surface-soft`, `--pw-color-surface-raised`.
- Estados: `success`, `warning`, `danger`, `info`.

### Tipografía

- Familia base: `--pw-font-sans`.
- Escala: `--pw-text-xs` hasta `--pw-text-display`.
- Titulares: peso alto, tracking negativo y `text-wrap: balance`.
- Cuerpo: `--pw-leading-body` para lectura cómoda.

### Layout

- Contenedor: `--pw-container`.
- Gutter fluido: `--pw-page-gutter`.
- Separación base: escala `--pw-space-*`.
- Grid de tarjetas: `--pw-grid-gap`.

### Forma y profundidad

- Radios: `--pw-radius-xs` a `--pw-radius-2xl`, con `--pw-radius-pill` para acciones.
- Sombras: `--pw-shadow-xs`, `--pw-shadow-sm`, `--pw-shadow-md`, `--pw-shadow-lg` y `--pw-shadow-brand`.

## Componentes base

### Botones

Usar `.pw-button` más variante:

```html
<a class="pw-button pw-button--primary" href="/es/unir-pdf">Unir PDF</a>
<button class="pw-button pw-button--secondary">Limpiar</button>
<button class="pw-button pw-button--ghost">Cancelar</button>
```

### Tarjetas

- `.pw-card` para bloques genéricos.
- `.category-card` para categorías de herramientas.
- `.tool-card` para herramientas.

### Formularios

Los estilos base cubren `input`, `select` y `textarea`. Para composición:

```html
<label class="pw-field">
  <span class="pw-label">Nombre del archivo</span>
  <input class="pw-input" placeholder="documento.pdf" />
  <small class="pw-help-text">Usa nombres claros antes de descargar.</small>
</label>
```

### Estados

```html
<p class="pw-alert pw-alert--success">PDF generado correctamente.</p>
<p class="pw-alert pw-alert--error">No se pudo leer el archivo.</p>
```

## Uso en herramientas PDF

Las herramientas específicas pueden mantener CSS local de Svelte/Astro, pero deben consumir variables globales (`var(--pw-color-brand-500)`, `var(--pw-radius-xl)`, `var(--pw-shadow-md)`, etc.) para conservar coherencia.
