<script lang="ts">
  import { onDestroy } from 'svelte';
  import { PDFDocument, degrees } from 'pdf-lib';
  import { saveAs } from 'file-saver';
  import PdfDropzone from './PdfDropzone.svelte';

  type Lang = 'es' | 'en';
  type ThumbStatus = 'pending' | 'ready' | 'failed';

  interface SourcePdf {
    id: string;
    file: File;
    pageCount: number;
    error?: string;
  }

  interface PageItem {
    id: string;
    sourceId: string;
    fileName: string;
    pageIndex: number;
    pageNumber: number;
    rotation: number;
    thumbUrl?: string;
    thumbStatus: ThumbStatus;
  }

  export let lang: Lang = 'es';

  const labels = {
    es: {
      title: 'Une PDF editando sus páginas',
      description: 'Carga varios PDF, reordena archivos completos o páginas individuales, elimina páginas, rótalas y descarga un único documento final.',
      dropTitle: 'Arrastra tus PDF aquí',
      dropText: 'Suelta los archivos o pulsa para seleccionarlos',
      dropActive: 'Suelta para añadirlos al editor',
      fileHelp: 'Solo PDF · privado · procesamiento local en navegador',
      selectedFiles: 'PDF cargados',
      pagesEditor: 'Editor de páginas',
      noFiles: 'Todavía no has seleccionado ningún PDF.',
      pages: 'páginas',
      finalPages: 'páginas finales',
      movePdfUp: 'Subir PDF',
      movePdfDown: 'Bajar PDF',
      removePdf: 'Eliminar PDF',
      movePageUp: 'Mover antes',
      movePageDown: 'Mover después',
      rotateLeft: 'Girar izquierda',
      rotateRight: 'Girar derecha',
      removePage: 'Eliminar página',
      clear: 'Limpiar',
      merge: 'Generar y descargar PDF',
      merging: 'Generando PDF…',
      rendering: 'Generando miniaturas… puedes editar mientras tanto.',
      downloadName: 'pdfworld-unido.pdf',
      invalidFiles: 'Algunos archivos no son PDF y se han ignorado.',
      readError: 'No se pudo leer este PDF. Puede estar dañado o protegido.',
      needPages: 'Añade al menos una página válida para generar el PDF.',
      mergeError: 'No se pudo generar el PDF. Revisa que los archivos no estén dañados o protegidos.',
      ready: 'PDF generado correctamente. La descarga debería comenzar automáticamente.',
      page: 'Página',
      from: 'de',
    },
    en: {
      title: 'Merge PDFs by editing pages',
      description: 'Load several PDFs, reorder whole files or individual pages, delete pages, rotate them and download one final document.',
      dropTitle: 'Drag your PDFs here',
      dropText: 'Drop files or click to select them',
      dropActive: 'Drop to add them to the editor',
      fileHelp: 'PDF only · private · local browser processing',
      selectedFiles: 'Loaded PDFs',
      pagesEditor: 'Page editor',
      noFiles: 'No PDF files selected yet.',
      pages: 'pages',
      finalPages: 'final pages',
      movePdfUp: 'Move PDF up',
      movePdfDown: 'Move PDF down',
      removePdf: 'Remove PDF',
      movePageUp: 'Move before',
      movePageDown: 'Move after',
      rotateLeft: 'Rotate left',
      rotateRight: 'Rotate right',
      removePage: 'Delete page',
      clear: 'Clear',
      merge: 'Generate and download PDF',
      merging: 'Generating PDF…',
      rendering: 'Generating thumbnails… you can edit meanwhile.',
      downloadName: 'pdfworld-merged.pdf',
      invalidFiles: 'Some files were not PDFs and were ignored.',
      readError: 'This PDF could not be read. It may be damaged or protected.',
      needPages: 'Add at least one valid page to generate the PDF.',
      mergeError: 'The PDF could not be generated. Check that files are not damaged or protected.',
      ready: 'PDF created successfully. The download should start automatically.',
      page: 'Page',
      from: 'from',
    },
  } as const;

  let sources: SourcePdf[] = [];
  let pages: PageItem[] = [];
  let pdfJsPromise: Promise<any> | null = null;
  let renderToken = 0;
  let isMerging = false;
  let isRendering = false;
  let statusMessage = '';
  let errorMessage = '';

  $: t = labels[lang] ?? labels.es;
  $: validSources = sources.filter((item) => !item.error);
  $: canMerge = pages.length > 0 && validSources.length > 0 && !isMerging;
  $: totalSourcePages = sources.reduce((sum, item) => sum + item.pageCount, 0);

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

  async function addFiles(selectedFiles: File[]) {
    if (!selectedFiles.length) return;
    errorMessage = '';
    statusMessage = '';

    for (const file of selectedFiles) {
      const id = newId();
      try {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes.slice(0), { ignoreEncryption: false });
        const pageCount = pdf.getPageCount();
        const source: SourcePdf = { id, file, pageCount };
        const sourcePages = Array.from({ length: pageCount }, (_, index): PageItem => ({
          id: `${id}-${index}-${newId()}`,
          sourceId: id,
          fileName: file.name,
          pageIndex: index,
          pageNumber: index + 1,
          rotation: 0,
          thumbStatus: 'pending',
        }));
        sources = [...sources, source];
        pages = [...pages, ...sourcePages];
        void renderSourceThumbnails(source, sourcePages);
      } catch {
        sources = [...sources, { id, file, pageCount: 0, error: t.readError }];
      }
    }
  }

  function handleInvalidFiles() {
    errorMessage = t.invalidFiles;
  }

  async function renderSourceThumbnails(source: SourcePdf, sourcePages: PageItem[]) {
    const token = ++renderToken;
    isRendering = true;
    try {
      const pdfJs = await loadPdfJs();
      const bytes = new Uint8Array((await source.file.arrayBuffer()).slice(0));
      const pdfDoc = await pdfJs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, disableAutoFetch: true, disableStream: true }).promise;
      for (const item of sourcePages) {
        if (token !== renderToken && !sources.some((sourceItem) => sourceItem.id === source.id)) return;
        await yieldToBrowser();
        try {
          const page = await pdfDoc.getPage(item.pageNumber);
          const thumbUrl = await renderPageThumb(page);
          page.cleanup();
          updatePage(item.id, { thumbUrl, thumbStatus: 'ready' });
        } catch {
          updatePage(item.id, { thumbStatus: 'failed' });
        }
      }
      await pdfDoc.destroy();
    } catch {
      sourcePages.forEach((item) => updatePage(item.id, { thumbStatus: 'failed' }));
    } finally {
      isRendering = false;
    }
  }

  async function renderPageThumb(pdfPage: any) {
    const viewport = pdfPage.getViewport({ scale: 0.25 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('No canvas context');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78));
    if (!blob) throw new Error('No thumbnail blob');
    return URL.createObjectURL(blob);
  }

  function updatePage(pageId: string, patch: Partial<PageItem>) {
    pages = pages.map((item) => (item.id === pageId ? { ...item, ...patch } : item));
  }

  function movePage(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    const nextPages = [...pages];
    const [item] = nextPages.splice(index, 1);
    nextPages.splice(nextIndex, 0, item);
    pages = nextPages;
    statusMessage = '';
  }

  function rotatePage(pageId: string, delta: 90 | -90) {
    pages = pages.map((item) => item.id === pageId ? { ...item, rotation: normalizeRotation(item.rotation + delta) } : item);
    statusMessage = '';
  }

  function removePage(pageId: string) {
    const page = pages.find((item) => item.id === pageId);
    if (page?.thumbUrl) URL.revokeObjectURL(page.thumbUrl);
    pages = pages.filter((item) => item.id !== pageId);
    statusMessage = '';
  }

  function moveSource(sourceId: string, direction: -1 | 1) {
    const sourceIndex = sources.findIndex((item) => item.id === sourceId);
    const nextIndex = sourceIndex + direction;
    if (sourceIndex < 0 || nextIndex < 0 || nextIndex >= sources.length) return;
    const nextSources = [...sources];
    const [source] = nextSources.splice(sourceIndex, 1);
    nextSources.splice(nextIndex, 0, source);
    sources = nextSources;
    pages = nextSources.flatMap((sourceItem) => pages.filter((page) => page.sourceId === sourceItem.id));
    statusMessage = '';
  }

  function removeSource(sourceId: string) {
    pages.filter((item) => item.sourceId === sourceId && item.thumbUrl).forEach((item) => URL.revokeObjectURL(item.thumbUrl!));
    sources = sources.filter((item) => item.id !== sourceId);
    pages = pages.filter((item) => item.sourceId !== sourceId);
    statusMessage = '';
  }

  function clearFiles() {
    cleanupThumbs();
    sources = [];
    pages = [];
    statusMessage = '';
    errorMessage = '';
  }

  async function mergePdfFiles() {
    if (!canMerge) {
      errorMessage = t.needPages;
      return;
    }
    isMerging = true;
    errorMessage = '';
    statusMessage = '';
    try {
      const mergedPdf = await PDFDocument.create();
      const loadedSources = new Map<string, PDFDocument>();
      for (const pageItem of pages) {
        const source = sources.find((item) => item.id === pageItem.sourceId);
        if (!source || source.error) continue;
        let sourcePdf = loadedSources.get(source.id);
        if (!sourcePdf) {
          sourcePdf = await PDFDocument.load(await source.file.arrayBuffer(), { ignoreEncryption: false });
          loadedSources.set(source.id, sourcePdf);
        }
        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageItem.pageIndex]);
        if (pageItem.rotation) {
          copiedPage.setRotation(degrees(normalizeRotation(copiedPage.getRotation().angle + pageItem.rotation)));
        }
        mergedPdf.addPage(copiedPage);
        await yieldToBrowser();
      }
      const mergedBytes = await mergedPdf.save({ useObjectStreams: true });
      saveAs(new Blob([new Uint8Array(mergedBytes)], { type: 'application/pdf' }), t.downloadName);
      statusMessage = t.ready;
    } catch {
      errorMessage = t.mergeError;
    } finally {
      isMerging = false;
    }
  }

  function thumbStyle(rotation: number) {
    const scale = rotation === 90 || rotation === 270 ? 0.72 : 1;
    return `transform: rotate(${rotation}deg) scale(${scale});`;
  }

  function sourcePages(sourceId: string) {
    return pages.filter((item) => item.sourceId === sourceId).length;
  }

  function normalizeRotation(value: number) {
    return ((value % 360) + 360) % 360;
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function newId() {
    return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }

  function cleanupThumbs() {
    pages.forEach((item) => { if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl); });
  }

  function yieldToBrowser() {
    return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }

  onDestroy(cleanupThumbs);
</script>

<section class="merge-pro" aria-labelledby="merge-tool-title">
  <div class="merge-pro__hero">
    <div>
      <span class="merge-pro__eyebrow">PDFWorld</span>
      <h2 id="merge-tool-title">{t.title}</h2>
      <p>{t.description}</p>
    </div>
    <div class="merge-pro__summary" aria-live="polite">
      <strong>{pages.length}</strong>
      <span>{t.finalPages}</span>
      <small>{sources.length} PDF · {totalSourcePages} {t.pages}</small>
    </div>
  </div>

  <PdfDropzone multiple title={t.dropTitle} activeTitle={t.dropActive} subtitle={t.dropText} help={t.fileHelp} onFiles={addFiles} onInvalidFiles={handleInvalidFiles} />

  {#if errorMessage}<p class="merge-pro__message merge-pro__message--error" role="alert">{errorMessage}</p>{/if}
  {#if statusMessage}<p class="merge-pro__message merge-pro__message--success" role="status">{statusMessage}</p>{/if}
  {#if isRendering}<p class="merge-pro__message" role="status">{t.rendering}</p>{/if}

  {#if sources.length === 0}
    <p class="merge-pro__empty">{t.noFiles}</p>
  {:else}
    <div class="merge-pro__layout">
      <aside class="merge-pro__sources" aria-labelledby="sources-title">
        <div class="merge-pro__panel-head">
          <h3 id="sources-title">{t.selectedFiles}</h3>
          <button type="button" class="merge-pro__secondary" on:click={clearFiles}>{t.clear}</button>
        </div>
        {#each sources as source, index (source.id)}
          <article class:merge-pro__source={true} class:merge-pro__source--error={Boolean(source.error)}>
            <div class="merge-pro__source-main">
              <span class="merge-pro__file-icon">PDF</span>
              <div>
                <strong>{source.file.name}</strong>
                <p>{formatSize(source.file.size)} · {sourcePages(source.id) || source.pageCount} {t.pages}</p>
                {#if source.error}<p class="merge-pro__file-error">{source.error}</p>{/if}
              </div>
            </div>
            <div class="merge-pro__source-actions">
              <button type="button" on:click={() => moveSource(source.id, -1)} disabled={index === 0}>{t.movePdfUp}</button>
              <button type="button" on:click={() => moveSource(source.id, 1)} disabled={index === sources.length - 1}>{t.movePdfDown}</button>
              <button type="button" on:click={() => removeSource(source.id)}>{t.removePdf}</button>
            </div>
          </article>
        {/each}
        <button type="button" class="merge-pro__primary" disabled={!canMerge} on:click={mergePdfFiles}>{isMerging ? t.merging : t.merge}</button>
      </aside>

      <section class="merge-pro__pages" aria-labelledby="pages-title">
        <h3 id="pages-title">{t.pagesEditor}</h3>
        <div class="merge-pro__page-grid">
          {#each pages as item, index (item.id)}
            <article class="merge-pro__page-card">
              <div class="merge-pro__thumb-frame">
                <div class="merge-pro__thumb" style={thumbStyle(item.rotation)}>
                  {#if item.thumbStatus === 'ready' && item.thumbUrl}
                    <img src={item.thumbUrl} alt={`${t.page} ${item.pageNumber} ${t.from} ${item.fileName}`} loading="lazy" />
                  {:else}
                    <span class:merge-pro__placeholder={true} class:merge-pro__placeholder--loading={item.thumbStatus === 'pending'}>{item.pageNumber}</span>
                  {/if}
                </div>
              </div>
              <div class="merge-pro__page-meta">
                <strong>{t.page} {item.pageNumber}</strong>
                <span>{item.rotation}°</span>
              </div>
              <small class="merge-pro__page-file">{item.fileName}</small>
              <div class="merge-pro__page-actions">
                <button type="button" aria-label={t.movePageUp} on:click={() => movePage(index, -1)} disabled={index === 0}>↑</button>
                <button type="button" aria-label={t.movePageDown} on:click={() => movePage(index, 1)} disabled={index === pages.length - 1}>↓</button>
                <button type="button" aria-label={t.rotateLeft} on:click={() => rotatePage(item.id, -90)}>↶</button>
                <button type="button" aria-label={t.rotateRight} on:click={() => rotatePage(item.id, 90)}>↷</button>
                <button type="button" aria-label={t.removePage} on:click={() => removePage(item.id)}>×</button>
              </div>
            </article>
          {/each}
        </div>
      </section>
    </div>
  {/if}
</section>

<style>
  .merge-pro{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:radial-gradient(circle at top left,rgba(239,68,68,.12),transparent 34%),linear-gradient(135deg,rgba(255,255,255,.97),rgba(248,250,252,.9));box-shadow:0 30px 90px rgba(15,23,42,.11)}.merge-pro__hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.merge-pro__hero h2,.merge-pro__panel-head h3,.merge-pro__pages h3{margin:0}.merge-pro__hero h2{font-size:clamp(1.65rem,3vw,2.25rem);letter-spacing:-.04em}.merge-pro__hero p,.merge-pro__empty,.merge-pro__source p{margin:0;color:#64748b}.merge-pro__eyebrow{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:rgba(239,68,68,.1);color:#b91c1c;font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.merge-pro__summary{display:grid;min-width:148px;gap:2px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:22px;background:rgba(255,255,255,.78);text-align:right}.merge-pro__summary strong{font-size:1.9rem;line-height:1}.merge-pro__summary span,.merge-pro__summary small{color:#64748b;font-weight:800}.merge-pro__message,.merge-pro__empty{margin:0;padding:13px 15px;border-radius:16px;background:#f8fafc;font-weight:850}.merge-pro__message--error{background:#fff1f2;color:#991b1b}.merge-pro__message--success{background:#ecfdf5;color:#166534}.merge-pro__layout{display:grid;grid-template-columns:340px minmax(0,1fr);gap:20px;align-items:start}.merge-pro__sources{position:sticky;top:18px;display:grid;gap:12px}.merge-pro__panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.merge-pro__source{display:grid;gap:12px;padding:14px;border:1px solid #e2e8f0;border-radius:20px;background:#fff;box-shadow:0 12px 34px rgba(15,23,42,.06)}.merge-pro__source--error{border-color:#fecaca;background:#fff1f2}.merge-pro__source-main{display:flex;gap:12px;min-width:0}.merge-pro__source-main strong,.merge-pro__page-file{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.merge-pro__source-main strong{max-width:230px}.merge-pro__file-icon{display:grid;flex:0 0 auto;width:42px;height:48px;place-items:center;border-radius:12px;background:#fff1f2;color:#dc2626;font-size:.72rem;font-weight:950}.merge-pro__file-error{color:#991b1b!important}.merge-pro__source-actions,.merge-pro__page-actions{display:flex;flex-wrap:wrap;gap:8px}.merge-pro button{border:0;cursor:pointer;font:inherit;font-weight:850;transition:transform 140ms ease,opacity 140ms ease}.merge-pro__source-actions button,.merge-pro__secondary,.merge-pro__page-actions button{padding:8px 10px;border-radius:999px;background:#e2e8f0;color:#334155}.merge-pro__primary{width:100%;min-height:48px;padding:12px 16px;border-radius:999px;background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;box-shadow:0 16px 34px rgba(239,68,68,.28)}.merge-pro button:hover:not(:disabled){transform:translateY(-1px)}.merge-pro button:disabled{cursor:not-allowed;opacity:.45}.merge-pro__pages{display:grid;gap:14px}.merge-pro__page-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}.merge-pro__page-card{display:grid;gap:10px;padding:12px;border:2px solid #e2e8f0;border-radius:22px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,.06)}.merge-pro__thumb-frame{display:grid;min-height:190px;place-items:center;overflow:hidden;border:1px solid #e2e8f0;border-radius:16px;background:linear-gradient(135deg,#f8fafc,#fff1f2)}.merge-pro__thumb{display:grid;width:82%;place-items:center;transition:transform 180ms ease}.merge-pro__thumb img{display:block;width:100%;height:auto;box-shadow:0 12px 26px rgba(15,23,42,.16);pointer-events:none}.merge-pro__placeholder{display:grid;width:100%;min-height:138px;place-items:center;border-radius:12px;background:#f1f5f9;color:#94a3b8;font-size:1.35rem;font-weight:950}.merge-pro__placeholder--loading{background:linear-gradient(100deg,#f1f5f9 20%,#fff 45%,#f1f5f9 70%);background-size:220% 100%;animation:thumb-loading 1.4s ease-in-out infinite}.merge-pro__page-meta{display:flex;justify-content:space-between;gap:8px;align-items:center}.merge-pro__page-meta span{padding:5px 9px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:950;font-size:.82rem}.merge-pro__page-file{color:#64748b;font-size:.8rem}.merge-pro__page-actions{display:grid;grid-template-columns:repeat(5,1fr)}.merge-pro__page-actions button{min-height:36px;padding:6px}.merge-pro__page-actions button:last-child{background:#fee2e2;color:#991b1b}@keyframes thumb-loading{0%{background-position:120% 0}100%{background-position:-120% 0}}@media (prefers-reduced-motion:reduce){.merge-pro button,.merge-pro__thumb{transition:none}.merge-pro__placeholder--loading{animation:none}}@media (max-width:900px){.merge-pro__hero,.merge-pro__layout{grid-template-columns:1fr;display:grid}.merge-pro__sources{position:static}.merge-pro__summary{text-align:left}.merge-pro__page-grid{grid-template-columns:repeat(auto-fill,minmax(136px,1fr))}.merge-pro__thumb-frame{min-height:160px}}
</style>
