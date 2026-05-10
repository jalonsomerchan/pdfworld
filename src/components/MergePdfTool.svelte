<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { PDFDocument, degrees } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import UploadedFilesList, { type UploadedFileItem } from './UploadedFilesList.svelte';
  import { createPdfObjectUrl, formatFileSize, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';
  type ThumbStatus = 'pending' | 'ready' | 'failed';

  interface SourcePdf { id: string; file: File; pageCount: number; error?: string; }
  interface PageItem { id: string; sourceId: string; fileName: string; pageIndex: number; pageNumber: number; rotation: number; thumbUrl?: string; thumbStatus: ThumbStatus; }

  export let lang: Lang = 'es';

  const labels = {
    es: {
      title: 'Une PDF editando sus páginas', description: 'Carga varios PDF, arrastra páginas o PDFs completos, elimina páginas, rótalas y revisa el resultado antes de descargar.',
      dropTitle: 'Arrastra tus PDF aquí', dropText: 'Suelta los archivos o pulsa para seleccionarlos', dropActive: 'Suelta para añadirlos al editor', fileHelp: 'Solo PDF · privado · procesamiento local en navegador',
      selectedFiles: 'PDF cargados', pagesEditor: 'Editor de páginas', noFiles: 'Todavía no has seleccionado ningún PDF.', pages: 'páginas', finalPages: 'páginas finales',
      dragHint: 'Arrastra las tarjetas para cambiar el orden final. También puedes reordenar los PDFs completos desde la lista de archivos.', removePdf: 'Eliminar PDF', rotateLeft: 'Girar izquierda', rotateRight: 'Girar derecha', removePage: 'Eliminar página',
      clear: 'Limpiar', generatePreview: 'Generar vista previa', generating: 'Generando PDF…', download: 'Descargar PDF', rendering: 'Generando miniaturas… puedes editar mientras tanto.', downloadName: 'FácilPDF-unido.pdf',
      invalidFiles: 'Algunos archivos no son PDF y se han ignorado.', readError: 'No se pudo leer este PDF. Puede estar dañado o protegido.', needPages: 'Añade al menos una página válida para generar el PDF.', mergeError: 'No se pudo generar el PDF. Revisa que los archivos no estén dañados o protegidos.', ready: 'PDF generado correctamente. Revisa la vista previa antes de descargar.',
      page: 'Página', from: 'de', previewTitle: 'Vista previa del PDF unido', closePreview: 'Cerrar vista previa', previewFallback: 'Tu navegador no puede mostrar la vista previa del PDF. Descárgalo para revisarlo.', dropHere: 'Soltar aquí',
      filesSummary: 'PDF preparados', moveUp: 'Subir', moveDown: 'Bajar', fileReady: 'Listo',
    },
    en: {
      title: 'Merge PDFs by editing pages', description: 'Load several PDFs, drag pages or whole PDFs, delete pages, rotate them and preview the result before downloading.',
      dropTitle: 'Drag your PDFs here', dropText: 'Drop files or click to select them', dropActive: 'Drop to add them to the editor', fileHelp: 'PDF only · private · local browser processing',
      selectedFiles: 'Loaded PDFs', pagesEditor: 'Page editor', noFiles: 'No PDF files selected yet.', pages: 'pages', finalPages: 'final pages',
      dragHint: 'Drag cards to change the final order. You can also reorder whole PDFs from the files list.', removePdf: 'Remove PDF', rotateLeft: 'Rotate left', rotateRight: 'Rotate right', removePage: 'Delete page',
      clear: 'Clear', generatePreview: 'Generate preview', generating: 'Generating PDF…', download: 'Download PDF', rendering: 'Generating thumbnails… you can edit meanwhile.', downloadName: 'FácilPDF-merged.pdf',
      invalidFiles: 'Some files were not PDFs and were ignored.', readError: 'This PDF could not be read. It may be damaged or protected.', needPages: 'Add at least one valid page to generate the PDF.', mergeError: 'The PDF could not be generated. Check that files are not damaged or protected.', ready: 'PDF created successfully. Review the preview before downloading.',
      page: 'Page', from: 'from', previewTitle: 'Merged PDF preview', closePreview: 'Close preview', previewFallback: 'Your browser cannot display the PDF preview. Download it to review it.', dropHere: 'Drop here',
      filesSummary: 'PDF ready', moveUp: 'Move up', moveDown: 'Move down', fileReady: 'Ready',
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
  let resultBytes: Uint8Array | null = null;
  let previewUrl = '';
  let isPreviewOpen = false;
  let draggedPageId = '';
  let dragOverPageId = '';
  let editorRegion: HTMLDivElement;

  $: t = labels[lang] ?? labels.es;
  $: validSources = sources.filter((item) => !item.error);
  $: canGenerate = pages.length > 0 && validSources.length > 0 && !isMerging;
  $: canDownload = Boolean(resultBytes && !isMerging);
  $: totalSourcePages = sources.reduce((sum, item) => sum + item.pageCount, 0);
  $: uploadedFileItems = sources.map((source): UploadedFileItem => ({
    id: source.id,
    name: source.file.name,
    size: `${formatFileSize(source.file.size)} · ${sourcePages(source.id) || source.pageCount} ${t.pages}`,
    type: source.file.type || 'application/pdf',
    status: source.error ? 'error' : 'ready',
    statusLabel: source.error ?? t.fileReady,
  }));

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')]).then(([pdfJs, worker]) => {
        pdfJs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfJs;
      });
    }
    return pdfJsPromise;
  }

  async function addFiles(selectedFiles: File[]) {
    if (!selectedFiles.length) return;
    errorMessage = ''; statusMessage = '';
    for (const file of selectedFiles) {
      const id = newId();
      try {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes.slice(0), { ignoreEncryption: false });
        const pageCount = pdf.getPageCount();
        const source: SourcePdf = { id, file, pageCount };
        const sourcePages = Array.from({ length: pageCount }, (_, index): PageItem => ({ id: `${id}-${index}-${newId()}`, sourceId: id, fileName: file.name, pageIndex: index, pageNumber: index + 1, rotation: 0, thumbStatus: 'pending' }));
        sources = [...sources, source];
        pages = [...pages, ...sourcePages];
        clearResult();
        void renderSourceThumbnails(source, sourcePages);
      } catch { sources = [...sources, { id, file, pageCount: 0, error: t.readError }]; }
    }
    await scrollToEditor();
  }

  function handleInvalidFiles() { errorMessage = t.invalidFiles; }

  async function renderSourceThumbnails(source: SourcePdf, sourcePages: PageItem[]) {
    const token = ++renderToken; isRendering = true;
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
        } catch { updatePage(item.id, { thumbStatus: 'failed' }); }
      }
      await pdfDoc.destroy();
    } catch { sourcePages.forEach((item) => updatePage(item.id, { thumbStatus: 'failed' })); }
    finally { isRendering = false; }
  }

  async function renderPageThumb(pdfPage: any) {
    const viewport = pdfPage.getViewport({ scale: 0.25 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('No canvas context');
    canvas.width = Math.max(1, Math.floor(viewport.width)); canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78));
    if (!blob) throw new Error('No thumbnail blob');
    return URL.createObjectURL(blob);
  }

  function updatePage(pageId: string, patch: Partial<PageItem>) { pages = pages.map((item) => (item.id === pageId ? { ...item, ...patch } : item)); }

  function onPageDragStart(event: DragEvent, pageId: string) {
    draggedPageId = pageId; dragOverPageId = '';
    event.dataTransfer?.setData('text/plain', pageId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  function onPageDragOver(event: DragEvent, pageId: string) { event.preventDefault(); dragOverPageId = pageId; if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; }
  function onPageDrop(event: DragEvent, targetPageId: string) {
    event.preventDefault();
    const sourcePageId = draggedPageId || event.dataTransfer?.getData('text/plain') || '';
    draggedPageId = ''; dragOverPageId = '';
    if (!sourcePageId || sourcePageId === targetPageId) return;
    const fromIndex = pages.findIndex((item) => item.id === sourcePageId);
    const toIndex = pages.findIndex((item) => item.id === targetPageId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextPages = [...pages];
    const [item] = nextPages.splice(fromIndex, 1);
    nextPages.splice(toIndex, 0, item);
    pages = nextPages; clearResult(); statusMessage = '';
  }

  function reorderSource(sourceId: string, direction: -1 | 1) {
    const fromIndex = sources.findIndex((item) => item.id === sourceId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= sources.length) return;

    const nextSources = [...sources];
    const [source] = nextSources.splice(fromIndex, 1);
    nextSources.splice(toIndex, 0, source);
    sources = nextSources;
    pages = nextSources.flatMap((sourceItem) => pages.filter((page) => page.sourceId === sourceItem.id));
    clearResult();
    statusMessage = '';
  }

  function rotatePage(pageId: string, delta: 90 | -90) { pages = pages.map((item) => item.id === pageId ? { ...item, rotation: normalizeRotation(item.rotation + delta) } : item); clearResult(); statusMessage = ''; }
  function removePage(pageId: string) { const page = pages.find((item) => item.id === pageId); if (page?.thumbUrl) URL.revokeObjectURL(page.thumbUrl); pages = pages.filter((item) => item.id !== pageId); clearResult(); statusMessage = ''; }
  function removeSource(sourceId: string) { pages.filter((item) => item.sourceId === sourceId && item.thumbUrl).forEach((item) => URL.revokeObjectURL(item.thumbUrl!)); sources = sources.filter((item) => item.id !== sourceId); pages = pages.filter((item) => item.sourceId !== sourceId); clearResult(); statusMessage = ''; }
  function clearFiles() { cleanupThumbs(); clearResult(); sources = []; pages = []; statusMessage = ''; errorMessage = ''; }

  async function buildMergedPdf() {
    const mergedPdf = await PDFDocument.create();
    const loadedSources = new Map<string, PDFDocument>();
    for (const pageItem of pages) {
      const source = sources.find((item) => item.id === pageItem.sourceId);
      if (!source || source.error) continue;
      let sourcePdf = loadedSources.get(source.id);
      if (!sourcePdf) { sourcePdf = await PDFDocument.load(await source.file.arrayBuffer(), { ignoreEncryption: false }); loadedSources.set(source.id, sourcePdf); }
      const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageItem.pageIndex]);
      if (pageItem.rotation) copiedPage.setRotation(degrees(normalizeRotation(copiedPage.getRotation().angle + pageItem.rotation)));
      mergedPdf.addPage(copiedPage);
      await yieldToBrowser();
    }
    return mergedPdf.save({ useObjectStreams: true });
  }

  async function generatePreview() {
    if (!canGenerate) { errorMessage = t.needPages; return; }
    isMerging = true; errorMessage = ''; statusMessage = ''; clearResult();
    try {
      const bytes = await buildMergedPdf();
      resultBytes = new Uint8Array(bytes);
      previewUrl = createPdfObjectUrl(resultBytes);
      isPreviewOpen = true;
      statusMessage = t.ready;
    } catch { errorMessage = t.mergeError; }
    finally { isMerging = false; }
  }

  function closePreview() { isPreviewOpen = false; }

  function thumbStyle(rotation: number) { const scale = rotation === 90 || rotation === 270 ? 0.72 : 1; return `transform: rotate(${rotation}deg) scale(${scale});`; }
  function sourcePages(sourceId: string) { return pages.filter((item) => item.sourceId === sourceId).length; }
  function normalizeRotation(value: number) { return ((value % 360) + 360) % 360; }
  function newId() { return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
  function cleanupThumbs() { pages.forEach((item) => { if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl); }); }
  function clearResult() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; resultBytes = null; isPreviewOpen = false; }
  async function scrollToEditor() { await tick(); editorRegion?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  onDestroy(() => { cleanupThumbs(); clearResult(); });
</script>

<section class="merge-pro" aria-labelledby="merge-tool-title">
  <div class="merge-pro__hero">
    <div><span class="merge-pro__eyebrow">FácilPDF</span><h2 id="merge-tool-title">{t.title}</h2><p>{t.description}</p></div>
    <div class="merge-pro__summary" aria-live="polite"><strong>{pages.length}</strong><span>{t.finalPages}</span><small>{sources.length} PDF · {totalSourcePages} {t.pages}</small></div>
  </div>

  <PdfDropzone multiple title={t.dropTitle} activeTitle={t.dropActive} subtitle={t.dropText} help={t.fileHelp} onFiles={addFiles} onInvalidFiles={handleInvalidFiles} />
  {#if errorMessage}<p class="merge-pro__message merge-pro__message--error" role="alert">{errorMessage}</p>{/if}
  {#if statusMessage}<p class="merge-pro__message merge-pro__message--success" role="status">{statusMessage}</p>{/if}
  {#if isRendering}<p class="merge-pro__message" role="status">{t.rendering}</p>{/if}

  {#if sources.length === 0}
    <p class="merge-pro__empty">{t.noFiles}</p>
  {:else}
    <div class="merge-pro__layout" bind:this={editorRegion}>
      <aside class="merge-pro__sources" aria-labelledby="sources-title">
        <div class="merge-pro__panel-head"><h3 id="sources-title">{t.selectedFiles}</h3><button type="button" class="merge-pro__secondary" on:click={clearFiles}>{t.clear}</button></div>
        <UploadedFilesList
          files={uploadedFileItems}
          title={t.selectedFiles}
          summaryLabel={t.filesSummary}
          removeLabel={t.removePdf}
          moveUpLabel={t.moveUp}
          moveDownLabel={t.moveDown}
          reorderable={true}
          onRemove={(file) => removeSource(file.id)}
          onMoveUp={(file) => reorderSource(file.id, -1)}
          onMoveDown={(file) => reorderSource(file.id, 1)}
        />
        <button type="button" class="merge-pro__primary" disabled={!canGenerate} on:click={generatePreview}>{isMerging ? t.generating : t.generatePreview}</button>
        <button type="button" class="merge-pro__primary merge-pro__primary--dark" disabled={!canDownload} on:click={() => (isPreviewOpen = true)}>{t.download}</button>
      </aside>

      <section class="merge-pro__pages" aria-labelledby="pages-title">
        <div class="merge-pro__pages-head"><h3 id="pages-title">{t.pagesEditor}</h3><p>{t.dragHint}</p></div>
        <div class="merge-pro__page-grid">
          {#each pages as item (item.id)}
            <article draggable="true" on:dragstart={(event) => onPageDragStart(event, item.id)} on:dragover={(event) => onPageDragOver(event, item.id)} on:drop={(event) => onPageDrop(event, item.id)} on:dragend={() => (dragOverPageId = '')} class:merge-pro__page-card={true} class:merge-pro__page-card--over={dragOverPageId === item.id}>
              <div class="merge-pro__thumb-frame"><div class="merge-pro__thumb" style={thumbStyle(item.rotation)}>{#if item.thumbStatus === 'ready' && item.thumbUrl}<img src={item.thumbUrl} alt={`${t.page} ${item.pageNumber} ${t.from} ${item.fileName}`} loading="lazy" />{:else}<span class:merge-pro__placeholder={true} class:merge-pro__placeholder--loading={item.thumbStatus === 'pending'}>{item.pageNumber}</span>{/if}</div></div>
              <div class="merge-pro__page-meta"><strong>{t.page} {item.pageNumber}</strong><span>{item.rotation}°</span></div>
              <small class="merge-pro__page-file">{item.fileName}</small>
              <div class="merge-pro__page-actions"><button type="button" aria-label={t.rotateLeft} on:click={() => rotatePage(item.id, -90)}>↶</button><button type="button" aria-label={t.rotateRight} on:click={() => rotatePage(item.id, 90)}>↷</button><button type="button" aria-label={t.removePage} on:click={() => removePage(item.id)}>×</button></div>
            </article>
          {/each}
        </div>
      </section>
    </div>
  {/if}
</section>

<PdfResultModal
  open={isPreviewOpen && Boolean(previewUrl)}
  pdfUrl={previewUrl}
  filename={t.downloadName}
  title={t.previewTitle}
  description={t.ready}
  downloadLabel={t.download}
  closeLabel={t.closePreview}
  on:close={closePreview}
/>

<style>
  .merge-pro{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:radial-gradient(circle at top left,rgba(239,68,68,.12),transparent 34%),linear-gradient(135deg,rgba(255,255,255,.97),rgba(248,250,252,.9));box-shadow:0 30px 90px rgba(15,23,42,.11)}.merge-pro__hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.merge-pro__hero h2,.merge-pro__panel-head h3,.merge-pro__pages h3{margin:0}.merge-pro__hero h2{font-size:clamp(1.65rem,3vw,2.25rem);letter-spacing:-.04em}.merge-pro__hero p,.merge-pro__empty,.merge-pro__pages-head p{margin:0;color:#64748b}.merge-pro__eyebrow{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:rgba(239,68,68,.1);color:#b91c1c;font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.merge-pro__summary{display:grid;min-width:148px;gap:2px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:22px;background:rgba(255,255,255,.78);text-align:right}.merge-pro__summary strong{font-size:1.9rem;line-height:1}.merge-pro__summary span,.merge-pro__summary small{color:#64748b;font-weight:800}.merge-pro__message,.merge-pro__empty{margin:0;padding:13px 15px;border-radius:16px;background:#f8fafc;font-weight:850}.merge-pro__message--error{background:#fff1f2;color:#991b1b}.merge-pro__message--success{background:#ecfdf5;color:#166534}.merge-pro__layout{display:grid;grid-template-columns:380px minmax(0,1fr);gap:20px;align-items:start}.merge-pro__sources{position:sticky;top:18px;display:grid;gap:12px}.merge-pro__panel-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.merge-pro button{border:0;cursor:pointer;font:inherit;font-weight:850;transition:transform 140ms ease,opacity 140ms ease}.merge-pro__secondary{padding:8px 10px;border-radius:999px;background:#e2e8f0;color:#334155}.merge-pro__primary{width:100%;min-height:48px;padding:12px 16px;border-radius:999px;background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;box-shadow:0 16px 34px rgba(239,68,68,.28)}.merge-pro__primary--dark{background:linear-gradient(135deg,#0f172a,#334155);box-shadow:0 16px 34px rgba(15,23,42,.22)}.merge-pro button:hover:not(:disabled){transform:translateY(-1px)}.merge-pro button:disabled{cursor:not-allowed;opacity:.45}.merge-pro__pages{display:grid;gap:14px}.merge-pro__pages-head{display:grid;gap:4px}.merge-pro__page-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}.merge-pro__page-card{display:grid;gap:10px;padding:12px;border:2px solid #e2e8f0;border-radius:22px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,.06);cursor:grab}.merge-pro__page-card:active{cursor:grabbing}.merge-pro__page-card--over{border-color:#ef4444!important;box-shadow:0 0 0 4px rgba(239,68,68,.12),0 18px 44px rgba(15,23,42,.12)!important}.merge-pro__thumb-frame{display:grid;min-height:190px;place-items:center;overflow:hidden;border:1px solid #e2e8f0;border-radius:16px;background:linear-gradient(135deg,#f8fafc,#fff1f2)}.merge-pro__thumb{display:grid;width:82%;place-items:center;transition:transform 180ms ease}.merge-pro__thumb img{display:block;width:100%;height:auto;box-shadow:0 12px 26px rgba(15,23,42,.16);pointer-events:none}.merge-pro__placeholder{display:grid;width:100%;min-height:138px;place-items:center;border-radius:12px;background:#f1f5f9;color:#94a3b8;font-size:1.35rem;font-weight:950}.merge-pro__placeholder--loading{background:linear-gradient(100deg,#f1f5f9 20%,#fff 45%,#f1f5f9 70%);background-size:220% 100%;animation:thumb-loading 1.4s ease-in-out infinite}.merge-pro__page-meta{display:flex;justify-content:space-between;gap:8px;align-items:center}.merge-pro__page-meta span{padding:5px 9px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:950;font-size:.82rem}.merge-pro__page-file{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:.8rem}.merge-pro__page-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.merge-pro__page-actions button{min-height:38px;padding:6px;border-radius:999px;background:#e2e8f0;color:#334155}.merge-pro__page-actions button:last-child{background:#fee2e2;color:#991b1b}.pdf-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px}.pdf-modal__backdrop{position:absolute;inset:0;background:rgba(15,23,42,.72);backdrop-filter:blur(6px)}.pdf-modal__panel{position:relative;z-index:1;display:grid;grid-template-rows:auto minmax(0,1fr);width:min(1120px,96vw);height:min(820px,92vh);overflow:hidden;border-radius:24px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.35)}.pdf-modal__header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid #e2e8f0}.pdf-modal__header h2{margin:0;font-size:1.05rem}.pdf-modal__header div{display:flex;gap:10px;align-items:center}.pdf-modal__viewer{width:100%;height:100%;border:0;background:#f8fafc}.pdf-modal__download,.pdf-modal__close{border:0;cursor:pointer;font:inherit;font-weight:950}.pdf-modal__download{min-height:40px;padding:9px 14px;border-radius:999px;background:#ef4444;color:#fff}.pdf-modal__close{display:grid;width:40px;height:40px;place-items:center;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:1.35rem;line-height:1}@keyframes thumb-loading{0%{background-position:120% 0}100%{background-position:-120% 0}}@media (prefers-reduced-motion:reduce){.merge-pro button,.merge-pro__thumb{transition:none}.merge-pro__placeholder--loading{animation:none}}@media (max-width:900px){.merge-pro__hero,.merge-pro__layout{grid-template-columns:1fr;display:grid}.merge-pro__sources{position:static}.merge-pro__summary{text-align:left}.merge-pro__page-grid{grid-template-columns:repeat(auto-fill,minmax(136px,1fr))}.merge-pro__thumb-frame{min-height:160px}.pdf-modal{padding:10px}.pdf-modal__panel{height:94vh;border-radius:18px}}
</style>
