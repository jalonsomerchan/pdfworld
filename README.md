# FácilPDF

FácilPDF es una colección de herramientas PDF online pensada para funcionar como una alternativa ligera, rápida y privada a los grandes directorios de utilidades PDF.

El proyecto está construido con Astro y Svelte, y prioriza que las operaciones se ejecuten en el navegador siempre que sea técnicamente posible. La idea principal es clara: el usuario debe poder unir, dividir, ordenar, convertir o preparar PDFs sin instalar nada y sin enviar sus documentos a un servidor externo.

## Objetivos del proyecto

- Ofrecer herramientas PDF gratuitas, rápidas y fáciles de usar.
- Procesar archivos localmente en el navegador siempre que la herramienta lo permita.
- Crear una base SEO sólida para cada herramienta y categoría.
- Mantener una interfaz responsive, accesible y profesional.
- Evitar dependencias pesadas o servicios externos innecesarios.
- Preparar una arquitectura clara para seguir añadiendo herramientas.

## Privacidad

FácilPDF está diseñado con una filosofía privacy-first:

- Los archivos no deben subirse a servidores externos para las operaciones soportadas en frontend.
- Las herramientas deben evitar registrar nombres de archivo, contenido, páginas o metadatos privados.
- Cualquier límite técnico debe explicarse claramente en la interfaz.
- La analítica, si se activa, debe ser opcional y no debe rastrear información de documentos.

## Stack técnico

- [Astro](https://astro.build/) como framework principal estático.
- [Svelte](https://svelte.dev/) para herramientas interactivas.
- `pdf-lib` para crear y modificar PDFs en navegador.
- `pdfjs-dist` para leer, renderizar o inspeccionar PDFs.
- TypeScript para tipado y mantenimiento.
- CSS propio para el sistema visual, sin depender de fuentes externas.

## Requisitos

Este proyecto declara Node.js `>=22.12.0` en `package.json`.

```bash
node --version
npm --version
```

## Instalación local

Clona el repositorio e instala las dependencias:

```bash
git clone https://github.com/jalonsomerchan/facilpdf.git
cd facilpdf
npm install
```

Arranca el servidor de desarrollo:

```bash
npm run dev
```

Astro levantará la web normalmente en `http://localhost:4321`.

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Arranca el entorno local de desarrollo. |
| `npm run build` | Genera la versión de producción en `dist/`. |
| `npm run preview` | Previsualiza el build de producción en local. |
| `npm run astro` | Ejecuta comandos de la CLI de Astro. |

## Estructura principal

```text
/
├── public/                 # Assets estáticos
├── src/
│   ├── components/         # Componentes Astro/Svelte reutilizables
│   ├── data/               # Catálogo centralizado de herramientas
│   ├── i18n/               # Traducciones y utilidades de rutas
│   ├── layouts/            # Layouts globales
│   ├── pages/              # Rutas estáticas de Astro
│   └── styles/             # Sistema visual y estilos globales
├── astro.config.mjs
├── package.json
└── README.md
```

## Catálogo de herramientas

El listado de herramientas y categorías vive en `src/data/tools.ts`. Antes de crear una nueva página conviene registrar ahí:

- `id` único de la herramienta.
- Título y descripción en español e inglés.
- Categoría.
- Ruta pública.
- Icono.
- Estado: `available`, `soon` o `beta`.
- Keywords y metadatos SEO.

Esto permite reutilizar la misma información en la home, navegación, categorías, páginas SEO y herramientas relacionadas.

## Roadmap de herramientas

### MVP principal

- Unir PDF.
- Dividir PDF.
- Rotar PDF.
- Eliminar páginas.
- Reordenar páginas.
- Convertir imágenes a PDF.
- Generar PDFs de prueba.
- Extraer texto.
- Numerar páginas.
- Editar metadatos.

### Herramientas avanzadas

- Añadir marca de agua.
- Firmar PDF con firma dibujada.
- Extraer imágenes o páginas renderizadas.
- Comprimir PDF en navegador.
- Desbloquear PDF con contraseña conocida.
- Proteger PDF con contraseña, solo si la solución frontend es fiable o se documentan sus límites.

### Producto, SEO y calidad

- Páginas SEO por herramienta.
- Páginas de categoría.
- Footer completo con navegación interna.
- Página de privacidad clara.
- PWA sin cachear archivos del usuario.
- Analítica privacy-friendly.
- Componentes comunes de carga, procesamiento, errores y resultado.
- Pruebas básicas, build en CI y revisión de accesibilidad.

## Cómo añadir una herramienta nueva

1. Añade la definición en `src/data/tools.ts`.
2. Crea la página pública en `src/pages/[lang]/...`.
3. Reutiliza layouts y componentes comunes siempre que sea posible.
4. Mantén el procesamiento en navegador si la herramienta lo permite.
5. Añade textos SEO y mensajes de privacidad claros.
6. Valida casos de error: archivo vacío, formato incorrecto, PDF protegido o documento demasiado grande.
7. Comprueba que funciona en móvil y con teclado.

## Despliegue

El proyecto es estático, por lo que puede desplegarse en GitHub Pages, Cloudflare Pages, Netlify, Vercel o cualquier hosting de archivos estáticos.

Para generar la versión de producción:

```bash
npm run build
```

El resultado se genera en `dist/`.

Si se despliega en GitHub Pages, revisa la configuración de `astro.config.mjs` para asegurar que `site` y, si procede, `base`, coinciden con la URL pública final.

## Criterios de calidad

Antes de abrir una pull request:

- Ejecuta `npm run build`.
- Revisa que no se rompen las rutas localizadas en español e inglés.
- Comprueba la experiencia móvil.
- Evita introducir dependencias pesadas sin justificación.
- No añadas llamadas a APIs externas para procesar archivos privados.
- Documenta cualquier limitación técnica visible para el usuario.

## Contribución

Las contribuciones deben mantener la filosofía del proyecto: herramientas simples, privadas, rápidas y ejecutadas en el navegador cuando sea posible.

Para proponer cambios:

1. Crea una rama con un nombre descriptivo.
2. Haz commits pequeños y claros.
3. Explica en la pull request qué issue resuelve.
4. Incluye capturas si el cambio afecta a la interfaz.
5. Describe cómo se ha probado.

## Licencia

Pendiente de definir. Añade una licencia antes de distribuir el proyecto públicamente como producto reutilizable por terceros.
