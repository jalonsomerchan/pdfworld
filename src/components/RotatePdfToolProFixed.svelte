<script lang="ts">
  import { onDestroy } from 'svelte';
  import { saveAs } from 'file-saver';
  import PdfDropzone from './PdfDropzone.svelte';
  import { getPdfPageCount, rotatePdfWithMapInBrowser, type PageRotationMap, type RotatePdfResult } from '../lib/pdf/rotatePdf';

  type Lang = 'es' | 'en';
  type ThumbStatus = 'pending' | 'ready' | 'failed';
  type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
  type PdfDoc = Awaited<ReturnType<ReturnType<PdfJsModule['getDocument']>['promise']['then']>>;
  type PdfPage = Awaited<ReturnType<PdfDoc['getPage']>>;

  export let lang: Lang = 'es';

  const copy = {
    es: {
      eyebrow: 'Editor visual local',
      title: 'Rota cada página visualmente',
      description: 'Carga tu PDF, mira las miniaturas y gira páginas individuales. Cada miniatura refleja el giro antes de exportar.',
      dropTitle: 'Arrastra tu PDF aquí',
      dropActive: 'Suelta el PDF para cargarlo',
      dropText: 'Suelta el archivo o pulsa para seleccionarlo',
      fileHelp: 'Un solo PDF · privado · sin subida · navegador',
      invalidFile: 'Selecciona un archivo PDF válido.',
      readError: 'No se pudo leer el PDF. Puede estar dañado, protegido o no ser compatible.',
      loaded: 'PDF cargado correctamente.',
      rendering: 'Generando miniaturas… puedes empezar a girar páginas mientras tanto.',
      selectedFile: 'Archivo seleccionado',
      pages: 'páginas',
      page: 'Página',
      rotateLeft: 'Girar izquierda',
      rotateRight: 'Girar derecha',
      resetPage: 'Restablecer',
      applyAllTitle: 'Acciones rápidas',
      allLeft: 'Girar todas izquierda',
      allRight: 'Girar todas derecha',
      resetAll: 'Restablecer todo',
      summaryTitle: 'Resumen de rotación',
      noChanges: 'Aún no hay páginas rotadas. Usa los botones de cada miniatura o las acciones rápidas.',
      changedPages: 'páginas con cambios',
      originalSize: 'Tamaño original',
      outputSize: 'Tamaño final',
      rotate: 'Generar y descargar PDF',
      rotating: 'Generando PDF…',
      downloadAgain: 'Descargar otra vez',
      clear: 'Limpiar',
      ready: 'PDF rotado correctamente. La descarga debería comenzar automáticamente.',
      needFile: 'Primero carga un PDF.',
      needChanges: 'Gira al menos una página antes de generar el PDF.',
      createError: 'No se pudo rotar el PDF. Revisa que el archivo no esté protegido o dañado.',
      outputName: 'pdfworld-rotado.pdf',
    },
    en: {
      eyebrow: 'Local visual editor',
      title: 'Rotate each page visually',
      description: 'Load your PDF, inspect thumbnails and rotate individual pages. Every thumbnail reflects the rotation before export.',
      dropTitle: 'Drag your PDF here',
      dropActive: 'Drop the PDF to load it',
      dropText: 'Drop the file or click to select it',
      fileHelp: 'Single PDF · private · no upload · browser',
      invalidFile: 'Select a valid PDF file.',
      readError: 'The PDF could not be read. It may be damaged, protected or unsupported.',
      loaded: 'PDF loaded successfully.',
      rendering: 'Generating thumbnails… you can start rotating pages meanwhile.',
      selectedFile: 'Selected file',
      pages: 'pages',
      page: 'Page',
      rotateLeft: 'Rotate left',
      rotateRight: 'Rotate right',
      resetPage: 'Reset',
      applyAllTitle: 'Quick actions',
      allLeft: 'Rotate all left',
      allRight: 'Rotate all right',
      resetAll: 'Reset all',
      summaryTitle: 'Rotation summary',
      noChanges: 'No pages are rotated yet. Use each thumbnail controls or the quick actions.',
      changedPages: 'pages changed',
      originalSize: 'Original size',
      outputSize: 'Final size',
      rotate: 'Generate and download PDF',
      rotating: 'Generating PDF…',
      downloadAgain: 'Download again',
      clear: 'Clear',
      ready: 'PDF rotated successfully. The download should start automatically.',
      needFile: 'Load a PDF first.',
      needChanges: 'Rotate at least one page before generating the PDF.',
      createError: 'The PDF could not be rotated. Check that the file is not protected or damaged.',
      outputName: 'pdfworld-rotated.pdf',
    },
  } as const;

  let file: File | null = null;
  let pageCount = 0;
  let rotations: PageRotationMap = {};
  let thumbUrls: Record<number, string> = {};
  let thumbStatuses: Record<number, ThumbStatus> = {};
  let previewDocument: PdfDoc | null = null;
  let pdfJsPromise: Promise<PdfJsModule> | null = null;
  let renderToken = 0;
  let result: RotatePdfResult | null = null;
  let isLoading = false;
  let isRendering = false;
  let isExporting = false;
  let errorMessage = '';
  let statusMessage = '';

  $: t = copy[lang] ?? copy.es;
  $: pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  $: changedPages = pageNumbers.filter((page) => getPageRotation(page) !== 0);
  $: canExport = Boolean(file && changedPages.length > 0 && !isLoading && !isExporting);

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.mjs?url'),
      ]).then(([pdfJs, worker]) => {
        pdfJs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfJs;
      });
    }

    return pdfJsPromise;
  }

  async function handleDropzoneFiles(files: File[]) {
    await loadFile(files[0] ?? null);
  }

  function handleInvalidFiles() {
    errorMessage = t.invalidFile;
    statusMessage = '';
  }

  async function loadFile(nextFile: File | null) {
    renderToken += 1;
    cleanupThumbnails();
    await destroyPreviewDocument();

    file = nextFile;
    pageCount = 0;
    rotations = {};
    thumbUrls = {};
    thumbStatuses = {};
    result = null;
    errorMessage = '';
    statusMessage = '';

    if (!nextFile) return;

    isLoading = true;

    try {
      pageCount = await getPdfPageCount(nextFile);
      thumbStatuses = Object.fromEntries(Array.from({ length: pageCount }, (_, index) => [index + 1, 'pending']));
      statusMessage = `${t.loaded} ${pageCount} ${t.pages}.`;
      void renderThumbnails(nextFile);
    } catch {
      file = null;
      pageCount = 0;
      errorMessage = t.readError;
    } finally {
      isLoading = false;
    }
  }

  async function renderThumbnails(sourceFile: File) {
    const token = ++renderToken;
    isRendering = true;

    try {
      const pdfJs = await loadPdfJs();
      const bytes = new Uint8Array((await sourceFile.arrayBuffer()).slice(0));
      const task = pdfJs.getDocument({
        data: bytes,
        useWorkerFetch: false,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
      });

      previewDocument = await task.promise;

      for (let page = 1; page <= previewDocument.numPages; page += 1) {
        if (token !== renderToken || !previewDocument) return;
        await yieldToBrowser();

        try {
          const pdfPage = await previewDocument.getPage(page);
          const url = await renderThumbnail(pdfPage);
          pdfPage.cleanup();

          if (token !== renderToken) {
            URL.revokeObjectURL(url);
            return;
          }

          if (thumbUrls[page]) URL.revokeObjectURL(thumbUrls[page]);
          thumbUrls = { ...thumbUrls, [page]: url };
          thumbStatuses = { ...thumbStatuses, [page]: 'ready' };
        } catch {
          thumbStatuses = { ...thumbStatuses, [page]: 'failed' };
        }
      }
    } catch {
      thumbStatuses = Object.fromEntries(pageNumbers.map((page) => [page, 'failed']));
    } finally {
      if (token === renderToken) isRendering = false;
    }
  }

  async function renderThumbnail(pdfPage: PdfPage) {
    const viewport = pdfPage.getViewport({ scale: 0.34 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) throw new Error('No canvas context');

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await pdfPage.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob) throw new Error('No thumbnail blob');

    return URL.createObjectURL(blob);
  }

  function rotatePage(page: number, delta: 90 | -90) {
    const nextRotation = normalizeRotation(getPageRotation(page) + delta);
    const nextRotations = { ...rotations, [page]: nextRotation };

    if (nextRotation === 0) {
      delete nextRotations[page];
    }

    rotations = nextRotations;
    result = null;
    statusMessage = '';
    errorMessage = '';
  }

  function resetPage(page: number) {
    const nextRotations = { ...rotations };
    delete nextRotations[page];
    rotations = nextRotations;
    result = null;
    statusMessage = '';
    errorMessage = '';
  }

  function rotateAll(delta: 90 | -90) {
    const nextRotations: PageRotationMap = {};

    pageNumbers.forEach((page) => {
      const next = normalizeRotation(getPageRotation(page) + delta);
      if (next !== 0) nextRotations[page] = next;
    });

    rotations = nextRotations;
    result = null;
    statusMessage = '';
    errorMessage = '';
  }

  function resetAll() {
    rotations = {};
    result = null;
    statusMessage = '';
    errorMessage = '';
  }

  async function exportAndDownloadPdf() {
    if (!file) {
      errorMessage = t.needFile;
      return;
    }

    if (changedPages.length === 0) {
      errorMessage = t.needChanges;
      return;
    }

    isExporting = true;
    result = null;
    errorMessage = '';
    statusMessage = '';

    try {
      const nextResult = await rotatePdfWithMapInBrowser({ file, rotations });
      result = nextResult;
      downloadBytes(nextResult.bytes);
      statusMessage = t.ready;
    } catch {
      errorMessage = t.createError;
    } finally {
      isExporting = false;
    }
  }

  function downloadRotatedPdf() {
    if (!result) return;
    downloadBytes(result.bytes);
  }

  function downloadBytes(bytes: Uint8Array) {
    const copyBytes = new Uint8Array(bytes);
    saveAs(new Blob([copyBytes], { type: 'application/pdf' }), getOutputName());
  }

  function clearTool() {
    renderToken += 1;
    cleanupThumbnails();
    void destroyPreviewDocument();
    file = null;
    pageCount = 0;
    rotations = {};
    thumbUrls = {};
    thumbStatuses = {};
    result = null;
    isLoading = false;
    isRendering = false;
    isExporting = false;
    errorMessage = '';
    statusMessage = '';
  }

  function getPageRotation(page: number) {
    return normalizeRotation(rotations[page] ?? 0);
  }

  function getThumbTransform(page: number) {
    const rotation = getPageRotation(page);
    const scale = rotation === 90 || rotation === 270 ? 0.74 : 1;
    return `transform: rotate(${rotation}deg) scale(${scale});`;
  }

  function normalizeRotation(value: number) {
    return ((value % 360) + 360) % 360;
  }

  function getOutputName() {
    if (!file?.name) return t.outputName;
    return `${(file.name.replace(/\.pdf$/i, '').trim() || 'documento')}-rotado.pdf`;
  }

  function formatSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function cleanupThumbnails() {
    Object.values(thumbUrls).forEach((url) => URL.revokeObjectURL(url));
    thumbUrls = {};
  }

  async function destroyPreviewDocument() {
    if (!previewDocument) return;

    try {
      await previewDocument.destroy();
    } catch {
      // pdf.js may throw if already destroyed.
    } finally {
      previewDocument = null;
    }
  }

  function yieldToBrowser() {
    return new Promise<void>((resolve) => {
      window.requestIdleCallback?.(() => resolve(), { timeout: 120 }) ?? window.setTimeout(resolve, 0);
    });
  }

  onDestroy(() => {
    renderToken += 1;
    cleanupThumbnails();
    void destroyPreviewDocument();
  });
</script>

<section class="rotate-pro" aria-labelledby="rotate-pro-title">
  <div class="rotate-pro__hero">
    <div>
      <span class="rotate-pro__eyebrow">{t.eyebrow}</span>
      <h2 id="rotate-pro-title">{t.title}</h2>
      <p>{t.description}</p>
    </div>
    <PdfDropzone title={t.dropTitle} activeTitle={t.dropActive} subtitle={t.dropText} help={t.fileHelp} selectedLabel={file?.name ?? ''} onFiles={handleDropzoneFiles} onInvalidFiles={handleInvalidFiles} />
  </div>

  {#if errorMessage}<div class="rotate-pro__alert rotate-pro__alert--error" role="alert">{errorMessage}</div>{/if}
  {#if statusMessage}<div class="rotate-pro__alert rotate-pro__alert--success" role="status">{statusMessage}</div>{/if}
  {#if isLoading}<div class="rotate-pro__alert" role="status">Cargando PDF…</div>{/if}
  {#if isRendering}<div class="rotate-pro__alert" role="status">{t.rendering}</div>{/if}

  {#if file && pageCount > 0}
    <div class="rotate-pro__workspace">
      <aside class="rotate-pro__sidebar">
        <section class="rotate-pro__panel rotate-pro__file">
          <span class="rotate-pro__file-icon" aria-hidden="true">PDF</span>
          <div>
            <h3>{t.selectedFile}</h3>
            <strong>{file.name}</strong>
            <p>{formatSize(file.size)} · {pageCount} {t.pages}</p>
          </div>
        </section>

        <section class="rotate-pro__panel">
          <h3>{t.applyAllTitle}</h3>
          <div class="rotate-pro__quick-actions">
            <button type="button" on:click={() => rotateAll(-90)}>↶ {t.allLeft}</button>
            <button type="button" on:click={() => rotateAll(90)}>↷ {t.allRight}</button>
            <button type="button" on:click={resetAll}>⟲ {t.resetAll}</button>
          </div>
        </section>

        <section class="rotate-pro__panel" aria-live="polite">
          <h3>{t.summaryTitle}</h3>
          {#if changedPages.length > 0}
            <p><strong>{changedPages.length}</strong> {t.changedPages}</p>
            <div class="rotate-pro__summary-list">
              {#each changedPages as page}
                <span>{t.page} {page}: {getPageRotation(page)}°</span>
              {/each}
            </div>
          {:else}
            <p>{t.noChanges}</p>
          {/if}
        </section>

        <section class="rotate-pro__panel rotate-pro__metrics">
          <div><span>{t.originalSize}</span><strong>{formatSize(file.size)}</strong></div>
          <div><span>{t.outputSize}</span><strong>{result ? formatSize(result.outputSize) : '—'}</strong></div>
        </section>

        <div class="rotate-pro__actions">
          <button type="button" class="rotate-pro__secondary" on:click={clearTool} disabled={isExporting}>{t.clear}</button>
          <button type="button" class="rotate-pro__primary" on:click={exportAndDownloadPdf} disabled={!canExport}>{isExporting ? t.rotating : t.rotate}</button>
          <button type="button" class="rotate-pro__primary rotate-pro__primary--dark" on:click={downloadRotatedPdf} disabled={!result || isExporting}>{t.downloadAgain}</button>
        </div>
      </aside>

      <section class="rotate-pro__pages" aria-label={t.title}>
        {#each pageNumbers as page}
          <article class:rotate-pro__page-card={true} class:rotate-pro__page-card--changed={getPageRotation(page) !== 0}>
            <div class="rotate-pro__thumb-frame">
              <button type="button" class="rotate-pro__thumb-hit" aria-label={`${t.rotateRight} ${page}`} on:click={() => rotatePage(page, 90)}>
                <span class="rotate-pro__thumb" style={getThumbTransform(page)}>
                  {#if thumbStatuses[page] === 'ready' && thumbUrls[page]}
                    <img src={thumbUrls[page]} alt={`${t.page} ${page}`} loading="lazy" />
                  {:else}
                    <span class:rotate-pro__placeholder={true} class:rotate-pro__placeholder--loading={thumbStatuses[page] !== 'failed'}>{page}</span>
                  {/if}
                </span>
              </button>
            </div>
            <div class="rotate-pro__page-meta">
              <strong>{t.page} {page}</strong>
              <span>{getPageRotation(page)}°</span>
            </div>
            <div class="rotate-pro__page-actions">
              <button type="button" aria-label={`${t.rotateLeft} ${page}`} on:click={() => rotatePage(page, -90)}>↶</button>
              <button type="button" aria-label={`${t.resetPage} ${page}`} on:click={() => resetPage(page)}>0°</button>
              <button type="button" aria-label={`${t.rotateRight} ${page}`} on:click={() => rotatePage(page, 90)}>↷</button>
            </div>
          </article>
        {/each}
      </section>
    </div>
  {/if}
</section>

<style>
  .rotate-pro{display:grid;gap:24px;margin:36px 0 72px}.rotate-pro__hero,.rotate-pro__workspace,.rotate-pro__panel,.rotate-pro__alert{border:1px solid #e2e8f0;border-radius:30px;background:rgba(255,255,255,.92);box-shadow:0 24px 70px rgba(15,23,42,.08)}.rotate-pro__hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);gap:24px;align-items:center;padding:28px;background:radial-gradient(circle at top right,rgba(59,130,246,.18),transparent 34%),linear-gradient(135deg,#fff,rgba(248,250,252,.94))}.rotate-pro__hero h2{margin:0 0 8px;letter-spacing:-.045em}.rotate-pro__hero p,.rotate-pro__panel p,.rotate-pro__file p{margin:0;color:#64748b}.rotate-pro__eyebrow{display:inline-flex;margin-bottom:10px;padding:6px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:.8rem;font-weight:900}.rotate-pro__alert{padding:16px 18px;color:#475569;font-weight:850}.rotate-pro__alert--error{border-color:#fecaca;background:#fff1f2;color:#991b1b}.rotate-pro__alert--success{border-color:#bbf7d0;background:#f0fdf4;color:#166534}.rotate-pro__workspace{display:grid;grid-template-columns:340px minmax(0,1fr);gap:22px;padding:22px;align-items:start}.rotate-pro__sidebar{position:sticky;top:18px;display:grid;gap:14px}.rotate-pro__panel{padding:18px}.rotate-pro__panel h3{margin:0 0 12px}.rotate-pro__file{display:flex;gap:14px;align-items:flex-start}.rotate-pro__file strong{display:block;overflow:hidden;max-width:220px;text-overflow:ellipsis;white-space:nowrap}.rotate-pro__file-icon{display:grid;width:52px;height:64px;place-items:center;border-radius:16px;background:#eff6ff;color:#2563eb;font-size:.75rem;font-weight:950;box-shadow:inset 0 0 0 1px rgba(37,99,235,.15)}.rotate-pro__quick-actions,.rotate-pro__actions{display:grid;gap:10px}.rotate-pro__quick-actions button,.rotate-pro__primary,.rotate-pro__secondary,.rotate-pro__page-actions button,.rotate-pro__thumb-hit{border:0;cursor:pointer;font:inherit;font-weight:950;transition:transform 140ms ease,box-shadow 140ms ease,opacity 140ms ease,background 140ms ease}.rotate-pro__quick-actions button{min-height:44px;border-radius:999px;background:#e2e8f0;color:#334155}.rotate-pro__summary-list{display:flex;flex-wrap:wrap;gap:8px;max-height:136px;overflow:auto}.rotate-pro__summary-list span{display:inline-flex;padding:7px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-weight:900;font-size:.86rem}.rotate-pro__metrics{display:grid;grid-template-columns:1fr;gap:10px}.rotate-pro__metrics div{display:grid;gap:5px;padding:12px;border-radius:16px;background:#f8fafc}.rotate-pro__metrics span{color:#64748b;font-size:.74rem;font-weight:850;text-transform:uppercase}.rotate-pro__metrics strong{font-size:1.1rem;color:#0f172a}.rotate-pro__primary,.rotate-pro__secondary{min-height:48px;padding:12px 16px;border-radius:999px}.rotate-pro__primary{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;box-shadow:0 16px 34px rgba(37,99,235,.24)}.rotate-pro__primary--dark{background:linear-gradient(135deg,#0f172a,#334155);box-shadow:0 16px 34px rgba(15,23,42,.22)}.rotate-pro__secondary{background:#e2e8f0;color:#334155}.rotate-pro__primary:disabled,.rotate-pro__secondary:disabled{cursor:not-allowed;opacity:.45}.rotate-pro__pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:18px;padding:4px}.rotate-pro__page-card{display:grid;gap:12px;padding:14px;border:2px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,.06);transition:transform 160ms ease,border-color 160ms ease,box-shadow 160ms ease}.rotate-pro__page-card--changed{border-color:#2563eb;background:#eff6ff;box-shadow:0 18px 40px rgba(37,99,235,.16)}.rotate-pro__page-card:hover{transform:translateY(-2px)}.rotate-pro__thumb-frame{display:grid;place-items:center;min-height:248px;overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:linear-gradient(135deg,#f8fafc,#eef2ff)}.rotate-pro__thumb-hit{display:grid;width:100%;height:100%;min-height:248px;place-items:center;padding:0;background:transparent}.rotate-pro__thumb{display:grid;place-items:center;width:82%;transition:transform 220ms ease}.rotate-pro__thumb img{display:block;width:100%;height:auto;box-shadow:0 14px 30px rgba(15,23,42,.18);pointer-events:none}.rotate-pro__placeholder{display:grid;width:100%;min-height:178px;place-items:center;border-radius:14px;color:#94a3b8;background:#f1f5f9;font-size:1.4rem;font-weight:950}.rotate-pro__placeholder--loading{background:linear-gradient(100deg,#f1f5f9 20%,#fff 45%,#f1f5f9 70%);background-size:220% 100%;animation:thumb-loading 1.4s ease-in-out infinite}.rotate-pro__page-meta{display:flex;justify-content:space-between;align-items:center;gap:10px}.rotate-pro__page-meta span{padding:5px 9px;border-radius:999px;background:#e2e8f0;color:#334155;font-weight:950;font-size:.82rem}.rotate-pro__page-card--changed .rotate-pro__page-meta span{background:#dbeafe;color:#1d4ed8}.rotate-pro__page-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.rotate-pro__page-actions button{min-height:40px;border-radius:999px;background:#e2e8f0;color:#334155}.rotate-pro__page-actions button:hover,.rotate-pro__quick-actions button:hover,.rotate-pro__primary:hover:not(:disabled),.rotate-pro__secondary:hover:not(:disabled),.rotate-pro__thumb-hit:hover{transform:translateY(-1px)}@keyframes thumb-loading{0%{background-position:120% 0}100%{background-position:-120% 0}}@media (prefers-reduced-motion:reduce){.rotate-pro__page-card,.rotate-pro__thumb,.rotate-pro__quick-actions button,.rotate-pro__primary,.rotate-pro__secondary,.rotate-pro__page-actions button,.rotate-pro__thumb-hit{transition:none}.rotate-pro__placeholder--loading{animation:none}}@media (min-width:1280px){.rotate-pro__pages{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}.rotate-pro__thumb-frame,.rotate-pro__thumb-hit{min-height:280px}}@media (max-width:980px){.rotate-pro__hero,.rotate-pro__workspace{grid-template-columns:1fr}.rotate-pro__sidebar{position:static}.rotate-pro__hero{padding:18px;border-radius:24px}.rotate-pro__pages{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.rotate-pro__thumb-frame,.rotate-pro__thumb-hit{min-height:180px}}
</style>
