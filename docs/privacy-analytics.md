# Estrategia de privacidad, analítica y PWA

## Analítica privacy-friendly

La capa `src/lib/privacyAnalytics.ts` está desactivada por defecto. Solo se activa si se configuran estas variables públicas:

```bash
PUBLIC_PRIVACY_ANALYTICS=true
PUBLIC_PRIVACY_ANALYTICS_ENDPOINT=https://example.com/analytics
```

Eventos previstos:

- `tool_opened`: una herramienta se ha abierto.
- `tool_completed`: una herramienta terminó correctamente.
- `tool_error`: error genérico de herramienta.
- `pwa_installed`: instalación o señal equivalente de PWA.
- `offline_ready`: el modo offline está disponible.

### Datos permitidos

Solo se deben enviar datos genéricos y no sensibles:

- identificador interno de herramienta, por ejemplo `merge-pdf`;
- tipo de error genérico, por ejemplo `protected_pdf` o `too_large`;
- ruta pública de la página;
- idioma de la interfaz;
- fecha del evento.

### Datos prohibidos

No se deben enviar nunca:

- nombres de archivos;
- contenido de PDFs;
- texto extraído del PDF;
- número de páginas real del documento del usuario;
- metadatos del PDF;
- miniaturas, imágenes, firmas o capturas;
- contraseña o información de seguridad del documento.

La analítica debe fallar en silencio y no puede bloquear ninguna herramienta PDF.

## Estrategia PWA

La PWA usa `public/sw.js` con una caché separada para assets estáticos y rutas visitadas. La estrategia está pensada para permitir uso recurrente sin comprometer documentos privados.

### Qué se cachea

- shell básico de la app;
- home en español e inglés;
- manifiesto e iconos;
- assets generados por Astro bajo `/_astro/`;
- páginas visitadas para navegación offline básica.

### Qué no se cachea

El service worker evita cachear respuestas que puedan corresponder a archivos de usuario o exportaciones:

- métodos `POST`, `PUT` y `PATCH`;
- URLs con extensión `.pdf`, `.zip`, `.png`, `.jpg`, `.jpeg`, `.webp` o `.txt`.

Esto reduce el riesgo de persistir PDFs, imágenes o resultados generados por el usuario en la caché del navegador.

## Pendiente recomendado

Cuando se edite el layout global, conviene incluir en el `<head>`:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<script src="/pwa-register.js" defer></script>
```

El helper `public/pwa-register.js` ya añade el manifest de forma defensiva y registra `/sw.js` si se carga desde una página.
