<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { PDFDocument, degrees } from 'pdf-lib';
  import {
    GlobalWorkerOptions,
    getDocument,
    type PDFDocumentProxy,
    type PDFPageProxy,
  } from 'pdfjs-dist';
  import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, getFriendlyPdfError, yieldToBrowser } from '../lib/pdfToolUtils';

  type PageItem = {
    id: string;
    originalIndex: number;
    pageNumber: number;
    rotation: number;
    thumbnailUrl: string;
    thumbnailStatus: 'pending' | 'ready' | 'failed';
  };

  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  let file: File | null = null;
  let sourceBytes: Uint8Array | null = null;
  let pdfDocument: PDFDocumentProxy | null = null;
  let pages: PageItem[] = [];
  let deletedPages: PageItem[] = [];
  let draggedPageId = '';
  let dropTargetPageId = '';
  let selectedPageId = '';
  let pointerDragPageId = '';
  let pointerStartX = 0;
  let pointerStartY = 0;
  let hasPointerMoved = false;
  let isLoading = false;
  let isPreviewing = false;
  let errorMessage = '';
  let successMessage = '';
  let previewUrl = '';
  let renderToken = 0;
  let workspaceRegion: HTMLDivElement;

  $: canExport = Boolean(sourceBytes && pages.length > 0 && !isLoading && !isPreviewing);
  $: hasChanges = pages.some((page, index) => page.originalIndex !== index) || deletedPages.length > 0;

  async function handleDropzoneFiles(files: File[]) {
    await loadFile(files[0] ?? null);
  }

  function handleInvalidFiles() {
    errorMessage = 'Selecciona un archivo PDF válido.';
    successMessage = '';
  }

  async function loadFile(nextFile: File | null) {
    renderToken += 1;
    cleanupPreview();
    cleanupThumbnails();
    await destroyLoadedDocument();

    file = nextFile;
    sourceBytes = null;
    pages = [];
    deletedPages = [];
    selectedPageId = '';
    draggedPageId = '';
    dropTargetPageId = '';
    pointerDragPageId = '';
    errorMessage = '';
    successMessage = '';

    if (!nextFile) return;

    isLoading = true;

    try {
      const buffer = await nextFile.arrayBuffer();
      sourceBytes = new Uint8Array(buffer.slice(0));
      const loadingTask = getDocument({
        data: sourceBytes.slice(),
        useWorkerFetch: false,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
      });

      pdfDocument = await loadingTask.promise;
      pages = Array.from({ length: pdfDocument.numPages }, (_, index) => ({
        id: `page-${crypto.randomUUID?.() ?? `${Date.now()}-${index}`}`,
        originalIndex: index,
        pageNumber: index + 1,
        rotation: 0,
        thumbnailUrl: '',
        thumbnailStatus: 'pending',
      }));
      selectedPageId = pages[0]?.id ?? '';
      successMessage = `${pdfDocument.numPages} páginas cargadas. Arrastra las tarjetas para ordenar.`;
      void renderThumbnails();
      await scrollToWorkspace();
    } catch (error) {
      handleLoadError(error);
    } finally {
      isLoading = false;
    }
  }

  async function renderThumbnails() {
    if (!pdfDocument) return;

    const token = ++renderToken;

    for (const pageItem of pages) {
      if (token !== renderToken || !pdfDocument) return;
      await yieldToBrowser();

      try {
        const pdfPage = await pdfDocument.getPage(pageItem.pageNumber);
        const thumbnailUrl = await renderPageThumbnail(pdfPage);
        pdfPage.cleanup();

        if (token !== renderToken) {
          URL.revokeObjectURL(thumbnailUrl);
          return;
        }

        pages = pages.map((page) =>
          page.id === pageItem.id
            ? { ...page, thumbnailUrl, thumbnailStatus: 'ready' }
            : page,
        );
      } catch {
        pages = pages.map((page) =>
          page.id === pageItem.id ? { ...page, thumbnailStatus: 'failed' } : page,
        );
      }
    }
  }

  async function renderPageThumbnail(pdfPage: PDFPageProxy) {
    const viewport = pdfPage.getViewport({ scale: 0.22 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) throw new Error('No se pudo crear la miniatura.');

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    const renderTask = pdfPage.render({ canvasContext: context, viewport });
    await renderTask.promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.76));
    if (!blob) throw new Error('No se pudo exportar la miniatura.');

    return URL.createObjectURL(blob);
  }

  function handleDragStart(event: DragEvent, pageId: string) {
    draggedPageId = pageId;
    selectedPageId = pageId;
    dropTargetPageId = '';
    event.dataTransfer?.setData('text/plain', pageId);
    event.dataTransfer?.setDragImage?.(event.currentTarget as Element, 24, 24);
  }

  function handleDragOver(event: DragEvent, targetPageId: string) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dropTargetPageId = targetPageId;
  }

  function handleDrop(event: DragEvent, targetPageId: string) {
    event.preventDefault();
    const sourcePageId = event.dataTransfer?.getData('text/plain') || draggedPageId;
    draggedPageId = '';
    dropTargetPageId = '';
    movePageBefore(sourcePageId, targetPageId);
  }

  function handleDragEnd() {
    draggedPageId = '';
    dropTargetPageId = '';
  }

  function handlePointerDown(event: PointerEvent, pageId: string) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    pointerDragPageId = pageId;
    selectedPageId = pageId;
    dropTargetPageId = '';
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    hasPointerMoved = false;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!pointerDragPageId) return;

    const distance = Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY);
    if (distance < 10 && !hasPointerMoved) return;

    hasPointerMoved = true;
    event.preventDefault();

    const targetPageId = getPageIdFromPoint(event.clientX, event.clientY);
    if (!targetPageId || targetPageId === pointerDragPageId) return;

    dropTargetPageId = targetPageId;
    movePageBefore(pointerDragPageId, targetPageId, false);
  }

  function handlePointerUp(event: PointerEvent) {
    if (!pointerDragPageId) return;

    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    const moved = hasPointerMoved;
    pointerDragPageId = '';
    dropTargetPageId = '';
    hasPointerMoved = false;

    if (moved) successMessage = 'Orden actualizado. Puedes previsualizar o descargar el PDF.';
  }

  function getPageIdFromPoint(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY);
    const pageCard = element?.closest<HTMLElement>('[data-page-id]');
    return pageCard?.dataset.pageId ?? '';
  }

  function movePageBefore(sourcePageId: string, targetPageId: string, showMessage = true) {
    if (!sourcePageId || !targetPageId || sourcePageId === targetPageId) return;

    const sourceIndex = pages.findIndex((page) => page.id === sourcePageId);
    const targetIndex = pages.findIndex((page) => page.id === targetPageId);

    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextPages = [...pages];
    const [sourcePage] = nextPages.splice(sourceIndex, 1);
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    nextPages.splice(adjustedTargetIndex, 0, sourcePage);
    pages = nextPages;
    selectedPageId = sourcePage.id;
    cleanupPreview();

    if (showMessage) successMessage = 'Orden actualizado. Puedes previsualizar o descargar el PDF.';
  }

  function selectPage(pageId: string) {
    selectedPageId = pageId;
  }

  function moveSelected(offset: number) {
    if (!selectedPageId) return;
    movePage(selectedPageId, offset);
  }

  function movePage(pageId: string, offset: number) {
    selectedPageId = pageId;
    const currentIndex = pages.findIndex((page) => page.id === pageId);
    const nextIndex = currentIndex + offset;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= pages.length) return;

    const nextPages = [...pages];
    const [page] = nextPages.splice(currentIndex, 1);
    nextPages.splice(nextIndex, 0, page);
    pages = nextPages;
    cleanupPreview();
    successMessage = 'Orden actualizado. Puedes previsualizar o descargar el PDF.';
  }

  function removePage(pageId: string) {
    if (pages.length <= 1) {
      errorMessage = 'El PDF debe conservar al menos una página.';
      return;
    }

    const pageToRemove = pages.find((page) => page.id === pageId);
    if (!pageToRemove) return;

    pages = pages.filter((page) => page.id !== pageId);
    deletedPages = [...deletedPages, pageToRemove];
    selectedPageId = pages[0]?.id ?? '';
    cleanupPreview();
    successMessage = `Página ${pageToRemove.pageNumber} eliminada de la exportación.`;
    errorMessage = '';
  }

  function rotatePage(pageId: string, delta: 90 | -90) {
    pages = pages.map((page) =>
      page.id === pageId ? { ...page, rotation: normalizeRotation(page.rotation + delta) } : page,
    );
    cleanupPreview();
    successMessage = 'Giro actualizado. Genera la vista previa para revisar el PDF.';
    errorMessage = '';
  }

  function restoreDeletedPage(pageId: string) {
    const pageToRestore = deletedPages.find((page) => page.id === pageId);
    if (!pageToRestore) return;

    deletedPages = deletedPages.filter((page) => page.id !== pageId);
    pages = [...pages, pageToRestore].sort((a, b) => a.originalIndex - b.originalIndex);
    selectedPageId = pageToRestore.id;
    cleanupPreview();
    successMessage = 'Página restaurada en su posición original.';
  }

  function restoreOriginalOrder() {
    pages = [...pages, ...deletedPages].sort((a, b) => a.originalIndex - b.originalIndex);
    deletedPages = [];
    selectedPageId = pages[0]?.id ?? '';
    errorMessage = '';
    cleanupPreview();
    successMessage = 'Orden original restaurado.';
  }

  async function previewPdf() {
    if (!canExport) return;

    isPreviewing = true;
    errorMessage = '';
    successMessage = '';

    try {
      const pdfBytes = await createOrderedPdfBytes();
      cleanupPreview();
      previewUrl = createPdfObjectUrl(pdfBytes);
      successMessage = 'Vista previa generada. Revísala antes de descargar.';
    } catch (error) {
      errorMessage = getFriendlyPdfError(error, 'No se pudo generar la vista previa del PDF.');
    } finally {
      isPreviewing = false;
    }
  }

  async function createOrderedPdfBytes() {
    if (!sourceBytes || pages.length === 0) {
      throw new Error('No hay páginas para exportar.');
    }

    const sourceDocument = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
    const outputDocument = await PDFDocument.create();
    const copiedPages = await outputDocument.copyPages(
      sourceDocument,
      pages.map((page) => page.originalIndex),
    );

    copiedPages.forEach((page) => outputDocument.addPage(page));
    pages.forEach((pageItem, index) => {
      if (!pageItem.rotation) return;
      const outputPage = outputDocument.getPage(index);
      outputPage.setRotation(degrees(normalizeRotation(outputPage.getRotation().angle + pageItem.rotation)));
    });
    outputDocument.setTitle(file ? `Ordenado - ${file.name}` : 'PDF ordenado');
    outputDocument.setProducer('FácilPDF');
    outputDocument.setCreator('FácilPDF');

    return outputDocument.save();
  }

  function resetTool() {
    void loadFile(null);
  }

  function getOutputFilename() {
    const fallback = 'pdf-ordenado.pdf';
    if (!file?.name) return fallback;
    const baseName = file.name.replace(/\.pdf$/i, '').trim();
    return `${baseName || 'documento'}-ordenado.pdf`;
  }

  function thumbStyle(rotation: number) {
    const normalized = normalizeRotation(rotation);
    const scale = normalized === 90 || normalized === 270 ? 0.72 : 1;
    return `transform: rotate(${normalized}deg) scale(${scale});`;
  }

  function normalizeRotation(value: number) {
    return ((value % 360) + 360) % 360;
  }

  function handleLoadError(error: unknown) {
    errorMessage = getFriendlyPdfError(error, 'No se pudo cargar el PDF. Revisa el archivo e inténtalo de nuevo.');
    successMessage = '';
    pages = [];
    deletedPages = [];
    sourceBytes = null;
    cleanupPreview();
  }

  function cleanupPreview() {
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  }

  function cleanupThumbnails() {
    pages.forEach((page) => {
      if (page.thumbnailUrl) URL.revokeObjectURL(page.thumbnailUrl);
    });
    deletedPages.forEach((page) => {
      if (page.thumbnailUrl) URL.revokeObjectURL(page.thumbnailUrl);
    });
  }

  async function destroyLoadedDocument() {
    if (!pdfDocument) return;

    try {
      await pdfDocument.destroy();
    } catch {
      // pdf.js can throw if a document is already being destroyed.
    } finally {
      pdfDocument = null;
    }
  }

  async function scrollToWorkspace() {
    await tick();
    workspaceRegion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onDestroy(() => {
    renderToken += 1;
    cleanupPreview();
    cleanupThumbnails();
    void destroyLoadedDocument();
  });
</script>

<section class="reorder-tool" aria-labelledby="reorder-tool-title">
  <div class="upload-panel">
    <div>
      <span class="eyebrow">Drag & drop local</span>
      <h2 id="reorder-tool-title">Ordena las páginas visualmente</h2>
      <p>Arrastra un PDF aquí, reordena sus páginas y descarga una copia nueva. El archivo no se sube a ningún servidor.</p>
    </div>

    <PdfDropzone
      title="Arrastra tu PDF aquí"
      activeTitle="Suelta el PDF para cargarlo"
      subtitle="Suelta el archivo o pulsa para seleccionarlo"
      help="Un solo PDF · privado · sin subida · navegador"
      selectedLabel={file?.name ?? ''}
      onFiles={handleDropzoneFiles}
      onInvalidFiles={handleInvalidFiles}
    />
  </div>

  {#if errorMessage}
    <div class="alert alert--error" role="alert">{errorMessage}</div>
  {/if}

  {#if successMessage}
    <div class="alert alert--success" role="status">{successMessage}</div>
  {/if}

  {#if isLoading}
    <div class="loading-card">Cargando páginas y preparando miniaturas…</div>
  {/if}

  {#if pages.length > 0}
    <div class="actions-bar" bind:this={workspaceRegion}>
      <div class="actions-bar__summary">
        <strong>{pages.length}</strong> páginas activas
        {#if deletedPages.length > 0}
          · <strong>{deletedPages.length}</strong> eliminadas
        {/if}
        {#if hasChanges}
          <span class="changes-pill">Cambios sin descargar</span>
        {/if}
      </div>

      <div class="actions-bar__buttons">
        <button type="button" on:click={() => moveSelected(-1)} disabled={!selectedPageId}>Mover arriba</button>
        <button type="button" on:click={() => moveSelected(1)} disabled={!selectedPageId}>Mover abajo</button>
        <button type="button" on:click={restoreOriginalOrder}>Restaurar orden</button>
        <button type="button" class="secondary" on:click={previewPdf} disabled={!canExport}>
          {isPreviewing ? 'Generando vista…' : 'Ver PDF'}
        </button>
        <button type="button" class="primary" on:click={previewPdf} disabled={!canExport}>
          {isPreviewing ? 'Generando vista…' : 'Previsualizar y descargar'}
        </button>
      </div>
    </div>

    <div class="help-card">
      <strong>Cómo ordenar:</strong> arrastra una tarjeta sobre otra para colocarla antes. En móvil, usa el asa “Arrastrar”; también puedes usar ↑ y ↓.
    </div>

    <div class="page-grid" aria-label="Páginas del PDF ordenables">
      {#each pages as page, index (page.id)}
        <article
          class:page-card={true}
          class:page-card--active={page.id === selectedPageId}
          class:page-card--dragging={page.id === draggedPageId || page.id === pointerDragPageId}
          class:page-card--drop-target={page.id === dropTargetPageId}
          data-page-id={page.id}
          draggable="true"
          on:dragstart={(event) => handleDragStart(event, page.id)}
          on:dragover={(event) => handleDragOver(event, page.id)}
          on:dragleave={() => (dropTargetPageId = '')}
          on:drop={(event) => handleDrop(event, page.id)}
          on:dragend={handleDragEnd}
          on:click={() => selectPage(page.id)}
          aria-label={`Página original ${page.pageNumber}, posición ${index + 1}`}
        >
          <button
            type="button"
            class="drag-handle"
            on:pointerdown={(event) => handlePointerDown(event, page.id)}
            on:pointermove={handlePointerMove}
            on:pointerup={handlePointerUp}
            on:pointercancel={handlePointerUp}
            aria-label={`Arrastrar página ${page.pageNumber}`}
          >
            <span aria-hidden="true">⠿</span>
            Arrastrar
          </button>

          <div class="page-card__preview">
            {#if page.thumbnailStatus === 'ready' && page.thumbnailUrl}
              <img src={page.thumbnailUrl} alt={`Miniatura de la página ${page.pageNumber}`} style={thumbStyle(page.rotation)} loading="lazy" />
            {:else if page.thumbnailStatus === 'pending'}
              <span>Miniatura…</span>
            {:else}
              <span>Página {page.pageNumber}</span>
            {/if}
          </div>

          <div class="page-card__body">
            <strong>Posición {index + 1}</strong>
            <span>Original: página {page.pageNumber}</span>
          </div>

          <div class="page-card__controls" aria-label={`Acciones de página ${page.pageNumber}`}>
            <button type="button" on:click|stopPropagation={() => movePage(page.id, -1)} disabled={index === 0} aria-label="Mover antes">↑</button>
            <button type="button" on:click|stopPropagation={() => movePage(page.id, 1)} disabled={index === pages.length - 1} aria-label="Mover después">↓</button>
            <button type="button" on:click|stopPropagation={() => rotatePage(page.id, -90)} aria-label="Girar izquierda">↶</button>
            <button type="button" on:click|stopPropagation={() => rotatePage(page.id, 90)} aria-label="Girar derecha">↷</button>
            <button type="button" class="danger" on:click|stopPropagation={() => removePage(page.id)} aria-label="Eliminar página">Eliminar</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  {#if deletedPages.length > 0}
    <section class="deleted-panel" aria-labelledby="deleted-pages-title">
      <h3 id="deleted-pages-title">Páginas eliminadas de la exportación</h3>
      <div class="deleted-list">
        {#each deletedPages as page (page.id)}
          <button type="button" on:click={() => restoreDeletedPage(page.id)}>
            Restaurar página {page.pageNumber}
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if file}
    <button type="button" class="reset-button" on:click={resetTool}>Empezar con otro PDF</button>
  {/if}

  <PdfResultModal
    open={Boolean(previewUrl)}
    pdfUrl={previewUrl}
    filename={getOutputFilename()}
    title="Vista previa del PDF ordenado"
    description="Comprueba el resultado y descárgalo desde este modal. Si cambias el orden, genera una nueva vista."
    downloadLabel="Descargar PDF"
    openLabel="Abrir en pestaña"
    closeLabel="Cerrar"
    on:close={cleanupPreview}
  />
</section>

<style>
  .reorder-tool {
    display: grid;
    gap: 20px;
    margin: 32px 0 64px;
  }

  .upload-panel,
  .actions-bar,
  .deleted-panel,
  .preview-panel,
  .loading-card,
  .help-card,
  .alert {
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  }

  .upload-panel {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.95fr);
    gap: 20px;
    align-items: center;
    overflow: hidden;
    padding: 24px;
    border-radius: 32px;
    background:
      radial-gradient(circle at top right, rgba(239, 68, 68, 0.14), transparent 36%),
      linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.88));
    box-shadow: 0 30px 90px rgba(15, 23, 42, 0.11);
  }

  .upload-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(120deg, transparent 20%, rgba(255, 255, 255, 0.62), transparent 80%);
    transform: translateX(-110%);
    animation: reorder-upload-sheen 7s ease-in-out infinite;
  }

  .upload-panel > * {
    position: relative;
    z-index: 1;
  }

  .eyebrow {
    display: inline-flex;
    margin-bottom: 10px;
    padding: 6px 10px;
    border-radius: 999px;
    background: #fee2e2;
    color: #991b1b;
    font-size: 0.8rem;
    font-weight: 900;
  }

  .upload-panel h2 {
    margin: 0 0 8px;
    letter-spacing: -0.04em;
  }

  .upload-panel p {
    margin: 0;
    color: #64748b;
  }

  .alert,
  .loading-card,
  .help-card {
    padding: 16px 18px;
    font-weight: 800;
  }

  .help-card {
    color: #475569;
  }

  .alert--error {
    border-color: #fecaca;
    background: #fff1f2;
    color: #991b1b;
  }

  .alert--success {
    border-color: #bbf7d0;
    background: #f0fdf4;
    color: #166534;
  }

  .loading-card {
    color: #475569;
  }

  .actions-bar {
    position: sticky;
    top: 12px;
    z-index: 2;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 16px;
    align-items: center;
    padding: 14px;
    backdrop-filter: blur(16px);
  }

  .actions-bar__summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    color: #475569;
    font-weight: 800;
  }

  .changes-pill {
    display: inline-flex;
    padding: 5px 8px;
    border-radius: 999px;
    background: #fef3c7;
    color: #92400e;
    font-size: 0.78rem;
  }

  .actions-bar__buttons,
  .preview-panel__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
  }

  button {
    border: 0;
    border-radius: 999px;
    background: #e2e8f0;
    color: #0f172a;
    cursor: pointer;
    font: inherit;
    font-weight: 900;
    transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .actions-bar button,
  .preview-panel button,
  .reset-button,
  .deleted-list button {
    padding: 10px 14px;
  }

  button.primary {
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    color: #fff;
    box-shadow: 0 16px 34px rgba(239, 68, 68, 0.24);
  }

  button.secondary {
    background: #fee2e2;
    color: #991b1b;
  }

  button.danger {
    background: #fee2e2;
    color: #991b1b;
  }

  .page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    gap: 16px;
  }

  .page-card {
    display: grid;
    gap: 12px;
    padding: 12px;
    border: 2px solid transparent;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
    cursor: grab;
    animation: reorder-page-in 260ms ease both;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
  }

  .page-card:active {
    cursor: grabbing;
  }

  .page-card--active {
    border-color: #ef4444;
    transform: translateY(-2px);
  }

  .page-card--dragging {
    opacity: 0.58;
    transform: scale(0.98);
  }

  .page-card--drop-target {
    border-color: #0f172a;
    box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.08), 0 18px 50px rgba(15, 23, 42, 0.12);
  }

  .drag-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 38px;
    padding: 8px 10px;
    border-radius: 14px;
    background: #0f172a;
    color: #fff;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .page-card__preview {
    display: grid;
    min-height: 210px;
    place-items: center;
    overflow: hidden;
    border-radius: 16px;
    background: #e5e7eb;
    color: #64748b;
    font-weight: 900;
  }

  .page-card__preview img {
    display: block;
    width: 100%;
    height: auto;
    pointer-events: none;
  }

  .page-card__body {
    display: grid;
    gap: 2px;
  }

  .page-card__body span {
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 700;
  }

  .page-card__controls {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .page-card__controls button {
    min-height: 40px;
    padding: 8px;
  }

  .page-card__controls .danger {
    grid-column: 1 / -1;
  }

  .preview-panel,
  .deleted-panel {
    padding: 20px;
  }

  .preview-panel {
    display: grid;
    gap: 16px;
  }

  .preview-panel__header {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: start;
  }

  .preview-panel h3,
  .deleted-panel h3 {
    margin: 0 0 8px;
  }

  .preview-panel p {
    margin: 0;
    color: #64748b;
  }

  .preview-panel iframe {
    width: 100%;
    min-height: min(78vh, 820px);
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    background: #f8fafc;
  }

  .deleted-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .reset-button {
    justify-self: start;
  }

  @keyframes reorder-upload-sheen {
    0%, 55% { transform: translateX(-110%); }
    100% { transform: translateX(110%); }
  }

  @keyframes reorder-page-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .upload-panel::before,
    .page-card {
      animation: none;
    }

    button,
    .page-card {
      transition: none;
    }
  }

  @media (max-width: 820px) {
    .upload-panel,
    .actions-bar,
    .preview-panel__header {
      grid-template-columns: 1fr;
    }

    .actions-bar__buttons,
    .preview-panel__actions {
      justify-content: flex-start;
    }
  }
</style>
