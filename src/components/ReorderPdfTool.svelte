<script lang="ts">
  import { onDestroy } from 'svelte';
  import { PDFDocument } from 'pdf-lib';
  import {
    GlobalWorkerOptions,
    getDocument,
    type PDFDocumentProxy,
    type PDFPageProxy,
  } from 'pdfjs-dist';
  import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

  type PageItem = {
    id: string;
    originalIndex: number;
    pageNumber: number;
    thumbnailUrl: string;
    thumbnailStatus: 'pending' | 'ready' | 'failed';
    selected: boolean;
  };

  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  let file: File | null = null;
  let sourceBytes: Uint8Array | null = null;
  let pdfDocument: PDFDocumentProxy | null = null;
  let pages: PageItem[] = [];
  let deletedPages: PageItem[] = [];
  let draggedPageId = '';
  let selectedPageId = '';
  let isLoading = false;
  let isExporting = false;
  let errorMessage = '';
  let successMessage = '';
  let renderToken = 0;
  let fileInput: HTMLInputElement;

  $: activePages = pages.filter((page) => !page.selected);
  $: selectedPages = pages.filter((page) => page.selected);
  $: canExport = Boolean(sourceBytes && activePages.length > 0 && !isLoading && !isExporting);

  async function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const nextFile = input.files?.[0] ?? null;
    await loadFile(nextFile);
  }

  async function loadFile(nextFile: File | null) {
    renderToken += 1;
    cleanupThumbnails();
    await destroyLoadedDocument();

    file = nextFile;
    sourceBytes = null;
    pages = [];
    deletedPages = [];
    selectedPageId = '';
    errorMessage = '';
    successMessage = '';

    if (!nextFile) return;

    if (nextFile.type && nextFile.type !== 'application/pdf') {
      errorMessage = 'Selecciona un archivo PDF válido.';
      return;
    }

    isLoading = true;

    try {
      const buffer = await nextFile.arrayBuffer();
      sourceBytes = new Uint8Array(buffer.slice(0));
      const pdfBytesForPreview = sourceBytes.slice();
      const loadingTask = getDocument({
        data: pdfBytesForPreview,
        useWorkerFetch: false,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
      });

      pdfDocument = await loadingTask.promise;
      pages = Array.from({ length: pdfDocument.numPages }, (_, index) => ({
        id: `page-${index + 1}`,
        originalIndex: index,
        pageNumber: index + 1,
        thumbnailUrl: '',
        thumbnailStatus: 'pending',
        selected: false,
      }));
      selectedPageId = pages[0]?.id ?? '';
      successMessage = `${pdfDocument.numPages} páginas cargadas. Arrastra las tarjetas para ordenarlas.`;
      void renderThumbnails();
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
    event.dataTransfer?.setData('text/plain', pageId);
    event.dataTransfer?.setDragImage?.(event.currentTarget as Element, 24, 24);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDrop(event: DragEvent, targetPageId: string) {
    event.preventDefault();
    const sourcePageId = event.dataTransfer?.getData('text/plain') || draggedPageId;
    draggedPageId = '';
    movePageBefore(sourcePageId, targetPageId);
  }

  function movePageBefore(sourcePageId: string, targetPageId: string) {
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
    successMessage = 'Orden actualizado. Descarga el PDF cuando esté listo.';
  }

  function selectPage(pageId: string) {
    selectedPageId = pageId;
  }

  function moveSelected(offset: number) {
    if (!selectedPageId) return;
    const currentIndex = pages.findIndex((page) => page.id === selectedPageId);
    const nextIndex = currentIndex + offset;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= pages.length) return;

    const nextPages = [...pages];
    const [page] = nextPages.splice(currentIndex, 1);
    nextPages.splice(nextIndex, 0, page);
    pages = nextPages;
    successMessage = 'Orden actualizado.';
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
    successMessage = 'Orden actualizado.';
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
    successMessage = `Página ${pageToRemove.pageNumber} eliminada de la exportación.`;
    errorMessage = '';
  }

  function restoreDeletedPage(pageId: string) {
    const pageToRestore = deletedPages.find((page) => page.id === pageId);
    if (!pageToRestore) return;

    deletedPages = deletedPages.filter((page) => page.id !== pageId);
    pages = [...pages, pageToRestore].sort((a, b) => a.originalIndex - b.originalIndex);
    selectedPageId = pageToRestore.id;
    successMessage = 'Página restaurada en su posición original.';
  }

  function restoreOriginalOrder() {
    pages = [...pages, ...deletedPages]
      .map((page) => ({ ...page, selected: false }))
      .sort((a, b) => a.originalIndex - b.originalIndex);
    deletedPages = [];
    selectedPageId = pages[0]?.id ?? '';
    errorMessage = '';
    successMessage = 'Orden original restaurado.';
  }

  async function exportPdf() {
    if (!sourceBytes || activePages.length === 0) return;

    isExporting = true;
    errorMessage = '';
    successMessage = '';

    try {
      const sourceDocument = await PDFDocument.load(sourceBytes.slice(), { ignoreEncryption: false });
      const outputDocument = await PDFDocument.create();
      const copiedPages = await outputDocument.copyPages(
        sourceDocument,
        activePages.map((page) => page.originalIndex),
      );

      copiedPages.forEach((page) => outputDocument.addPage(page));
      outputDocument.setTitle(file ? `Ordenado - ${file.name}` : 'PDF ordenado');
      outputDocument.setProducer('PDFWorld');
      outputDocument.setCreator('PDFWorld');

      const pdfBytes = await outputDocument.save();
      downloadBytes(pdfBytes, getOutputFilename());
      successMessage = 'PDF ordenado generado correctamente.';
    } catch (error) {
      errorMessage = getFriendlyError(error, 'No se pudo generar el PDF ordenado.');
    } finally {
      isExporting = false;
    }
  }

  function getOutputFilename() {
    const fallback = 'pdfworld-ordenado.pdf';
    if (!file?.name) return fallback;
    const baseName = file.name.replace(/\.pdf$/i, '').trim();
    return `${baseName || 'documento'}-ordenado.pdf`;
  }

  function downloadBytes(bytes: Uint8Array, filename: string) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleLoadError(error: unknown) {
    errorMessage = getFriendlyError(error, 'No se pudo cargar el PDF. Revisa el archivo e inténtalo de nuevo.');
    successMessage = '';
    pages = [];
    deletedPages = [];
    sourceBytes = null;
  }

  function getFriendlyError(error: unknown, fallback: string) {
    if (error instanceof Error) {
      if (/password|encrypted/i.test(`${error.name} ${error.message}`)) {
        return 'El PDF está protegido con contraseña o no permite esta operación en navegador.';
      }

      if (/invalid|corrupt|damaged/i.test(error.message)) {
        return 'El PDF parece estar dañado o no tiene un formato válido.';
      }

      return error.message || fallback;
    }

    return fallback;
  }

  function resetTool() {
    if (fileInput) fileInput.value = '';
    void loadFile(null);
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

  function yieldToBrowser() {
    return new Promise<void>((resolve) => {
      window.requestIdleCallback?.(() => resolve(), { timeout: 120 }) ?? window.setTimeout(resolve, 0);
    });
  }

  onDestroy(() => {
    renderToken += 1;
    cleanupThumbnails();
    void destroyLoadedDocument();
  });
</script>

<section class="reorder-tool" aria-labelledby="reorder-tool-title">
  <div class="upload-panel">
    <div>
      <h2 id="reorder-tool-title">Ordena las páginas visualmente</h2>
      <p>Elige un PDF, arrastra sus páginas y descarga una copia con el nuevo orden. El archivo no se sube a ningún servidor.</p>
    </div>

    <label class="file-drop">
      <input bind:this={fileInput} type="file" accept="application/pdf" on:change={handleFileChange} />
      <span>{file ? file.name : 'Seleccionar PDF'}</span>
      <small>{file ? 'Puedes cambiar de archivo cuando quieras' : 'PDF local · sin subida · navegador'}</small>
    </label>
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
    <div class="actions-bar">
      <div class="actions-bar__summary">
        <strong>{pages.length}</strong> páginas activas
        {#if deletedPages.length > 0}
          · <strong>{deletedPages.length}</strong> eliminadas
        {/if}
      </div>

      <div class="actions-bar__buttons">
        <button type="button" on:click={() => moveSelected(-1)} disabled={!selectedPageId}>Mover arriba</button>
        <button type="button" on:click={() => moveSelected(1)} disabled={!selectedPageId}>Mover abajo</button>
        <button type="button" on:click={restoreOriginalOrder}>Restaurar orden original</button>
        <button type="button" class="primary" on:click={exportPdf} disabled={!canExport}>
          {isExporting ? 'Generando…' : 'Descargar PDF ordenado'}
        </button>
      </div>
    </div>

    <div class="page-grid" aria-label="Páginas del PDF ordenables">
      {#each pages as page, index (page.id)}
        <article
          class:page-card={true}
          class:page-card--active={page.id === selectedPageId}
          draggable="true"
          on:dragstart={(event) => handleDragStart(event, page.id)}
          on:dragover={handleDragOver}
          on:drop={(event) => handleDrop(event, page.id)}
          on:click={() => selectPage(page.id)}
          aria-label={`Página original ${page.pageNumber}, posición ${index + 1}`}
        >
          <div class="page-card__preview">
            {#if page.thumbnailStatus === 'ready' && page.thumbnailUrl}
              <img src={page.thumbnailUrl} alt={`Miniatura de la página ${page.pageNumber}`} loading="lazy" />
            {:else if page.thumbnailStatus === 'pending'}
              <span>Miniatura…</span>
            {:else}
              <span>Página {page.pageNumber}</span>
            {/if}
          </div>

          <div class="page-card__body">
            <strong>#{index + 1}</strong>
            <span>Original: página {page.pageNumber}</span>
          </div>

          <div class="page-card__controls" aria-label={`Acciones de página ${page.pageNumber}`}>
            <button type="button" on:click|stopPropagation={() => movePage(page.id, -1)} disabled={index === 0} aria-label="Mover antes">↑</button>
            <button type="button" on:click|stopPropagation={() => movePage(page.id, 1)} disabled={index === pages.length - 1} aria-label="Mover después">↓</button>
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
  .loading-card,
  .alert {
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
  }

  .upload-panel {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.7fr);
    gap: 20px;
    align-items: center;
    padding: 24px;
  }

  .upload-panel h2 {
    margin: 0 0 8px;
  }

  .upload-panel p {
    margin: 0;
    color: #64748b;
  }

  .file-drop {
    display: grid;
    gap: 6px;
    padding: 20px;
    border: 2px dashed #f87171;
    border-radius: 20px;
    background: #fff1f2;
    color: #991b1b;
    cursor: pointer;
    font-weight: 900;
    text-align: center;
  }

  .file-drop input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .file-drop small {
    color: #64748b;
    font-weight: 700;
  }

  .alert,
  .loading-card {
    padding: 16px 18px;
    font-weight: 800;
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
  }

  .actions-bar__summary {
    color: #475569;
    font-weight: 800;
  }

  .actions-bar__buttons {
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
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .actions-bar button,
  .reset-button,
  .deleted-list button {
    padding: 10px 14px;
  }

  button.primary {
    background: #0f172a;
    color: #fff;
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
    transition: border-color 0.18s ease, transform 0.18s ease;
  }

  .page-card:active {
    cursor: grabbing;
  }

  .page-card--active {
    border-color: #ef4444;
    transform: translateY(-2px);
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

  .deleted-panel {
    padding: 20px;
  }

  .deleted-panel h3 {
    margin: 0 0 12px;
  }

  .deleted-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .reset-button {
    justify-self: start;
    background: transparent;
    color: #b91c1c;
  }

  @media (max-width: 760px) {
    .upload-panel,
    .actions-bar {
      grid-template-columns: 1fr;
    }

    .actions-bar {
      position: static;
    }

    .actions-bar__buttons {
      justify-content: stretch;
    }

    .actions-bar__buttons button {
      flex: 1 1 150px;
    }

    .page-grid {
      grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
      gap: 12px;
    }

    .page-card__preview {
      min-height: 170px;
    }
  }
</style>
