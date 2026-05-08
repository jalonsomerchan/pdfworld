<script lang="ts">
  import { saveAs } from 'file-saver';
  import PdfDropzone from './PdfDropzone.svelte';
  import { getPdfPageCount, rotatePdfInBrowser, type RotatePdfResult, type RotationDegrees } from '../lib/pdf/rotatePdf';
  import { pagesToRanges, parsePageRanges, type ParsedPageRange } from '../lib/pdf/pageRanges';

  type Lang = 'es' | 'en';
  type PageMode = 'all' | 'custom';

  export let lang: Lang = 'es';

  const labels = {
    es: {
      eyebrow: 'Procesamiento local',
      title: 'Rota páginas de un PDF',
      description: 'Carga un PDF, elige 90, 180 o 270 grados y aplica la rotación a todo el documento o solo a páginas concretas. El archivo no se sube a ningún servidor.',
      dropTitle: 'Arrastra tu PDF aquí',
      dropActive: 'Suelta el PDF para cargarlo',
      dropText: 'Suelta el archivo o pulsa para seleccionarlo',
      fileHelp: 'Un solo PDF · privado · sin subida · navegador',
      selectedFile: 'Archivo seleccionado',
      pages: 'páginas',
      pageCountLabel: 'Páginas detectadas',
      rotationTitle: 'Grados de rotación',
      pageModeTitle: 'Páginas afectadas',
      allPages: 'Todas las páginas',
      customPages: 'Páginas o rangos concretos',
      rangeLabel: 'Rangos de páginas',
      rangePlaceholder: 'Ejemplo: 1-3,5,8-10',
      rangeHelp: 'Usa comas para separar páginas o rangos. Las páginas se rotarán en el orden original del PDF.',
      summaryTitle: 'Resumen antes de exportar',
      summaryAll: 'Se rotarán todas las páginas del PDF.',
      summaryCustom: 'Se rotarán las páginas seleccionadas.',
      noSummary: 'Selecciona páginas válidas para ver el resumen.',
      rotate: 'Rotar PDF',
      rotating: 'Rotando PDF…',
      download: 'Descargar PDF rotado',
      clear: 'Limpiar',
      originalSize: 'Tamaño original',
      outputSize: 'Tamaño final',
      invalidFile: 'Selecciona un archivo PDF válido.',
      readError: 'No se pudo leer el PDF. Puede estar dañado, protegido o no ser compatible.',
      needFile: 'Primero carga un PDF.',
      needPages: 'Selecciona al menos una página para rotar.',
      badFormat: 'Formato no válido. Usa páginas o rangos como 1-3,5,8-10.',
      invalidNumber: 'Los rangos solo pueden contener números de página mayores que cero.',
      reversedRange: 'El rango {range} no es válido: el inicio debe ser menor o igual que el final.',
      outOfBounds: 'La página {page} está fuera de límite. Este PDF tiene {total} páginas.',
      duplicated: 'La página {page} está repetida. Elimina duplicados para evitar resultados ambiguos.',
      createError: 'No se pudo rotar el PDF. Revisa que el archivo no esté protegido o dañado.',
      loaded: 'PDF cargado correctamente.',
      ready: 'PDF rotado correctamente. Ya puedes descargarlo.',
      outputName: 'pdfworld-rotado.pdf',
    },
    en: {
      eyebrow: 'Local processing',
      title: 'Rotate PDF pages',
      description: 'Load a PDF, choose 90, 180 or 270 degrees and apply the rotation to the whole document or only specific pages. The file is never uploaded to a server.',
      dropTitle: 'Drag your PDF here',
      dropActive: 'Drop the PDF to load it',
      dropText: 'Drop the file or click to select it',
      fileHelp: 'Single PDF · private · no upload · browser',
      selectedFile: 'Selected file',
      pages: 'pages',
      pageCountLabel: 'Detected pages',
      rotationTitle: 'Rotation degrees',
      pageModeTitle: 'Affected pages',
      allPages: 'All pages',
      customPages: 'Specific pages or ranges',
      rangeLabel: 'Page ranges',
      rangePlaceholder: 'Example: 1-3,5,8-10',
      rangeHelp: 'Use commas to separate pages or ranges. Pages will be rotated in the original PDF order.',
      summaryTitle: 'Summary before export',
      summaryAll: 'All PDF pages will be rotated.',
      summaryCustom: 'The selected pages will be rotated.',
      noSummary: 'Select valid pages to see the summary.',
      rotate: 'Rotate PDF',
      rotating: 'Rotating PDF…',
      download: 'Download rotated PDF',
      clear: 'Clear',
      originalSize: 'Original size',
      outputSize: 'Final size',
      invalidFile: 'Select a valid PDF file.',
      readError: 'The PDF could not be read. It may be damaged, protected or unsupported.',
      needFile: 'Load a PDF first.',
      needPages: 'Select at least one page to rotate.',
      badFormat: 'Invalid format. Use pages or ranges such as 1-3,5,8-10.',
      invalidNumber: 'Ranges can only contain page numbers greater than zero.',
      reversedRange: 'Range {range} is invalid: the start must be less than or equal to the end.',
      outOfBounds: 'Page {page} is out of bounds. This PDF has {total} pages.',
      duplicated: 'Page {page} is duplicated. Remove duplicates to avoid ambiguous output.',
      createError: 'The PDF could not be rotated. Check that the file is not protected or damaged.',
      loaded: 'PDF loaded successfully.',
      ready: 'PDF rotated successfully. You can download it now.',
      outputName: 'pdfworld-rotated.pdf',
    },
  } as const;

  const rotationOptions: RotationDegrees[] = [90, 180, 270];

  let file: File | null = null;
  let pageCount = 0;
  let rotation: RotationDegrees = 90;
  let pageMode: PageMode = 'all';
  let rangeInput = '';
  let selectedPages: number[] = [];
  let parsedRanges: ParsedPageRange[] = [];
  let result: RotatePdfResult | null = null;
  let isLoading = false;
  let isRotating = false;
  let errorMessage = '';
  let statusMessage = '';

  $: t = labels[lang] ?? labels.es;
  $: pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  $: effectivePages = pageMode === 'all' ? pageNumbers : selectedPages;
  $: effectiveRanges = pageMode === 'all' ? pagesToRanges(pageNumbers) : parsedRanges;
  $: canRotate = Boolean(file && pageCount > 0 && effectivePages.length > 0 && !errorMessage && !isLoading && !isRotating);

  async function handleDropzoneFiles(files: File[]) {
    await loadFile(files[0] ?? null);
  }

  function handleInvalidFiles() {
    errorMessage = t.invalidFile;
    statusMessage = '';
  }

  async function loadFile(nextFile: File | null) {
    file = nextFile;
    pageCount = 0;
    pageMode = 'all';
    rangeInput = '';
    selectedPages = [];
    parsedRanges = [];
    result = null;
    errorMessage = '';
    statusMessage = '';

    if (!nextFile) return;

    isLoading = true;

    try {
      pageCount = await getPdfPageCount(nextFile);
      selectedPages = Array.from({ length: pageCount }, (_, index) => index + 1);
      parsedRanges = pagesToRanges(selectedPages);
      rangeInput = parsedRanges.map((range) => range.label).join(',');
      statusMessage = `${t.loaded} ${pageCount} ${t.pages}.`;
    } catch {
      file = null;
      pageCount = 0;
      errorMessage = t.readError;
    } finally {
      isLoading = false;
    }
  }

  function handlePageModeChange(nextMode: PageMode) {
    pageMode = nextMode;
    result = null;
    errorMessage = '';
    statusMessage = file && pageCount > 0 ? `${t.pageCountLabel}: ${pageCount}.` : '';

    if (nextMode === 'custom' && selectedPages.length === 0 && pageCount > 0) {
      selectedPages = [...pageNumbers];
      parsedRanges = pagesToRanges(selectedPages);
      rangeInput = parsedRanges.map((range) => range.label).join(',');
    }
  }

  function handleRangeInput(event: Event) {
    rangeInput = (event.currentTarget as HTMLInputElement).value;
    result = null;
    validateRange();
  }

  function validateRange() {
    const rangeMessages = {
      needFile: t.needFile,
      badFormat: t.badFormat,
      invalidNumber: t.invalidNumber,
      reversedRange: t.reversedRange,
      outOfBounds: t.outOfBounds,
      duplicated: t.duplicated,
    };
    const parsed = parsePageRanges(rangeInput, pageCount, rangeMessages);
    selectedPages = parsed.pages;
    parsedRanges = parsed.ranges;
    errorMessage = parsed.error;
    statusMessage = file && pageCount > 0 ? `${t.pageCountLabel}: ${pageCount}.` : '';
  }

  async function rotatePdf() {
    if (!file) {
      errorMessage = t.needFile;
      return;
    }

    if (effectivePages.length === 0) {
      errorMessage = t.needPages;
      return;
    }

    isRotating = true;
    errorMessage = '';
    statusMessage = '';
    result = null;

    try {
      result = await rotatePdfInBrowser({ file, pages: effectivePages, rotation });
      statusMessage = t.ready;
    } catch {
      errorMessage = t.createError;
    } finally {
      isRotating = false;
    }
  }

  function downloadRotatedPdf() {
    if (!result) return;
    saveAs(new Blob([result.bytes], { type: 'application/pdf' }), getOutputName());
  }

  function clearTool() {
    file = null;
    pageCount = 0;
    rotation = 90;
    pageMode = 'all';
    rangeInput = '';
    selectedPages = [];
    parsedRanges = [];
    result = null;
    isLoading = false;
    isRotating = false;
    errorMessage = '';
    statusMessage = '';
  }

  function getOutputName() {
    if (!file?.name) return t.outputName;
    const baseName = file.name.replace(/\.pdf$/i, '').trim() || 'documento';
    return `${baseName}-rotado.pdf`;
  }

  function formatSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
</script>

<section class="rotate-tool" aria-labelledby="rotate-tool-title">
  <div class="rotate-tool__hero-card">
    <div class="rotate-tool__intro">
      <span class="rotate-tool__eyebrow">{t.eyebrow}</span>
      <h2 id="rotate-tool-title">{t.title}</h2>
      <p>{t.description}</p>
    </div>

    <PdfDropzone
      title={t.dropTitle}
      activeTitle={t.dropActive}
      subtitle={t.dropText}
      help={t.fileHelp}
      selectedLabel={file?.name ?? ''}
      onFiles={handleDropzoneFiles}
      onInvalidFiles={handleInvalidFiles}
    />
  </div>

  {#if errorMessage}
    <div class="rotate-tool__alert rotate-tool__alert--error" role="alert">{errorMessage}</div>
  {/if}

  {#if statusMessage}
    <div class="rotate-tool__alert rotate-tool__alert--success" role="status">{statusMessage}</div>
  {/if}

  {#if isLoading}
    <div class="rotate-tool__alert" role="status">Cargando PDF…</div>
  {/if}

  {#if file && pageCount > 0}
    <div class="rotate-tool__workspace">
      <section class="rotate-tool__file-card" aria-labelledby="rotate-file-title">
        <span class="rotate-tool__file-icon" aria-hidden="true">PDF</span>
        <div>
          <h3 id="rotate-file-title">{t.selectedFile}</h3>
          <strong>{file.name}</strong>
          <p>{formatSize(file.size)} · {pageCount} {t.pages}</p>
        </div>
      </section>

      <section class="rotate-tool__card" aria-labelledby="rotate-degrees-title">
        <h3 id="rotate-degrees-title">{t.rotationTitle}</h3>
        <div class="rotate-tool__degrees" role="radiogroup" aria-labelledby="rotate-degrees-title">
          {#each rotationOptions as option}
            <label class:rotate-tool__degree={true} class:rotate-tool__degree--selected={rotation === option}>
              <input type="radio" bind:group={rotation} value={option} disabled={isRotating} on:change={() => (result = null)} />
              <span>{option}°</span>
            </label>
          {/each}
        </div>
      </section>

      <section class="rotate-tool__card" aria-labelledby="rotate-pages-title">
        <h3 id="rotate-pages-title">{t.pageModeTitle}</h3>
        <div class="rotate-tool__modes" role="radiogroup" aria-labelledby="rotate-pages-title">
          <label class:rotate-tool__mode={true} class:rotate-tool__mode--selected={pageMode === 'all'}>
            <input type="radio" name="page-mode" checked={pageMode === 'all'} on:change={() => handlePageModeChange('all')} disabled={isRotating} />
            <span>{t.allPages}</span>
          </label>
          <label class:rotate-tool__mode={true} class:rotate-tool__mode--selected={pageMode === 'custom'}>
            <input type="radio" name="page-mode" checked={pageMode === 'custom'} on:change={() => handlePageModeChange('custom')} disabled={isRotating} />
            <span>{t.customPages}</span>
          </label>
        </div>

        {#if pageMode === 'custom'}
          <div class="rotate-tool__field">
            <label for="rotate-ranges">{t.rangeLabel}</label>
            <input
              id="rotate-ranges"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              value={rangeInput}
              placeholder={t.rangePlaceholder}
              aria-describedby="rotate-ranges-help"
              aria-invalid={Boolean(errorMessage)}
              on:input={handleRangeInput}
            />
            <p id="rotate-ranges-help">{t.rangeHelp}</p>
          </div>
        {/if}
      </section>

      <section class="rotate-tool__summary" aria-labelledby="rotate-summary-title" aria-live="polite">
        <h3 id="rotate-summary-title">{t.summaryTitle}</h3>
        {#if effectivePages.length > 0}
          <p>{pageMode === 'all' ? t.summaryAll : t.summaryCustom}</p>
          <div class="rotate-tool__chips" aria-label={t.summaryTitle}>
            <span>{rotation}°</span>
            {#each effectiveRanges as range}
              <span>{range.label}</span>
            {/each}
          </div>
        {:else}
          <p>{t.noSummary}</p>
        {/if}
      </section>

      <section class="rotate-tool__metrics" aria-labelledby="rotate-metrics-title">
        <h3 id="rotate-metrics-title">Resultado</h3>
        <div>
          <span>{t.originalSize}</span>
          <strong>{formatSize(file.size)}</strong>
        </div>
        <div>
          <span>{t.outputSize}</span>
          <strong>{result ? formatSize(result.outputSize) : '—'}</strong>
        </div>
      </section>

      <div class="rotate-tool__actions">
        <button type="button" class="rotate-tool__secondary" on:click={clearTool} disabled={isRotating}>{t.clear}</button>
        <button type="button" class="rotate-tool__primary" on:click={rotatePdf} disabled={!canRotate}>
          {isRotating ? t.rotating : t.rotate}
        </button>
        <button type="button" class="rotate-tool__primary rotate-tool__primary--dark" on:click={downloadRotatedPdf} disabled={!result || isRotating}>
          {t.download}
        </button>
      </div>
    </div>
  {/if}
</section>

<style>
  .rotate-tool {
    display: grid;
    gap: 20px;
    margin: 32px 0 64px;
  }

  .rotate-tool__hero-card,
  .rotate-tool__workspace,
  .rotate-tool__file-card,
  .rotate-tool__card,
  .rotate-tool__summary,
  .rotate-tool__metrics,
  .rotate-tool__alert {
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  }

  .rotate-tool__hero-card {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.95fr);
    gap: 20px;
    align-items: center;
    padding: 24px;
    border-radius: 32px;
    background:
      radial-gradient(circle at top right, rgba(59, 130, 246, 0.15), transparent 34%),
      linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(248, 250, 252, 0.9));
  }

  .rotate-tool__intro h2 {
    margin: 0 0 8px;
    letter-spacing: -0.04em;
  }

  .rotate-tool__intro p,
  .rotate-tool__file-card p,
  .rotate-tool__field p,
  .rotate-tool__summary p {
    margin: 0;
    color: #64748b;
  }

  .rotate-tool__eyebrow {
    display: inline-flex;
    margin-bottom: 10px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #dbeafe;
    color: #1d4ed8;
    font-size: 0.8rem;
    font-weight: 900;
  }

  .rotate-tool__alert {
    padding: 16px 18px;
    color: #475569;
    font-weight: 850;
  }

  .rotate-tool__alert--error {
    border-color: #fecaca;
    background: #fff1f2;
    color: #991b1b;
  }

  .rotate-tool__alert--success {
    border-color: #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .rotate-tool__workspace {
    display: grid;
    grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.28fr);
    gap: 18px;
    padding: 18px;
  }

  .rotate-tool__file-card,
  .rotate-tool__card,
  .rotate-tool__summary,
  .rotate-tool__metrics {
    padding: 18px;
  }

  .rotate-tool__card,
  .rotate-tool__summary,
  .rotate-tool__metrics,
  .rotate-tool__actions {
    grid-column: 1 / -1;
  }

  .rotate-tool__file-card {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .rotate-tool__file-card h3,
  .rotate-tool__card h3,
  .rotate-tool__summary h3,
  .rotate-tool__metrics h3 {
    margin: 0 0 12px;
  }

  .rotate-tool__file-card strong {
    display: block;
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rotate-tool__file-icon {
    display: grid;
    width: 52px;
    height: 64px;
    place-items: center;
    border-radius: 16px;
    background: #eff6ff;
    color: #2563eb;
    font-size: 0.75rem;
    font-weight: 950;
    box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.15);
  }

  .rotate-tool__degrees,
  .rotate-tool__modes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .rotate-tool__modes {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-bottom: 16px;
  }

  .rotate-tool__degree,
  .rotate-tool__mode {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 14px;
    border: 2px solid #e2e8f0;
    border-radius: 18px;
    background: #fff;
    cursor: pointer;
    font-weight: 950;
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .rotate-tool__degree:hover,
  .rotate-tool__mode:hover {
    transform: translateY(-1px);
  }

  .rotate-tool__degree--selected,
  .rotate-tool__mode--selected {
    border-color: #2563eb;
    background: #eff6ff;
    color: #1d4ed8;
    box-shadow: 0 16px 34px rgba(37, 99, 235, 0.14);
  }

  .rotate-tool__field {
    display: grid;
    gap: 8px;
  }

  .rotate-tool__field label {
    color: #0f172a;
    font-weight: 950;
  }

  .rotate-tool__field input {
    width: 100%;
    min-height: 52px;
    box-sizing: border-box;
    border: 2px solid #e2e8f0;
    border-radius: 18px;
    background: #fff;
    color: #0f172a;
    font: inherit;
    font-size: 1.08rem;
    font-weight: 850;
    padding: 12px 14px;
  }

  .rotate-tool__field input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
    outline: none;
  }

  .rotate-tool__field input[aria-invalid='true'] {
    border-color: #ef4444;
  }

  .rotate-tool__summary {
    display: grid;
    gap: 10px;
  }

  .rotate-tool__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .rotate-tool__chips span {
    display: inline-flex;
    padding: 7px 10px;
    border-radius: 999px;
    background: #dbeafe;
    color: #1d4ed8;
    font-weight: 950;
  }

  .rotate-tool__metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .rotate-tool__metrics h3 {
    grid-column: 1 / -1;
  }

  .rotate-tool__metrics div {
    display: grid;
    gap: 6px;
    padding: 14px;
    border-radius: 18px;
    background: #f8fafc;
  }

  .rotate-tool__metrics span {
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 850;
    text-transform: uppercase;
  }

  .rotate-tool__metrics strong {
    color: #0f172a;
    font-size: 1.15rem;
  }

  .rotate-tool__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
  }

  .rotate-tool__primary,
  .rotate-tool__secondary {
    min-height: 46px;
    padding: 12px 16px;
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-weight: 950;
    transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
  }

  .rotate-tool__primary {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #fff;
    box-shadow: 0 16px 34px rgba(37, 99, 235, 0.24);
  }

  .rotate-tool__primary--dark {
    background: linear-gradient(135deg, #0f172a, #334155);
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.22);
  }

  .rotate-tool__secondary {
    background: #e2e8f0;
    color: #334155;
  }

  .rotate-tool__primary:hover:not(:disabled),
  .rotate-tool__secondary:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .rotate-tool__primary:disabled,
  .rotate-tool__secondary:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @media (prefers-reduced-motion: reduce) {
    .rotate-tool__degree,
    .rotate-tool__mode,
    .rotate-tool__primary,
    .rotate-tool__secondary {
      transition: none;
    }
  }

  @media (max-width: 760px) {
    .rotate-tool__hero-card,
    .rotate-tool__workspace,
    .rotate-tool__degrees,
    .rotate-tool__modes,
    .rotate-tool__metrics {
      grid-template-columns: 1fr;
    }

    .rotate-tool__hero-card {
      padding: 18px;
      border-radius: 24px;
    }

    .rotate-tool__actions {
      justify-content: stretch;
    }

    .rotate-tool__primary,
    .rotate-tool__secondary {
      flex: 1 1 180px;
    }
  }
</style>
