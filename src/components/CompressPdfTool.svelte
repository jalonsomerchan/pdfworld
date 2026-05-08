<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, formatFileSize, yieldToBrowser } from '../lib/pdfToolUtils';
  import {
    compressPdfInBrowser,
    compressionPresets,
    type CompressionLevel,
    type CompressionProgress,
    type CompressionResult,
  } from '../lib/pdf/compressPdf';

  type Lang = 'es' | 'en';

  export let lang: Lang = 'es';

  const labels = {
    es: {
      eyebrow: 'Compresión local con pérdida',
      title: 'Comprime PDF en el navegador',
      description: 'Convierte cada página en una imagen optimizada y reconstruye un PDF más ligero. Funciona mejor con PDFs escaneados o muy visuales.',
      dropTitle: 'Arrastra tu PDF aquí',
      dropActive: 'Suelta el PDF para comprimirlo',
      dropText: 'Suelta el archivo o pulsa para seleccionarlo',
      fileHelp: 'Un solo PDF · sin subida · procesamiento local',
      selectedFile: 'Archivo seleccionado',
      originalSize: 'Tamaño original',
      compressedSize: 'Tamaño comprimido',
      reduction: 'Reducción',
      noResult: 'Comprime el PDF para ver el tamaño final.',
      qualityTitle: 'Nivel de compresión',
      soft: 'Suave',
      recommended: 'Recomendado',
      maximum: 'Máximo',
      softDescription: 'Mejor calidad visual, menor reducción de peso.',
      recommendedDescription: 'Buen equilibrio entre calidad visual y tamaño final.',
      maximumDescription: 'Más compresión, más pérdida de detalle.',
      warningTitle: 'Aviso importante',
      warningText: 'Esta técnica rasteriza las páginas: el resultado puede perder nitidez, enlaces, formularios, capas, vectores y texto seleccionable. Para documentos con mucho texto puede incluso aumentar el tamaño.',
      compress: 'Comprimir PDF',
      compressing: 'Comprimiendo…',
      download: 'Descargar PDF comprimido',
      open: 'Abrir en pestaña',
      close: 'Cerrar',
      clear: 'Limpiar',
      invalidFile: 'Selecciona un archivo PDF válido.',
      needFile: 'Primero carga un PDF.',
      createError: 'No se pudo comprimir el PDF. Puede estar protegido, dañado o ser demasiado grande para procesarlo en el navegador.',
      notReduced: 'El PDF generado no pesa menos que el original. Prueba el nivel máximo o conserva el archivo original.',
      ready: 'PDF comprimido correctamente.',
      loading: 'Cargando PDF…',
      rendering: 'Renderizando página',
      building: 'Reconstruyendo página',
      saving: 'Guardando PDF…',
      pages: 'páginas',
      page: 'Página',
      pageEditor: 'Páginas que se comprimirán',
      rotateLeft: 'Girar izquierda',
      rotateRight: 'Girar derecha',
      removePage: 'Eliminar página',
      restorePage: 'Restaurar página',
      outputName: 'pdfworld-comprimido.pdf',
    },
    en: {
      eyebrow: 'Local lossy compression',
      title: 'Compress PDF in the browser',
      description: 'Turns each page into an optimized image and rebuilds a lighter PDF. Works best with scanned or highly visual PDFs.',
      dropTitle: 'Drag your PDF here',
      dropActive: 'Drop the PDF to compress it',
      dropText: 'Drop the file or click to select it',
      fileHelp: 'Single PDF · no upload · local processing',
      selectedFile: 'Selected file',
      originalSize: 'Original size',
      compressedSize: 'Compressed size',
      reduction: 'Reduction',
      noResult: 'Compress the PDF to see the final size.',
      qualityTitle: 'Compression level',
      soft: 'Soft',
      recommended: 'Recommended',
      maximum: 'Maximum',
      softDescription: 'Better visual quality, lower size reduction.',
      recommendedDescription: 'Good balance between visual quality and final size.',
      maximumDescription: 'More compression, more detail loss.',
      warningTitle: 'Important warning',
      warningText: 'This technique rasterizes pages: the result may lose sharpness, links, forms, layers, vectors and selectable text. For text-heavy documents it may even increase file size.',
      compress: 'Compress PDF',
      compressing: 'Compressing…',
      download: 'Download compressed PDF',
      open: 'Open in tab',
      close: 'Close',
      clear: 'Clear',
      invalidFile: 'Select a valid PDF file.',
      needFile: 'Load a PDF first.',
      createError: 'The PDF could not be compressed. It may be protected, damaged or too large to process in the browser.',
      notReduced: 'The generated PDF is not smaller than the original. Try maximum level or keep the original file.',
      ready: 'PDF compressed successfully.',
      loading: 'Loading PDF…',
      rendering: 'Rendering page',
      building: 'Rebuilding page',
      saving: 'Saving PDF…',
      pages: 'pages',
      page: 'Page',
      pageEditor: 'Pages to compress',
      rotateLeft: 'Rotate left',
      rotateRight: 'Rotate right',
      removePage: 'Remove page',
      restorePage: 'Restore page',
      outputName: 'pdfworld-compressed.pdf',
    },
  } as const;

  const levelOrder: CompressionLevel[] = ['soft', 'recommended', 'maximum'];

  let file: File | null = null;
  let level: CompressionLevel = 'recommended';
  let result: CompressionResult | null = null;
  let progress: CompressionProgress | null = null;
  let isCompressing = false;
  let errorMessage = '';
  let statusMessage = '';
  let resultUrl = '';
  let workspaceRegion: HTMLDivElement;
  let pageCount = 0;
  let pagesToKeep: number[] = [];
  let rotations: Record<number, number> = {};
  let thumbUrls: Record<number, string> = {};
  let thumbStatus: Record<number, 'pending' | 'ready' | 'failed'> = {};
  let pdfJsPromise: Promise<any> | null = null;
  let previewDoc: any = null;
  let renderToken = 0;

  $: t = labels[lang] ?? labels.es;
  $: canCompress = Boolean(file && !isCompressing);
  $: progressPercent = progress?.totalPages
    ? Math.round((Math.max(progress.currentPage - 1, 0) / progress.totalPages) * 100)
    : progress?.stage === 'saving'
      ? 96
      : 0;

  async function handleDropzoneFiles(files: File[]) {
    const nextFile = files[0] ?? null;
    file = nextFile;
    result = null;
    progress = null;
    errorMessage = '';
    statusMessage = '';
    pageCount = 0;
    pagesToKeep = [];
    rotations = {};
    renderToken += 1;
    cleanupThumbnails();
    void destroyPreviewDoc();
    cleanupResultUrl();
    if (nextFile) void loadPreview(nextFile);
    await scrollToWorkspace();
  }

  function handleInvalidFiles() {
    errorMessage = t.invalidFile;
    statusMessage = '';
  }

  async function compressPdf() {
    if (!file) {
      errorMessage = t.needFile;
      return;
    }

    isCompressing = true;
    errorMessage = '';
    statusMessage = '';
    result = null;
    progress = { currentPage: 0, totalPages: 0, stage: 'loading' };

    try {
      const nextResult = await compressPdfInBrowser({
        file,
        level,
        pages: pagesToKeep,
        rotations,
        onProgress: (nextProgress) => {
          progress = nextProgress;
        },
      });

      result = nextResult;
      resultUrl = createPdfObjectUrl(nextResult.bytes);
      statusMessage = nextResult.wasReduced ? t.ready : t.notReduced;
    } catch {
      errorMessage = t.createError;
    } finally {
      isCompressing = false;
      progress = null;
    }
  }

  function clearTool() {
    file = null;
    result = null;
    cleanupResultUrl();
    pageCount = 0;
    pagesToKeep = [];
    rotations = {};
    renderToken += 1;
    cleanupThumbnails();
    void destroyPreviewDoc();
    progress = null;
    isCompressing = false;
    errorMessage = '';
    statusMessage = '';
    level = 'recommended';
  }

  function getOutputName() {
    if (!file?.name) return t.outputName;
    const baseName = file.name.replace(/\.pdf$/i, '').trim() || 'documento';
    return `${baseName}-comprimido.pdf`;
  }

  function getProgressLabel() {
    if (!progress) return '';
    if (progress.stage === 'loading') return t.loading;
    if (progress.stage === 'saving') return t.saving;
    const prefix = progress.stage === 'rendering' ? t.rendering : t.building;
    return `${prefix} ${progress.currentPage}/${progress.totalPages}`;
  }

  function formatSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    return formatFileSize(bytes);
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

  async function loadPreview(sourceFile: File) {
    const token = ++renderToken;

    try {
      const pdfJs = await loadPdfJs();
      const bytes = new Uint8Array((await sourceFile.arrayBuffer()).slice(0));
      previewDoc = await pdfJs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, disableAutoFetch: true, disableStream: true }).promise;
      pageCount = previewDoc.numPages;
      pagesToKeep = Array.from({ length: pageCount }, (_, index) => index + 1);
      thumbStatus = Object.fromEntries(pagesToKeep.map((page) => [page, 'pending']));

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
      errorMessage = t.invalidFile;
    }
  }

  async function renderThumb(pdfPage: any) {
    const viewport = pdfPage.getViewport({ scale: 0.22 });
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

  function togglePage(page: number) {
    if (pagesToKeep.includes(page)) {
      if (pagesToKeep.length <= 1) return;
      pagesToKeep = pagesToKeep.filter((item) => item !== page);
    } else {
      pagesToKeep = [...pagesToKeep, page].sort((a, b) => a - b);
    }
    result = null;
    cleanupResultUrl();
  }

  function rotatePage(page: number, delta: 90 | -90) {
    rotations = { ...rotations, [page]: normalizeRotation((rotations[page] ?? 0) + delta) };
    if (rotations[page] === 0) {
      const { [page]: _removed, ...rest } = rotations;
      rotations = rest;
    }
    result = null;
    cleanupResultUrl();
  }

  function thumbStyle(page: number) {
    const rotation = normalizeRotation(rotations[page] ?? 0);
    const scale = rotation === 90 || rotation === 270 ? 0.72 : 1;
    return `transform: rotate(${rotation}deg) scale(${scale});`;
  }

  function normalizeRotation(value: number) {
    return ((value % 360) + 360) % 360;
  }

  function cleanupResultUrl() {
    if (!resultUrl) return;
    URL.revokeObjectURL(resultUrl);
    resultUrl = '';
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

  async function scrollToWorkspace() {
    await tick();
    workspaceRegion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onDestroy(() => {
    renderToken += 1;
    cleanupResultUrl();
    cleanupThumbnails();
    void destroyPreviewDoc();
  });
</script>

<section class="compress-tool" aria-labelledby="compress-tool-title">
  <div class="compress-tool__hero-card">
    <div class="compress-tool__intro">
      <span class="compress-tool__eyebrow">{t.eyebrow}</span>
      <h2 id="compress-tool-title">{t.title}</h2>
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

  <aside class="compress-tool__warning" aria-labelledby="compress-warning-title">
    <strong id="compress-warning-title">{t.warningTitle}</strong>
    <p>{t.warningText}</p>
  </aside>

  {#if errorMessage}
    <div class="compress-tool__alert compress-tool__alert--error" role="alert">{errorMessage}</div>
  {/if}

  {#if statusMessage}
    <div class:compress-tool__alert={true} class:compress-tool__alert--success={result?.wasReduced} class:compress-tool__alert--warning={result && !result.wasReduced} role="status">
      {statusMessage}
    </div>
  {/if}

  {#if file}
    <div class="compress-tool__workspace" bind:this={workspaceRegion}>
      <section class="compress-tool__file-card" aria-labelledby="compress-file-title">
        <span class="compress-tool__file-icon" aria-hidden="true">PDF</span>
        <div>
          <h3 id="compress-file-title">{t.selectedFile}</h3>
          <strong>{file.name}</strong>
          <p>{formatSize(file.size)}</p>
        </div>
      </section>

      <section class="compress-tool__settings" aria-labelledby="compress-level-title">
        <h3 id="compress-level-title">{t.qualityTitle}</h3>
        <div class="compress-tool__levels" role="radiogroup" aria-labelledby="compress-level-title">
          {#each levelOrder as presetId}
            <label class:compress-tool__level={true} class:compress-tool__level--selected={level === presetId}>
              <input type="radio" bind:group={level} value={presetId} disabled={isCompressing} />
              <span>
                <strong>{t[presetId]}</strong>
                <small>{t[`${presetId}Description`]}</small>
              </span>
            </label>
          {/each}
        </div>
      </section>

      <section class="compress-tool__metrics" aria-labelledby="compress-metrics-title">
        <h3 id="compress-metrics-title">Resultado</h3>
        <div class="compress-tool__metric-grid">
          <div>
            <span>{t.originalSize}</span>
            <strong>{formatSize(file.size)}</strong>
          </div>
          <div>
            <span>{t.compressedSize}</span>
            <strong>{result ? formatSize(result.compressedSize) : '—'}</strong>
          </div>
          <div>
            <span>{t.reduction}</span>
            <strong>{result ? `${result.reductionPercent}%` : '—'}</strong>
          </div>
        </div>
        {#if !result}
          <p>{t.noResult}</p>
        {/if}
      </section>

      {#if pageCount > 0}
        <section class="compress-tool__pages" aria-labelledby="compress-pages-title">
          <h3 id="compress-pages-title">{t.pageEditor}</h3>
          <div class="compress-tool__page-grid">
            {#each Array.from({ length: pageCount }, (_, index) => index + 1) as page}
              <article class:compress-tool__page={true} class:compress-tool__page--disabled={!pagesToKeep.includes(page)}>
                <button
                  type="button"
                  class="compress-tool__page-toggle"
                  aria-pressed={pagesToKeep.includes(page)}
                  on:click={() => togglePage(page)}
                >
                  {#if thumbStatus[page] === 'ready' && thumbUrls[page]}
                    <img src={thumbUrls[page]} alt={`${t.page} ${page}`} style={thumbStyle(page)} loading="lazy" />
                  {:else}
                    <span>{thumbStatus[page] === 'pending' ? '…' : page}</span>
                  {/if}
                </button>
                <div class="compress-tool__page-meta">
                  <strong>{t.page} {page}</strong>
                  <span>{normalizeRotation(rotations[page] ?? 0)}°</span>
                </div>
                <div class="compress-tool__page-actions">
                  <button type="button" on:click={() => rotatePage(page, -90)} aria-label={`${t.rotateLeft} ${page}`}>↶</button>
                  <button type="button" on:click={() => rotatePage(page, 90)} aria-label={`${t.rotateRight} ${page}`}>↷</button>
                  <button type="button" on:click={() => togglePage(page)}>{pagesToKeep.includes(page) ? t.removePage : t.restorePage}</button>
                </div>
              </article>
            {/each}
          </div>
        </section>
      {/if}

      {#if progress}
        <section class="compress-tool__progress" aria-label={getProgressLabel()} aria-live="polite">
          <div>
            <strong>{getProgressLabel()}</strong>
            <span>{progressPercent}%</span>
          </div>
          <progress max="100" value={progressPercent}>{progressPercent}%</progress>
        </section>
      {/if}

      <div class="compress-tool__actions">
        <button type="button" class="compress-tool__secondary" on:click={clearTool} disabled={isCompressing}>{t.clear}</button>
        <button type="button" class="compress-tool__primary" on:click={compressPdf} disabled={!canCompress}>
          {isCompressing ? t.compressing : t.compress}
        </button>
        <button type="button" class="compress-tool__primary compress-tool__primary--dark" on:click={() => (resultUrl = resultUrl || (result ? createPdfObjectUrl(result.bytes) : ''))} disabled={!result || isCompressing}>
          {t.download}
        </button>
      </div>
    </div>
  {/if}

  <PdfResultModal
    open={Boolean(resultUrl)}
    pdfUrl={resultUrl}
    filename={getOutputName()}
    title={t.download}
    description={t.ready}
    downloadLabel={t.download}
    openLabel={t.open}
    closeLabel={t.close}
    on:close={cleanupResultUrl}
  />
</section>

<style>
  .compress-tool {
    display: grid;
    gap: 20px;
    margin: 32px 0 64px;
  }

  .compress-tool__hero-card,
  .compress-tool__warning,
  .compress-tool__workspace,
  .compress-tool__file-card,
  .compress-tool__settings,
  .compress-tool__metrics,
  .compress-tool__progress,
  .compress-tool__alert {
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  }

  .compress-tool__hero-card {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.95fr);
    gap: 20px;
    align-items: center;
    padding: 24px;
    border-radius: 32px;
    background:
      radial-gradient(circle at top right, rgba(245, 158, 11, 0.17), transparent 34%),
      linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(248, 250, 252, 0.9));
  }

  .compress-tool__intro h2 {
    margin: 0 0 8px;
    letter-spacing: -0.04em;
  }

  .compress-tool__intro p,
  .compress-tool__warning p,
  .compress-tool__file-card p,
  .compress-tool__metrics p,
  .compress-tool__level small {
    margin: 0;
    color: #64748b;
  }

  .compress-tool__eyebrow {
    display: inline-flex;
    margin-bottom: 10px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #fef3c7;
    color: #92400e;
    font-size: 0.8rem;
    font-weight: 900;
  }

  .compress-tool__warning {
    display: grid;
    gap: 6px;
    padding: 16px 18px;
    border-color: #fde68a;
    background: #fffbeb;
    color: #78350f;
  }

  .compress-tool__alert {
    padding: 16px 18px;
    color: #475569;
    font-weight: 850;
  }

  .compress-tool__alert--error {
    border-color: #fecaca;
    background: #fff1f2;
    color: #991b1b;
  }

  .compress-tool__alert--success {
    border-color: #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .compress-tool__alert--warning {
    border-color: #fde68a;
    background: #fffbeb;
    color: #92400e;
  }

  .compress-tool__workspace {
    display: grid;
    grid-template-columns: minmax(220px, 0.72fr) minmax(0, 1.28fr);
    gap: 18px;
    padding: 18px;
  }

  .compress-tool__file-card,
  .compress-tool__settings,
  .compress-tool__metrics,
  .compress-tool__progress {
    padding: 18px;
  }

  .compress-tool__settings,
  .compress-tool__metrics,
  .compress-tool__progress,
  .compress-tool__pages,
  .compress-tool__actions {
    grid-column: 1 / -1;
  }

  .compress-tool__file-card {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .compress-tool__file-card h3,
  .compress-tool__settings h3,
  .compress-tool__metrics h3 {
    margin: 0 0 12px;
  }

  .compress-tool__file-card strong {
    display: block;
    overflow: hidden;
    max-width: 100%;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compress-tool__file-icon {
    display: grid;
    width: 52px;
    height: 64px;
    place-items: center;
    border-radius: 16px;
    background: #fff7ed;
    color: #c2410c;
    font-size: 0.75rem;
    font-weight: 950;
    box-shadow: inset 0 0 0 1px rgba(249, 115, 22, 0.16);
  }

  .compress-tool__levels {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .compress-tool__level {
    display: flex;
    gap: 10px;
    padding: 14px;
    border: 2px solid #e2e8f0;
    border-radius: 18px;
    background: #fff;
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
  }

  .compress-tool__level:hover {
    transform: translateY(-1px);
  }

  .compress-tool__level--selected {
    border-color: #f97316;
    background: #fff7ed;
    box-shadow: 0 16px 34px rgba(249, 115, 22, 0.14);
  }

  .compress-tool__level input {
    margin-top: 4px;
  }

  .compress-tool__level span {
    display: grid;
    gap: 4px;
  }

  .compress-tool__metric-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .compress-tool__metric-grid div {
    display: grid;
    gap: 6px;
    padding: 14px;
    border-radius: 18px;
    background: #f8fafc;
  }

  .compress-tool__metric-grid span {
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 850;
    text-transform: uppercase;
  }

  .compress-tool__metric-grid strong {
    color: #0f172a;
    font-size: 1.15rem;
  }

  .compress-tool__progress {
    display: grid;
    gap: 10px;
  }

  .compress-tool__pages {
    display: grid;
    gap: 14px;
    padding: 18px;
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.88);
  }

  .compress-tool__pages h3 {
    margin: 0;
  }

  .compress-tool__page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }

  .compress-tool__page {
    display: grid;
    gap: 9px;
    padding: 10px;
    border: 2px solid #e2e8f0;
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
  }

  .compress-tool__page--disabled {
    opacity: 0.58;
  }

  .compress-tool__page-toggle {
    display: grid;
    min-height: 168px;
    place-items: center;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: #f8fafc;
    color: #94a3b8;
    cursor: pointer;
    font: inherit;
    font-weight: 950;
  }

  .compress-tool__page-toggle img {
    display: block;
    width: 100%;
    height: auto;
    transition: transform 180ms ease;
  }

  .compress-tool__page-meta,
  .compress-tool__page-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .compress-tool__page-meta span {
    padding: 5px 8px;
    border-radius: 999px;
    background: #fef3c7;
    color: #92400e;
    font-weight: 950;
    font-size: 0.8rem;
  }

  .compress-tool__page-actions {
    flex-wrap: wrap;
  }

  .compress-tool__page-actions button {
    flex: 1 1 auto;
    min-height: 36px;
    border: 0;
    border-radius: 999px;
    background: #e2e8f0;
    color: #334155;
    cursor: pointer;
    font: inherit;
    font-weight: 900;
  }

  .compress-tool__progress div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .compress-tool__progress progress {
    width: 100%;
    height: 12px;
    overflow: hidden;
    border: 0;
    border-radius: 999px;
    background: #e2e8f0;
  }

  .compress-tool__progress progress::-webkit-progress-bar {
    background: #e2e8f0;
  }

  .compress-tool__progress progress::-webkit-progress-value {
    background: linear-gradient(135deg, #f97316, #c2410c);
  }

  .compress-tool__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
  }

  .compress-tool__primary,
  .compress-tool__secondary {
    min-height: 46px;
    padding: 12px 16px;
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-weight: 950;
    transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
  }

  .compress-tool__primary {
    background: linear-gradient(135deg, #f97316, #c2410c);
    color: #fff;
    box-shadow: 0 16px 34px rgba(249, 115, 22, 0.24);
  }

  .compress-tool__primary--dark {
    background: linear-gradient(135deg, #0f172a, #334155);
    box-shadow: 0 16px 34px rgba(15, 23, 42, 0.22);
  }

  .compress-tool__secondary {
    background: #e2e8f0;
    color: #334155;
  }

  .compress-tool__primary:hover:not(:disabled),
  .compress-tool__secondary:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .compress-tool__primary:disabled,
  .compress-tool__secondary:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  @media (prefers-reduced-motion: reduce) {
    .compress-tool__level,
    .compress-tool__primary,
    .compress-tool__secondary {
      transition: none;
    }
  }

  @media (max-width: 760px) {
    .compress-tool__hero-card,
    .compress-tool__workspace,
    .compress-tool__levels,
    .compress-tool__metric-grid {
      grid-template-columns: 1fr;
    }

    .compress-tool__hero-card {
      padding: 18px;
      border-radius: 24px;
    }

    .compress-tool__actions {
      justify-content: stretch;
    }

    .compress-tool__primary,
    .compress-tool__secondary {
      flex: 1 1 180px;
    }
  }
</style>
