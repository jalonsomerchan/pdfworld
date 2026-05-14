<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import ProcessingState from './ProcessingState.svelte';
  import ResultState from './ResultState.svelte';
  import { createPdfObjectUrl, formatFileSize, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';
  type ThumbStatus = 'pending' | 'ready' | 'failed';
  type OutputMode = 'all' | 'selected';
  type TextMode = 'none' | 'all' | 'selected';

  interface SourcePdf {
    id: string;
    file: File;
    pageCount: number;
    pageLabels?: string[];
    error?: string;
  }

  interface PageItem {
    id: string;
    sourceId: string;
    fileName: string;
    pageIndex: number;
    pageNumber: number;
    pageLabel: string;
    rotation: number;
    kept: boolean;
    selected: boolean;
    thumbUrl?: string;
    thumbStatus: ThumbStatus;
  }

  export let lang: Lang = 'es';

  const copy = {
    es: {
      title: 'Multiherramienta PDF',
      intro: 'Sube PDFs, arrastra páginas, rota, elimina y descarga el resultado. Simple y privado.',
      dropTitle: 'Arrastra tus PDF aquí',
      dropActive: 'Suelta para añadir al editor',
      dropText: 'Suelta archivos o pulsa para seleccionarlos',
      fileHelp: 'PDF · privado · procesamiento local',
      noFiles: 'Carga uno o varios PDF para empezar.',
      invalidFiles: 'Algunos archivos no son PDF y se han ignorado.',
      readError: 'No se pudo leer este PDF. Puede estar dañado o protegido.',
      rendering: 'Generando miniaturas…',
      page: 'Página',
      selected: 'seleccionadas',
      finalPages: 'páginas',
      files: 'archivos',
      outputAll: 'Todo el PDF',
      outputSelected: 'Solo seleccionadas',
      addText: 'Añadir texto',
      textPlaceholder: 'Texto, sello o marca de agua…',
      generate: 'Generar PDF',
      generating: 'Generando PDF…',
      preview: 'Vista previa',
      download: 'Descargar PDF',
      clear: 'Limpiar',
      readyTitle: 'PDF listo',
      ready: 'Tu PDF se ha generado correctamente.',
      needPages: 'Debe quedar al menos una página.',
      needSelected: 'Selecciona al menos una página.',
      createError: 'No se pudo generar el PDF. Revisa que los archivos no estén protegidos.',
      previewTitle: 'Vista previa del PDF',
      closePreview: 'Cerrar vista previa',
      outputName: 'facilpdf-multiherramienta.pdf',
      rotateLeft: 'Girar izquierda',
      rotateRight: 'Girar derecha',
      deletePage: 'Eliminar página',
      toggleSelected: 'Seleccionar o deseleccionar página',
      dragPage: 'Arrastra para reordenar',
      removePdf: 'Eliminar PDF',
      selectAll: 'Seleccionar todas',
      deselectAll: 'Deseleccionar todas',
    },
    en: {
      title: 'PDF multitool',
      intro: 'Upload PDFs, drag pages, rotate, delete and download the result. Simple and private.',
      dropTitle: 'Drag your PDFs here',
      dropActive: 'Drop to add to the editor',
      dropText: 'Drop files or click to select them',
      fileHelp: 'PDF · private · local processing',
      noFiles: 'Load one or more PDFs to start.',
      invalidFiles: 'Some files were not PDFs and were ignored.',
      readError: 'This PDF could not be read. It may be damaged or protected.',
      rendering: 'Generating thumbnails…',
      page: 'Page',
      selected: 'selected',
      finalPages: 'pages',
      files: 'files',
      outputAll: 'Whole PDF',
      outputSelected: 'Selected only',
      addText: 'Add text',
      textPlaceholder: 'Text, stamp or watermark…',
      generate: 'Generate PDF',
      generating: 'Generating PDF…',
      preview: 'Preview',
      download: 'Download PDF',
      clear: 'Clear',
      readyTitle: 'PDF ready',
      ready: 'Your PDF has been generated successfully.',
      needPages: 'At least one page must remain.',
      needSelected: 'Select at least one page.',
      createError: 'The PDF could not be generated. Check that files are not protected.',
      previewTitle: 'PDF preview',
      closePreview: 'Close preview',
      outputName: 'facilpdf-multitool.pdf',
      rotateLeft: 'Rotate left',
      rotateRight: 'Rotate right',
      deletePage: 'Delete page',
      toggleSelected: 'Select or deselect page',
      dragPage: 'Drag to reorder',
      removePdf: 'Remove PDF',
      selectAll: 'Select all',
      deselectAll: 'Deselect all',
    },
  } as const;

  let sources: SourcePdf[] = [];
  let pages: PageItem[] = [];
  let pdfJsPromise: Promise<any> | null = null;
  let renderToken = 0;
  let isRendering = false;
  let isGenerating = false;
  let errorMessage = '';
  let statusMessage = '';
  let previewUrl = '';
  let isPreviewOpen = false;
  let resultBytes: Uint8Array | null = null;
  let outputMode: OutputMode = 'all';
  let textMode: TextMode = 'none';
  let textValue = '';
  let textSize = 34;
  let textOpacity = 0.22;
  let draggedPageId = '';
  let dragOverPageId = '';
  let workspaceRegion: HTMLDivElement;

  $: t = copy[lang] ?? copy.es;
  $: visiblePages = pages.filter((page) => page.kept);
  $: selectedPages = visiblePages.filter((page) => page.selected);
  $: exportPages = outputMode === 'selected' ? selectedPages : visiblePages;
  $: totalSourcePages = sources.reduce((sum, source) => sum + source.pageCount, 0);
  $: canGenerate = exportPages.length > 0 && !isGenerating;

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
          pageLabel: String(index + 1),
          rotation: 0,
          kept: true,
          selected: true,
          thumbStatus: 'pending',
        }));

        sources = [...sources, source];
        pages = [...pages, ...sourcePages];
        clearResult();
        void renderSourceThumbnails(source, sourcePages);
      } catch {
        sources = [...sources, { id, file, pageCount: 0, error: t.readError }];
      }
    }

    await tick();
    workspaceRegion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      const pdfDoc = await pdfJs.getDocument({
        data: bytes,
        useWorkerFetch: false,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
      }).promise;

      const pageLabels = await readPageLabels(pdfDoc, sourcePages.length);
      if (pageLabels.some((label, index) => label !== String(index + 1))) {
        sources = sources.map((item) => (item.id === source.id ? { ...item, pageLabels } : item));
        sourcePages.forEach((item) => updatePage(item.id, { pageLabel: pageLabels[item.pageIndex] }));
      }

      for (const item of sourcePages) {
        if (token !== renderToken) return;
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
      if (token === renderToken) isRendering = false;
    }
  }

  async function readPageLabels(pdfDoc: any, pageCount: number) {
    try {
      const labels = typeof pdfDoc.getPageLabels === 'function' ? await pdfDoc.getPageLabels() : null;

      return Array.from({ length: pageCount }, (_, index) => {
        const label = Array.isArray(labels) ? labels[index] : '';
        return typeof label === 'string' && label.trim() ? label.trim() : String(index + 1);
      });
    } catch {
      return Array.from({ length: pageCount }, (_, index) => String(index + 1));
    }
  }

  function pageDisplayName(page: PageItem) {
    return page.pageLabel || String(page.pageNumber);
  }

  async function renderPageThumb(pdfPage: any) {
    const viewport = pdfPage.getViewport({ scale: 0.34 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) throw new Error('No canvas context');

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob) throw new Error('No thumbnail blob');

    return URL.createObjectURL(blob);
  }

  function updatePage(pageId: string, patch: Partial<PageItem>) {
    pages = pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page));
  }

  function removeSource(sourceId: string) {
    pages
      .filter((page) => page.sourceId === sourceId && page.thumbUrl)
      .forEach((page) => URL.revokeObjectURL(page.thumbUrl!));
    sources = sources.filter((source) => source.id !== sourceId);
    pages = pages.filter((page) => page.sourceId !== sourceId);
    clearResult();
  }

  function toggleSelected(pageId: string) {
    const page = pages.find((item) => item.id === pageId);
    if (!page?.kept) return;
    updatePage(pageId, { selected: !page.selected });
    clearResult();
  }

  function selectAll(selected: boolean) {
    pages = pages.map((page) => (page.kept ? { ...page, selected } : page));
    clearResult();
  }

  function deletePage(pageId: string) {
    if (visiblePages.length <= 1) {
      errorMessage = t.needPages;
      return;
    }
    updatePage(pageId, { kept: false, selected: false });
    clearResult();
  }

  function rotatePage(pageId: string, delta: 90 | -90) {
    const page = pages.find((item) => item.id === pageId);
    if (!page) return;
    updatePage(pageId, { rotation: normalize(page.rotation + delta) });
    clearResult();
  }

  function onDragStart(event: DragEvent, pageId: string) {
    draggedPageId = pageId;
    dragOverPageId = '';
    event.dataTransfer?.setData('text/plain', pageId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(event: DragEvent, pageId: string) {
    event.preventDefault();
    dragOverPageId = pageId;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  function onDrop(event: DragEvent, targetPageId: string) {
    event.preventDefault();
    const sourcePageId = draggedPageId || event.dataTransfer?.getData('text/plain') || '';
    draggedPageId = '';
    dragOverPageId = '';

    if (!sourcePageId || sourcePageId === targetPageId) return;

    const fromIndex = pages.findIndex((page) => page.id === sourcePageId);
    const toIndex = pages.findIndex((page) => page.id === targetPageId);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextPages = [...pages];
    const [page] = nextPages.splice(fromIndex, 1);
    nextPages.splice(toIndex, 0, page);
    pages = nextPages;
    clearResult();
  }

  async function generatePdf() {
    if (outputMode === 'selected' && selectedPages.length === 0) {
      errorMessage = t.needSelected;
      return;
    }

    if (exportPages.length === 0) {
      errorMessage = t.needPages;
      return;
    }

    isGenerating = true;
    errorMessage = '';
    statusMessage = '';
    clearResult();

    try {
      const outputPdf = await PDFDocument.create();
      const loadedSources = new Map<string, PDFDocument>();
      const font = await outputPdf.embedFont(StandardFonts.HelveticaBold);

      for (const pageItem of exportPages) {
        const source = sources.find((item) => item.id === pageItem.sourceId);
        if (!source || source.error) continue;

        let sourcePdf = loadedSources.get(source.id);
        if (!sourcePdf) {
          sourcePdf = await PDFDocument.load(await source.file.arrayBuffer(), { ignoreEncryption: false });
          loadedSources.set(source.id, sourcePdf);
        }

        const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageItem.pageIndex]);

        if (pageItem.rotation) {
          copiedPage.setRotation(degrees(normalize(copiedPage.getRotation().angle + pageItem.rotation)));
        }

        outputPdf.addPage(copiedPage);

        if (shouldDrawText(pageItem)) {
          drawText(copiedPage, font, textValue.trim());
        }

        await yieldToBrowser();
      }

      resultBytes = new Uint8Array(await outputPdf.save({ useObjectStreams: true }));
      previewUrl = createPdfObjectUrl(resultBytes);
      isPreviewOpen = true;
      statusMessage = t.ready;
    } catch {
      errorMessage = t.createError;
    } finally {
      isGenerating = false;
    }
  }

  function shouldDrawText(page: PageItem) {
    if (!textValue.trim() || textMode === 'none') return false;
    if (textMode === 'all') return true;
    return page.selected;
  }

  function drawText(page: any, font: any, text: string) {
    const { width, height } = page.getSize();
    const size = Number(textSize) || 34;
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = Math.max(42, (width - textWidth) / 2);
    const y = height / 2;

    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: rgb(0.85, 0.12, 0.1),
      opacity: Number(textOpacity) || 0.22,
      rotate: degrees(-24),
    });
  }

  function thumbStyle(rotation: number) {
    const scale = rotation === 90 || rotation === 270 ? 0.74 : 1;
    return `transform: rotate(${rotation}deg) scale(${scale});`;
  }

  function clearTool() {
    renderToken += 1;
    pages.forEach((page) => {
      if (page.thumbUrl) URL.revokeObjectURL(page.thumbUrl);
    });
    sources = [];
    pages = [];
    errorMessage = '';
    statusMessage = '';
    clearResult();
  }

  function clearResult() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    resultBytes = null;
    isPreviewOpen = false;
  }

  function closePreview() {
    isPreviewOpen = false;
  }

  function normalize(value: number) {
    return ((value % 360) + 360) % 360;
  }

  function newId() {
    return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }

  onDestroy(() => clearTool());
</script>

<section class="multi-tool" aria-labelledby="multi-tool-title">
  <header class="multi-tool__hero">
    <div>
      <span class="multi-tool__eyebrow">FácilPDF Pro</span>
      <h2 id="multi-tool-title">{t.title}</h2>
      <p>{t.intro}</p>
    </div>

    <div class="multi-tool__stats" aria-live="polite">
      <strong>{visiblePages.length}</strong>
      <span>{t.finalPages}</span>
      <small>{sources.length} {t.files} · {totalSourcePages} total · {selectedPages.length} {t.selected}</small>
    </div>
  </header>

  <PdfDropzone
    multiple
    title={t.dropTitle}
    activeTitle={t.dropActive}
    subtitle={t.dropText}
    help={t.fileHelp}
    onFiles={addFiles}
    onInvalidFiles={handleInvalidFiles}
  />

  {#if errorMessage}
    <p class="multi-tool__message multi-tool__message--error" role="alert">{errorMessage}</p>
  {/if}

  {#if statusMessage}
    <p class="multi-tool__message multi-tool__message--success" role="status">{statusMessage}</p>
  {/if}

  {#if isRendering}
    <p class="multi-tool__message" role="status">{t.rendering}</p>
  {/if}

  {#if isGenerating}
    <ProcessingState title={t.generating} description={t.intro} />
  {/if}

  {#if sources.length === 0}
    <p class="multi-tool__empty">{t.noFiles}</p>
  {:else}
    <div class="multi-tool__workspace" bind:this={workspaceRegion}>
      <aside class="multi-tool__sidebar" aria-label="Opciones">
        <section class="side-card side-card--primary">
          <h3>{t.finalPages}</h3>
          <strong>{visiblePages.length}</strong>
          <p>{selectedPages.length} {t.selected}</p>
        </section>

        <section class="side-card">
          <h3>{t.files}</h3>
          <div class="file-chips">
            {#each sources as source}
              <button type="button" class:has-error={Boolean(source.error)} on:click={() => removeSource(source.id)} title={t.removePdf}>
                <span>📄</span>
                <strong>{source.file.name}</strong>
                <small>{source.pageCount}</small>
              </button>
            {/each}
          </div>
        </section>

        <section class="side-card">
          <h3>{lang === 'es' ? 'Descarga' : 'Download'}</h3>
          <div class="segmented-control">
            <label>
              <input type="radio" bind:group={outputMode} value="all" />
              <span>{t.outputAll}</span>
            </label>
            <label>
              <input type="radio" bind:group={outputMode} value="selected" />
              <span>{t.outputSelected}</span>
            </label>
          </div>
          <div class="selection-actions">
            <button type="button" on:click={() => selectAll(true)}>{t.selectAll}</button>
            <button type="button" on:click={() => selectAll(false)}>{t.deselectAll}</button>
          </div>
        </section>

        <details class="side-card">
          <summary>{t.addText}</summary>
          <label class="simple-field">
            <span>{t.addText}</span>
            <select bind:value={textMode}>
              <option value="none">No</option>
              <option value="all">{t.outputAll}</option>
              <option value="selected">{t.outputSelected}</option>
            </select>
          </label>
          {#if textMode !== 'none'}
            <input class="text-input" bind:value={textValue} placeholder={t.textPlaceholder} />
            <label class="range-field">
              <span>{lang === 'es' ? 'Tamaño' : 'Size'}: {textSize}</span>
              <input type="range" min="12" max="90" bind:value={textSize} />
            </label>
            <label class="range-field">
              <span>{lang === 'es' ? 'Opacidad' : 'Opacity'}: {Math.round(Number(textOpacity) * 100)}%</span>
              <input type="range" min="0.05" max="1" step="0.05" bind:value={textOpacity} />
            </label>
          {/if}
        </details>

        <div class="side-actions">
          <button class="primary-action" type="button" disabled={!canGenerate} on:click={generatePdf}>⚡ {isGenerating ? t.generating : t.generate}</button>
          <button class="secondary-action" type="button" disabled={!previewUrl || isGenerating} on:click={() => (isPreviewOpen = true)}>👁️ {t.preview}</button>
          <button class="ghost-action" type="button" on:click={clearTool}>🧹 {t.clear}</button>
        </div>

        {#if resultBytes}
          <ResultState
            title={t.readyTitle}
            description={t.ready}
            fileName={t.outputName}
            fileSize={formatFileSize(resultBytes.byteLength)}
            downloadUrl={previewUrl}
            downloadName={t.outputName}
            downloadLabel={t.download}
          />
        {/if}
      </aside>

      <section class="multi-tool__pages" aria-label={t.title}>
        {#each visiblePages as item (item.id)}
          <article
            class:multi-page={true}
            class:multi-page--selected={item.selected}
            class:multi-page--over={dragOverPageId === item.id}
            draggable="true"
            on:dragstart={(event) => onDragStart(event, item.id)}
            on:dragover={(event) => onDragOver(event, item.id)}
            on:drop={(event) => onDrop(event, item.id)}
            on:dragend={() => (dragOverPageId = '')}
          >
            <button class="multi-page__select" type="button" aria-label={t.toggleSelected} aria-pressed={item.selected} on:click={() => toggleSelected(item.id)}>
              {item.selected ? '✓' : '+'}
            </button>

            <button class="multi-page__trash" type="button" aria-label={t.deletePage} on:click={() => deletePage(item.id)}>
              🗑️
            </button>

            <div class="multi-page__thumb-frame" title={t.dragPage}>
              <div class="multi-page__thumb" style={thumbStyle(item.rotation)}>
                {#if item.thumbStatus === 'ready' && item.thumbUrl}
                  <img src={item.thumbUrl} alt={`${t.page} ${pageDisplayName(item)}`} loading="lazy" />
                {:else}
                  <span class:multi-page__placeholder={true} class:multi-page__placeholder--loading={item.thumbStatus === 'pending'}>{pageDisplayName(item)}</span>
                {/if}
              </div>
            </div>

            <div class="multi-page__meta">
              <strong>{t.page} {pageDisplayName(item)}</strong>
              <span>{item.rotation}°</span>
            </div>
            <small>{item.fileName}</small>

            <div class="multi-page__actions">
              <button type="button" on:click={() => rotatePage(item.id, -90)} aria-label={t.rotateLeft}>↶</button>
              <button type="button" on:click={() => rotatePage(item.id, 90)} aria-label={t.rotateRight}>↷</button>
              <span aria-hidden="true">↕</span>
            </div>
          </article>
        {/each}
      </section>
    </div>
  {/if}
</section>

<PdfResultModal
  open={isPreviewOpen && Boolean(previewUrl)}
  pdfUrl={previewUrl}
  filename={t.outputName}
  title={t.previewTitle}
  description={t.ready}
  downloadLabel={t.download}
  closeLabel={t.closePreview}
  on:close={closePreview}
/>

<style>
  .multi-tool{display:grid;gap:20px;margin:28px 0 56px;padding:clamp(16px,3vw,26px);border:1px solid var(--color-border,#e2e8f0);border-radius:28px;background:radial-gradient(circle at top left,color-mix(in srgb,var(--color-primary,#2563eb) 14%,transparent),transparent 28rem),var(--color-surface-raised,#fff);box-shadow:var(--shadow-sm,0 4px 12px rgb(15 23 42 / .08))}.multi-tool__hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.multi-tool__hero h2{margin:0 0 6px;font-size:clamp(1.7rem,3vw,2.45rem);letter-spacing:-.045em}.multi-tool__hero p,.multi-tool__empty{margin:0;color:var(--color-text-muted,#475569)}.multi-tool__eyebrow{display:inline-flex;margin-bottom:10px;padding:6px 10px;border-radius:999px;background:var(--color-primary-soft,#dbeafe);color:var(--color-primary,#2563eb);font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.multi-tool__stats{display:grid;min-width:170px;gap:2px;padding:14px 16px;border:1px solid var(--color-border,#e2e8f0);border-radius:22px;background:var(--color-surface,#fff);text-align:right}.multi-tool__stats strong{font-size:2rem;line-height:1}.multi-tool__stats span,.multi-tool__stats small{color:var(--color-text-muted,#475569);font-weight:800}.multi-tool__message,.multi-tool__empty{padding:13px 15px;border-radius:16px;background:var(--color-surface-soft,#f1f5f9);font-weight:850}.multi-tool__message{margin:0}.multi-tool__message--error{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#dc2626)}.multi-tool__message--success{background:var(--color-success-soft,#dcfce7);color:var(--color-success,#16a34a)}.multi-tool__workspace{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;align-items:start}.multi-tool__sidebar{position:sticky;top:18px;display:grid;gap:12px}.side-card{display:grid;gap:10px;padding:14px;border:1px solid var(--color-border,#e2e8f0);border-radius:20px;background:var(--color-surface,#fff);box-shadow:var(--shadow-xs,0 1px 2px rgb(15 23 42 / .06))}.side-card h3,.side-card p{margin:0}.side-card h3{font-size:.86rem;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted,#475569)}.side-card--primary{background:linear-gradient(135deg,var(--color-primary,#2563eb),var(--color-secondary,#7c3aed));color:#fff}.side-card--primary h3,.side-card--primary p{color:rgb(255 255 255 / .84)}.side-card--primary strong{font-size:2.1rem;line-height:1}.file-chips{display:grid;gap:7px}.file-chips button{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;width:100%;padding:8px;border:1px solid var(--color-border,#e2e8f0);border-radius:14px;background:var(--color-surface-soft,#f1f5f9);color:var(--color-text,#0f172a);cursor:pointer;text-align:left}.file-chips strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.85rem}.file-chips small{font-weight:900}.file-chips .has-error{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#dc2626)}.segmented-control{display:grid;grid-template-columns:1fr;gap:7px}.segmented-control label{display:flex;gap:8px;align-items:center;padding:9px;border:1px solid var(--color-border,#e2e8f0);border-radius:14px;cursor:pointer;font-weight:850}.selection-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.selection-actions button,.side-actions button{min-height:40px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-weight:900}.selection-actions button{background:var(--color-surface-soft,#f1f5f9);color:var(--color-text,#0f172a)}.side-card summary{cursor:pointer;font-weight:900;color:var(--color-text,#0f172a)}.simple-field,.range-field{display:grid;gap:6px;color:var(--color-text-muted,#475569);font-size:.88rem;font-weight:800}.simple-field select,.text-input{width:100%;min-height:40px;padding:8px 10px;border:1px solid var(--color-border,#e2e8f0);border-radius:12px;background:var(--color-surface,#fff);color:var(--color-text,#0f172a)}.side-actions{display:grid;gap:9px}.primary-action{background:linear-gradient(135deg,var(--color-primary,#2563eb),var(--color-secondary,#7c3aed));color:#fff;box-shadow:var(--shadow-sm,0 4px 12px rgb(15 23 42 / .08))}.secondary-action{background:var(--color-text,#0f172a);color:var(--color-surface,#fff)}.ghost-action{background:var(--color-surface-soft,#f1f5f9);color:var(--color-text,#0f172a)}.side-actions button:disabled{cursor:not-allowed;opacity:.5}.multi-tool__pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:14px}.multi-page{position:relative;display:grid;gap:9px;padding:10px;border:2px solid var(--color-border,#e2e8f0);border-radius:22px;background:var(--color-surface,#fff);box-shadow:var(--shadow-xs,0 1px 2px rgb(15 23 42 / .06));cursor:grab;transition:transform 160ms ease,border-color 160ms ease,box-shadow 160ms ease}.multi-page:hover{transform:translateY(-2px);box-shadow:var(--shadow-sm,0 4px 12px rgb(15 23 42 / .08))}.multi-page:active{cursor:grabbing}.multi-page--selected{border-color:var(--color-primary,#2563eb);box-shadow:0 0 0 4px color-mix(in srgb,var(--color-primary,#2563eb) 16%,transparent),var(--shadow-sm,0 4px 12px rgb(15 23 42 / .08))}.multi-page--over{border-color:var(--color-secondary,#7c3aed);transform:scale(.98)}.multi-page__select,.multi-page__trash{position:absolute;z-index:2;display:grid;width:34px;height:34px;place-items:center;border:0;border-radius:999px;cursor:pointer;font-weight:950;box-shadow:var(--shadow-sm,0 4px 12px rgb(15 23 42 / .14))}.multi-page__select{top:9px;left:9px;background:var(--color-primary,#2563eb);color:#fff}.multi-page__trash{top:9px;right:9px;background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#dc2626)}.multi-page__thumb-frame{display:grid;min-height:225px;place-items:center;overflow:hidden;border:1px solid var(--color-border,#e2e8f0);border-radius:16px;background:linear-gradient(135deg,var(--color-surface-soft,#f1f5f9),var(--color-surface,#fff))}.multi-page__thumb{display:grid;width:84%;place-items:center;transition:transform 180ms ease}.multi-page__thumb img{display:block;width:100%;height:auto;box-shadow:0 12px 26px rgb(15 23 42 / .16);pointer-events:none}.multi-page__placeholder{display:grid;width:100%;min-height:150px;place-items:center;border-radius:12px;background:var(--color-surface-soft,#f1f5f9);color:var(--color-text-soft,#64748b);font-size:1.35rem;font-weight:950}.multi-page__placeholder--loading{background:linear-gradient(100deg,#f1f5f9 20%,#fff 45%,#f1f5f9 70%);background-size:220% 100%;animation:thumb-loading 1.4s ease-in-out infinite}.multi-page__meta{display:flex;justify-content:space-between;gap:8px;align-items:center}.multi-page__meta span{padding:5px 9px;border-radius:999px;background:var(--color-surface-soft,#f1f5f9);color:var(--color-text-muted,#475569);font-weight:950;font-size:.82rem}.multi-page small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-muted,#475569);font-size:.78rem}.multi-page__actions{display:grid;grid-template-columns:1fr 1fr auto;gap:7px;align-items:center}.multi-page__actions button,.multi-page__actions span{display:grid;min-height:36px;place-items:center;border:0;border-radius:999px;background:var(--color-surface-soft,#f1f5f9);color:var(--color-text,#0f172a);font:inherit;font-weight:950}.multi-page__actions button{cursor:pointer}.multi-page__actions span{padding-inline:10px;color:var(--color-text-muted,#475569)}@keyframes thumb-loading{0%{background-position:120% 0}100%{background-position:-120% 0}}@media (max-width:980px){.multi-tool__hero,.multi-tool__workspace{display:grid;grid-template-columns:1fr}.multi-tool__sidebar{position:static}.multi-tool__stats{text-align:left}.multi-tool__pages{grid-template-columns:repeat(auto-fill,minmax(145px,1fr))}.multi-page__thumb-frame{min-height:180px}}@media (max-width:520px){.multi-tool{padding:14px;border-radius:22px}.multi-tool__pages{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.multi-page{padding:8px;border-radius:18px}.multi-page__thumb-frame{min-height:150px}.multi-page__select,.multi-page__trash{width:30px;height:30px}.selection-actions{grid-template-columns:1fr}}@media (prefers-reduced-motion:reduce){.multi-page,.multi-page__thumb{transition:none}.multi-page__placeholder--loading{animation:none}}
</style>