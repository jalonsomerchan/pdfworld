# Estrategia PWA de FácilPDF

FácilPDF puede funcionar como PWA instalable para que la home y las herramientas principales carguen más rápido y puedan abrirse sin conexión tras una primera visita.

## Archivos principales

- `public/manifest.webmanifest`: define nombre, icono, color de tema, modo standalone y accesos directos.
- `public/pwa-icon.svg`: icono vectorial reutilizado por el manifest.
- `public/sw.js`: service worker con caché de shell, navegación y assets estáticos.
- `public/offline.html`: pantalla de respaldo cuando no hay conexión y la ruta no está cacheada.
- `src/pages/[lang]/index.astro`: registra el service worker desde la home y añade el manifest dinámicamente.

## Política de caché

El service worker usa una caché versionada para recursos estáticos y navegación:

- Precachea el shell mínimo: `/`, `/es`, `/en`, `/offline.html`, manifest e iconos.
- Cachea páginas visitadas para que puedan reabrirse offline.
- Cachea assets estáticos seguros como scripts, estilos, fuentes, imágenes de interfaz y recursos de `/_astro/`.
- No cachea métodos `POST`, `PUT` ni `PATCH`.
- No cachea respuestas con extensiones de archivos generados o de usuario: `.pdf`, `.zip`, `.png`, `.jpg`, `.jpeg`, `.webp` o `.txt`.

## Privacidad

La PWA no debe usar Cache Storage para guardar PDFs del usuario, resultados generados, imágenes capturadas, zips, textos extraídos ni documentos temporales. Las herramientas pueden usar memoria, URLs temporales de objeto o almacenamiento local controlado cuando sea necesario para el flujo de traspaso entre herramientas, pero eso queda fuera de la caché persistente del service worker.

## Actualizaciones

Al cambiar la estrategia de caché, incrementa `CACHE_VERSION` en `public/sw.js`. El evento `activate` elimina cachés antiguas automáticamente.

## Comprobaciones recomendadas

1. Ejecutar `npm run build`.
2. Servir el sitio en HTTPS o localhost.
3. Abrir `/es` y verificar que se registra `/sw.js`.
4. Instalar la app desde el navegador.
5. Entrar en una herramienta, desconectar la red y recargar.
6. Confirmar en DevTools que no se cachean archivos `.pdf`, `.zip`, `.txt` ni imágenes generadas por el usuario.
