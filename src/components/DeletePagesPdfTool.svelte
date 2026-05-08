<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfPageCard from './PdfPageCard.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, formatFileSize, yieldToBrowser } from '../lib/pdfToolUtils';
  import { deletePagesFromPdfInBrowser, getPdfPageCount, type DeletePagesPdfResult } from '../lib/pdf/deletePagesPdf';
  import { pagesToRanges, parsePageRanges, type ParsedPageRange } from '../lib/pdf/pageRanges';

  type Lang = 'es' | 'en';

  export let lang: Lang = 'es';

  const labels = {
    es: {
      eyebrow: 'Procesamiento local',
      title: 'Elimina páginas de un PDF',
      description: 'Carga un PDF, indica páginas o rangos a eliminar y descarga una copia nueva sin modificar el archivo original.',
      dropTitle: 'Arrastra tu PDF aquí',
      dropActive: 'Suelta el PDF para cargarlo',
      dropText: 'Suelta el archivo o pulsa para seleccionarlo',
      fileHelp: 'Un solo PDF · privado · sin subida · navegador',
      selectedFile: 'Archivo seleccionado',
      pages: 'páginas',
      pageCountLabel: 'Páginas detectadas',
      rangeLabel: 'Páginas a eliminar',
      rangePlaceholder: 'Ejemplo: 2,4-6',
      rangeHelp: 'Usa comas para separar páginas o rangos. No se puede eliminar todo el documento.',
      summaryTitle: 'Resumen antes de generar',
      deleteSummary: 'Se eliminarán estas páginas',
      keepSummary: 'Se conservarán',
      noSummary: 'Introduce páginas o rangos válidos para ver el resumen.',
      invalidFile: 'Selecciona un archivo PDF válido.',
      readError: 'No se pudo leer el PDF. Puede estar dañado, protegido o no ser compatible.',
      loaded: 'PDF cargado correctamente.',
      needFile: 'Primero carga un PDF.',
      needPages: 'Introduce al menos una página para eliminar.',
      deleteAll: 'No puedes eliminar todas las páginas. El PDF resultante debe conservar al menos una página.',
      badFormat: 'Formato no válido. Usa páginas o rangos como 2,4-6.',
      invalidNumber: 'Los rangos solo pueden contener números de página mayores que cero.',
      reversedRange: 'El rango {range} no es válido: el inicio debe ser menor o igual que el final.',
      outOfBounds: 'La página {page} está fuera de límite. Este PDF tiene {total} páginas.',
      duplicated: 'La página {page} está repetida. Elimina duplicados para evitar resultados ambiguos.',
      createError: 'No se pudo generar el PDF. Revisa que el archivo no esté protegido o dañado.',
      ready: 'PDF generado correctamente. La descarga debería comenzar automáticamente.',
      deleting: 'Generando PDF…',
      deleteButton: 'Eliminar páginas y descargar',
      downloadAgain: 'Descargar otra vez',
      open: 'Abrir en pestaña',
      close: 'Cerrar',
      clear: 'Limpiar',
      originalSize: 'Tamaño original',
      outputSize: 'Tamaño final',
      outputPages: 'Páginas finales',
      outputName: 'pdfworld-paginas-eliminadas.pdf',
    },
    en: {
      eyebrow: 'Local processing',
      title: 'Delete pages from a PDF',
      description: 'Load a PDF, enter pages or ranges to delete and download a new copy without changing the original file.',
      dropTitle: 'Drag your PDF here',
      dropActive: 'Drop the PDF to load it',
      dropText: 'Drop the file or click to select it',
      fileHelp: 'Single PDF · private · no upload · browser',
      selectedFile: 'Selected file',
      pages: 'pages',
      pageCountLabel: 'Detected pages',
      rangeLabel: 'Pages to delete',
      rangePlaceholder: 'Example: 2,4-6',
      rangeHelp: 'Use commas to separate pages or ranges. You cannot delete the whole document.',
      summaryTitle: 'Summary before generating',
      deleteSummary: 'These pages will be deleted',
      keepSummary: 'Will be kept',
      noSummary: 'Enter valid pages or ranges to see the summary.',
      invalidFile: 'Select a valid PDF file.',
      readError: 'The PDF could not be read. It may be damaged, protected or unsupported.',
      loaded: 'PDF loaded successfully.',
      needFile: 'Load a PDF first.',
      needPages: 'Enter at least one page to delete.',
      deleteAll: 'You cannot delete every page. The resulting PDF must keep at least one page.',
      badFormat: 'Invalid format. Use pages or ranges such as 2,4-6.',
      invalidNumber: 'Ranges can only contain page numbers greater than zero.',
      reversedRange: 'Range {range} is invalid: the start must be less than or equal to the end.',
      outOfBounds: 'Page {page} is out of bounds. This PDF has {total} pages.',
      duplicated: 'Page {page} is duplicated. Remove duplicates to avoid ambiguous output.',
      createError: 'The PDF could not be generated. Check that the file is not protected or damaged.',
      ready: 'PDF created successfully. The download should start automatically.',
      deleting: 'Generating PDF…',
      deleteButton: 'Delete pages and download',
      downloadAgain: 'Download again',
      open: 'Open in tab',
      close: 'Close',
      clear: 'Clear',
      originalSize: 'Original size',
      outputSize: 'Final size',
      outputPages: 'Final pages',
      outputName: 'pdfworld-deleted-pages.pdf',
    },
  } as const;

  let file: File | null = null;
  let pageCount = 0;
  let rangeInput = '';
  let pagesToDelete: number[] = [];
  let deleteRanges: ParsedPageRange[] = [];
  let result: DeletePagesPdfResult | null = null;
  let isLoading = false;
  let isGenerating = false;
  let errorMessage = '';
  let statusMessage = '';
  let resultUrl = '';
  let workspaceRegion: HTMLDivElement;
  let thumbUrls: Record<number, string> = {};
  let thumbStatus: Record<number, 'pending' | 'ready' | 'failed'> = {};
  let pdfJsPromise: Promise<any> | null = null;
  let previewDoc: any = null;
  let renderToken = 0;

  $: t = labels[lang] ?? labels.es;
  $: keptPages = pageCount > 0 ? Array.from({ length: pageCount }, (_, index) => index + 1).filter((page) => !pagesToDelete.includes(page)) : [];
  $: keptRanges = pagesToRanges(keptPages);
  $: canGenerate = Boolean(file && pagesToDelete.length > 0 && keptPages.length > 0 && !errorMessage && !isLoading && !isGenerating);

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
    renderToken += 1;
    cleanupThumbnails();
    void destroyPreviewDoc();
    rangeInput = '';
    pagesToDelete = [];
    deleteRanges = [];
    result = null;
    cleanupResultUrl();
    errorMessage = '';
    statusMessage = '';

    if (!nextFile) return;

    isLoading = true;

    try {
      pageCount = await getPdfPageCount(nextFile);
      thumbStatus = Object.fromEntries(Array.from({ length: pageCount }, (_, index) => [index + 1, 'pending']));
      statusMessage = `${t.loaded} ${pageCount} ${t.pages}.`;
      void renderThumbnails(nextFile);
      await scrollToWorkspace();
    } catch {
      file = null;
      pageCount = 0;
      errorMessage = t.readError;
    } finally {
      isLoading = false;
    }
  }

  function handleRangeInput(event: Event) {
    rangeInput = (event.currentTarget as HTMLInputElement).value;
    result = null;
    validateRanges();
  }

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')]).then(([pdfJs, worker]) => {
        pdfJs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfJs;
      });
    }

    return pdfJsPromise;
  }

  async function renderThumbnails(sourceFile: File) {
    const token = ++renderToken;

    try {
      const pdfJs = await loadPdfJs();
      const bytes = new Uint8Array((await sourceFile.arrayBuffer()).slice(0));
      previewDoc = await pdfJs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, disableAutoFetch: true, disableStream: true }).promise;

      for (let page = 1; page <= previewDoc.numPages; page += 1) {
        if (token !== renderToken || !previewDoc) return;
        await yieldToBrowser();

        try {
          const pdfPage = await previewDoc.getPage(page);
          const url = await renderThumb(pdfPage);
          pdfPage.cleanup();

          if (token !== renderToken) {
            URL.revokeObjectURL(url);
            return;
          }

          if (thumbUrls[page]) URL.revokeObjectURL(thumbUrls[page]);
          thumbUrls = { ...thumbUrls, [page]: url };
          thumbStatus = { ...thumbStatus, [page]: 'ready' };
        } catch {
          thumbStatus = { ...thumbStatus, [page]: 'failed' };
        }
      }
    } catch {
      thumbStatus = Object.fromEntries(Array.from({ length: pageCount }, (_, index) => [index + 1, 'failed']));
    }
  }

  async function renderThumb(pdfPage: any) {
    const viewport = pdfPage.getViewport({ scale: 0.24 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('No canvas context');

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.76));
    if (!blob) throw new Error('No thumbnail blob');
    return URL.createObjectURL(blob);
  }

  function togglePageDelete(page: number) {
    if (pagesToDelete.includes(page)) {
      pagesToDelete = pagesToDelete.filter((item) => item !== page);
    } else {
      pagesToDelete = [...pagesToDelete, page].sort((a, b) => a - b);
    }

    rangeInput = pagesToRanges(pagesToDelete).map((range) => range.label).join(',');
    result = null;
    cleanupResultUrl();
    validateRanges();
  }

  function validateRanges() {
    const parsed = parsePageRanges(rangeInput, pageCount, {
      needFile: t.needFile,
      badFormat: t.badFormat,
      invalidNumber: t.invalidNumber,
      reversedRange: t.reversedRange,
      outOfBounds: t.outOfBounds,
      duplicated: t.duplicated,
    });

    pagesToDelete = parsed.pages;
    deleteRanges = parsed.ranges;
    errorMessage = parsed.error;
    statusMessage = file && pageCount > 0 ? `${t.pageCountLabel}: ${pageCount}.` : '';

    if (!errorMessage && pagesToDelete.length > 0 && pagesToDelete.length >= pageCount) {
      errorMessage = t.deleteAll;
    }
  }

  async function generatePdf() {
    if (!file) {
      errorMessage = t.needFile;
      return;
    }

    if (pagesToDelete.length === 0) {
      errorMessage = t.needPages;
      return;
    }

    if (keptPages.length === 0) {
      errorMessage = t.deleteAll;
      return;
    }

    isGenerating = true;
    errorMessage = '';
    statusMessage = '';
    result = null;

    try {
      const nextResult = await deletePagesFromPdfInBrowser({ file, pagesToDelete });
      result = nextResult;
      resultUrl = createPdfObjectUrl(nextResult.bytes);
      statusMessage = t.ready;
    } catch {
      errorMessage = t.createError;
    } finally {
      isGenerating = false;
    }
  }

  function downloadAgain() {
    if (!result) return;
    cleanupResultUrl();
    resultUrl = createPdfObjectUrl(result.bytes);
  }

  function clearTool() {
    file = null;
    pageCount = 0;
    renderToken += 1;
    cleanupThumbnails();
    void destroyPreviewDoc();
    rangeInput = '';
    pagesToDelete = [];
    deleteRanges = [];
    result = null;
    cleanupResultUrl();
    isLoading = false;
    isGenerating = false;
    errorMessage = '';
    statusMessage = '';
  }

  function outputName() {
    if (!file?.name) return t.outputName;
    return `${(file.name.replace(/\.pdf$/i, '').trim() || 'documento')}-sin-paginas.pdf`;
  }

  function formatSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    return formatFileSize(bytes);
  }

  function cleanupResultUrl() {
    if (!resultUrl) return;
    URL.revokeObjectURL(resultUrl);
    resultUrl = '';
  }

  async function scrollToWorkspace() {
    await tick();
    workspaceRegion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cleanupThumbnails() {
    Object.values(thumbUrls).forEach((url) => URL.revokeObjectURL(url));
    thumbUrls = {};
    thumbStatus = {};
  }

  async function destroyPreviewDoc() {
    if (!previewDoc) return;
    try {
      await previewDoc.destroy();
    } catch {
      // pdf.js can throw if already destroyed.
    } finally {
      previewDoc = null;
    }
  }

  onDestroy(() => {
    renderToken += 1;
    cleanupResultUrl();
    cleanupThumbnails();
    void destroyPreviewDoc();
  });
</script>

<section class="delete-pages" aria-labelledby="delete-pages-title">
  <div class="delete-pages__hero">
    <div>
      <span class="delete-pages__eyebrow">{t.eyebrow}</span>
      <h2 id="delete-pages-title">{t.title}</h2>
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
    <div class="delete-pages__alert delete-pages__alert--error" role="alert">{errorMessage}</div>
  {/if}

  {#if statusMessage}
    <div class="delete-pages__alert delete-pages__alert--success" role="status">{statusMessage}</div>
  {/if}

  {#if isLoading}
    <div class="delete-pages__alert" role="status">Cargando PDF…</div>
  {/if}

  {#if file && pageCount > 0}
    <div class="delete-pages__workspace" bind:this={workspaceRegion}>
      <section class="delete-pages__file-card" aria-labelledby="delete-file-title">
        <span class="delete-pages__file-icon" aria-hidden="true">PDF</span>
        <div>
          <h3 id="delete-file-title">{t.selectedFile}</h3>
          <strong>{file.name}</strong>
          <p>{formatSize(file.size)} · {pageCount} {t.pages}</p>
        </div>
      </section>

      <section class="delete-pages__card" aria-labelledby="delete-range-title">
        <div class="delete-pages__field">
          <label id="delete-range-title" for="delete-ranges">{t.rangeLabel}</label>
          <input
            id="delete-ranges"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            spellcheck="false"
            value={rangeInput}
            placeholder={t.rangePlaceholder}
            aria-describedby="delete-ranges-help"
            aria-invalid={Boolean(errorMessage)}
            on:input={handleRangeInput}
          />
          <p id="delete-ranges-help">{t.rangeHelp}</p>
        </div>
      </section>

      <section class="delete-pages__summary" aria-labelledby="delete-summary-title" aria-live="polite">
        <h3 id="delete-summary-title">{t.summaryTitle}</h3>
        <div class="delete-pages__page-grid" aria-label={t.rangeLabel}>
          {#each Array.from({ length: pageCount }, (_, index) => index + 1) as page}
            <PdfPageCard
              pageNumber={page}
              title={`Página ${page}`}
              thumbnailUrl={thumbUrls[page] ?? ''}
              thumbnailStatus={thumbStatus[page] ?? 'pending'}
              selected={pagesToDelete.includes(page)}
              removed={!pagesToDelete.includes(page)}
              rotation={0}
              selectLabel={t.rangeLabel}
              showRotate={false}
              removeLabel="Conservar"
              restoreLabel="Eliminar"
              onToggle={() => togglePageDelete(page)}
              onRemove={() => togglePageDelete(page)}
            />
          {/each}
        </div>
        {#if pagesToDelete.length > 0 && !errorMessage}
          <div class="delete-pages__summary-grid">
            <div>
              <strong>{t.deleteSummary}</strong>
              <div class="delete-pages__chips">
                {#each deleteRanges as range}
                  <span class="delete-pages__chip delete-pages__chip--danger">{range.label}</span>
                {/each}
              </div>
            </div>
            <div>
              <strong>{t.keepSummary}</strong>
              <div class="delete-pages__chips">
                {#each keptRanges as range}
                  <span class="delete-pages__chip">{range.label}</span>
                {/each}
              </div>
            </div>
          </div>
        {:else}
          <p>{t.noSummary}</p>
        {/if}
      </section>

      <section class="delete-pages__metrics" aria-labelledby="delete-metrics-title">
        <h3 id="delete-metrics-title">Resultado</h3>
        <div>
          <span>{t.originalSize}</span>
          <strong>{formatSize(file.size)}</strong>
        </div>
        <div>
          <span>{t.outputPages}</span>
          <strong>{keptPages.length || '—'}</strong>
        </div>
        <div>
          <span>{t.outputSize}</span>
          <strong>{result ? formatSize(result.outputSize) : '—'}</strong>
        </div>
      </section>

      <div class="delete-pages__actions">
        <button type="button" class="delete-pages__secondary" on:click={clearTool} disabled={isGenerating}>{t.clear}</button>
        <button type="button" class="delete-pages__primary" on:click={generatePdf} disabled={!canGenerate}>
          {isGenerating ? t.deleting : t.deleteButton}
        </button>
        <button type="button" class="delete-pages__primary delete-pages__primary--dark" on:click={downloadAgain} disabled={!result || isGenerating}>{t.downloadAgain}</button>
      </div>
    </div>
  {/if}

  <PdfResultModal
    open={Boolean(resultUrl)}
    pdfUrl={resultUrl}
    filename={outputName()}
    title={t.downloadAgain}
    description={t.ready}
    downloadLabel={t.downloadAgain}
    openLabel={t.open}
    closeLabel={t.close}
    on:close={cleanupResultUrl}
  />
</section>

<style>
  .delete-pages { display: grid; gap: 20px; margin: 32px 0 64px; }
  .delete-pages__hero, .delete-pages__workspace, .delete-pages__file-card, .delete-pages__card, .delete-pages__summary, .delete-pages__metrics, .delete-pages__alert { border: 1px solid #e2e8f0; border-radius: 24px; background: rgba(255, 255, 255, 0.9); box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08); }
  .delete-pages__hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.95fr); gap: 20px; align-items: center; padding: 24px; border-radius: 32px; background: radial-gradient(circle at top right, rgba(239, 68, 68, 0.15), transparent 34%), linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(248, 250, 252, 0.9)); }
  .delete-pages__hero h2 { margin: 0 0 8px; letter-spacing: -0.04em; }
  .delete-pages__hero p, .delete-pages__file-card p, .delete-pages__field p, .delete-pages__summary p { margin: 0; color: #64748b; }
  .delete-pages__eyebrow { display: inline-flex; margin-bottom: 10px; padding: 6px 10px; border-radius: 999px; background: #fee2e2; color: #991b1b; font-size: 0.8rem; font-weight: 900; }
  .delete-pages__alert { padding: 16px 18px; color: #475569; font-weight: 850; }
  .delete-pages__alert--error { border-color: #fecaca; background: #fff1f2; color: #991b1b; }
  .delete-pages__alert--success { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
  .delete-pages__workspace { display: grid; grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.28fr); gap: 18px; padding: 18px; }
  .delete-pages__file-card, .delete-pages__card, .delete-pages__summary, .delete-pages__metrics { padding: 18px; }
  .delete-pages__card, .delete-pages__summary, .delete-pages__metrics, .delete-pages__actions { grid-column: 1 / -1; }
  .delete-pages__file-card { display: flex; gap: 14px; align-items: flex-start; }
  .delete-pages__file-card h3, .delete-pages__summary h3, .delete-pages__metrics h3 { margin: 0 0 12px; }
  .delete-pages__file-card strong { display: block; overflow: hidden; max-width: 100%; text-overflow: ellipsis; white-space: nowrap; }
  .delete-pages__file-icon { display: grid; width: 52px; height: 64px; place-items: center; border-radius: 16px; background: #fff1f2; color: #dc2626; font-size: 0.75rem; font-weight: 950; box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.14); }
  .delete-pages__field { display: grid; gap: 8px; }
  .delete-pages__field label { color: #0f172a; font-weight: 950; }
  .delete-pages__field input { width: 100%; min-height: 52px; box-sizing: border-box; border: 2px solid #e2e8f0; border-radius: 18px; background: #fff; color: #0f172a; font: inherit; font-size: 1.08rem; font-weight: 850; padding: 12px 14px; }
  .delete-pages__field input:focus { border-color: #ef4444; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12); outline: none; }
  .delete-pages__field input[aria-invalid='true'] { border-color: #ef4444; }
  .delete-pages__summary { display: grid; gap: 12px; }
  .delete-pages__summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .delete-pages__page-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 12px; }
  .delete-pages__page { display: grid; gap: 8px; padding: 10px; border: 2px solid #e2e8f0; border-radius: 18px; background: #fff; color: #0f172a; text-align: left; cursor: pointer; font: inherit; font-weight: 900; box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05); transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease; }
  .delete-pages__page:hover { transform: translateY(-1px); }
  .delete-pages__page--selected { border-color: #ef4444; background: #fff1f2; color: #991b1b; box-shadow: 0 16px 34px rgba(239, 68, 68, 0.15); }
  .delete-pages__thumb { display: grid; min-height: 146px; place-items: center; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 14px; background: #f8fafc; color: #94a3b8; }
  .delete-pages__thumb img { display: block; width: 100%; height: auto; }
  .delete-pages__page small { color: #64748b; text-transform: uppercase; font-size: 0.72rem; }
  .delete-pages__summary-grid > div { display: grid; gap: 10px; padding: 14px; border-radius: 18px; background: #f8fafc; }
  .delete-pages__chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .delete-pages__chip { display: inline-flex; padding: 7px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-weight: 950; }
  .delete-pages__chip--danger { background: #fee2e2; color: #991b1b; }
  .delete-pages__metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .delete-pages__metrics h3 { grid-column: 1 / -1; }
  .delete-pages__metrics div { display: grid; gap: 6px; padding: 14px; border-radius: 18px; background: #f8fafc; }
  .delete-pages__metrics span { color: #64748b; font-size: 0.78rem; font-weight: 850; text-transform: uppercase; }
  .delete-pages__metrics strong { color: #0f172a; font-size: 1.15rem; }
  .delete-pages__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; }
  .delete-pages__primary, .delete-pages__secondary { min-height: 46px; padding: 12px 16px; border: 0; border-radius: 999px; cursor: pointer; font: inherit; font-weight: 950; transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease; }
  .delete-pages__primary { background: linear-gradient(135deg, #ef4444, #b91c1c); color: #fff; box-shadow: 0 16px 34px rgba(239, 68, 68, 0.24); }
  .delete-pages__primary--dark { background: linear-gradient(135deg, #0f172a, #334155); box-shadow: 0 16px 34px rgba(15, 23, 42, 0.22); }
  .delete-pages__secondary { background: #e2e8f0; color: #334155; }
  .delete-pages__primary:hover:not(:disabled), .delete-pages__secondary:hover:not(:disabled) { transform: translateY(-1px); }
  .delete-pages__primary:disabled, .delete-pages__secondary:disabled { cursor: not-allowed; opacity: 0.45; }
  @media (prefers-reduced-motion: reduce) { .delete-pages__primary, .delete-pages__secondary { transition: none; } }
  @media (max-width: 760px) { .delete-pages__hero, .delete-pages__workspace, .delete-pages__summary-grid, .delete-pages__metrics { grid-template-columns: 1fr; } .delete-pages__hero { padding: 18px; border-radius: 24px; } .delete-pages__actions { justify-content: stretch; } .delete-pages__primary, .delete-pages__secondary { flex: 1 1 180px; } }
</style>
