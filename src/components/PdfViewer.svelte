<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import {
    GlobalWorkerOptions,
    getDocument,
    type PDFDocumentProxy,
    type PDFPageProxy,
    type RenderTask,
  } from 'pdfjs-dist';
  import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

  type PdfSource = File | Blob | ArrayBuffer | Uint8Array | null;

  export interface PageSelectionDetail {
    pageNumber: number;
    pageCount: number;
  }

  export interface PdfLoadDetail {
    pageCount: number;
  }

  export interface PdfErrorDetail {
    message: string;
    error: unknown;
  }

  export let source: PdfSource = null;
  export let initialPage = 1;
  export let showThumbnails = true;
  export let scale = 1.35;
  export let thumbnailScale = 0.18;
  export let maxCanvasWidth = 980;
  export let ariaLabel = 'PDF preview';

  const dispatch = createEventDispatcher<{
    load: PdfLoadDetail;
    error: PdfErrorDetail;
    pageSelect: PageSelectionDetail;
  }>();

  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  let pdfDocument: PDFDocumentProxy | null = null;
  let currentPage = 1;
  let pageCount = 0;
  let isLoading = false;
  let isRendering = false;
  let errorMessage = '';
  let canvasElement: HTMLCanvasElement;
  let renderTask: RenderTask | null = null;
  let loadToken = 0;
  let renderToken = 0;
  let thumbnailToken = 0;
  let thumbnailItems: Array<{ pageNumber: number; dataUrl: string; isLoading: boolean }> = [];

  $: normalizedInitialPage = Math.max(1, Math.floor(initialPage || 1));
  $: if (source !== undefined) {
    void loadPdf(source);
  }

  async function readSourceData(input: Exclude<PdfSource, null>): Promise<Uint8Array> {
    if (input instanceof Uint8Array) {
      return input;
    }

    if (input instanceof ArrayBuffer) {
      return new Uint8Array(input.slice(0));
    }

    const buffer = await input.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async function loadPdf(input: PdfSource) {
    const token = ++loadToken;
    errorMessage = '';
    isLoading = Boolean(input);
    pageCount = 0;
    currentPage = normalizedInitialPage;
    thumbnailItems = [];
    cancelRenderTask();

    if (pdfDocument) {
      await destroyDocument(pdfDocument);
      pdfDocument = null;
    }

    if (!input) {
      isLoading = false;
      clearCanvas();
      return;
    }

    try {
      const data = await readSourceData(input);
      const loadingTask = getDocument({
        data,
        useWorkerFetch: false,
        isEvalSupported: false,
        disableAutoFetch: true,
        disableStream: true,
      });

      const loadedDocument = await loadingTask.promise;

      if (token !== loadToken) {
        await destroyDocument(loadedDocument);
        return;
      }

      pdfDocument = loadedDocument;
      pageCount = loadedDocument.numPages;
      currentPage = clampPage(normalizedInitialPage);
      isLoading = false;
      dispatch('load', { pageCount });
      await renderCurrentPage();

      if (showThumbnails) {
        void renderThumbnails();
      }
    } catch (error) {
      if (token !== loadToken) return;
      handleError(error);
    } finally {
      if (token === loadToken) {
        isLoading = false;
      }
    }
  }

  async function renderCurrentPage() {
    if (!pdfDocument || !canvasElement) return;

    const token = ++renderToken;
    cancelRenderTask();
    isRendering = true;
    errorMessage = '';

    try {
      const page = await pdfDocument.getPage(currentPage);
      if (token !== renderToken) return;

      await renderPageToCanvas(page, canvasElement, scale, maxCanvasWidth);
      page.cleanup();
    } catch (error) {
      if (isCancelledRender(error) || token !== renderToken) return;
      handleError(error);
    } finally {
      if (token === renderToken) {
        isRendering = false;
      }
    }
  }

  async function renderPageToCanvas(
    page: PDFPageProxy,
    canvas: HTMLCanvasElement,
    targetScale: number,
    widthLimit: number,
  ) {
    const baseViewport = page.getViewport({ scale: targetScale });
    const ratio = widthLimit > 0 && baseViewport.width > widthLimit ? widthLimit / baseViewport.width : 1;
    const viewport = page.getViewport({ scale: targetScale * ratio });
    const outputScale = Math.max(1, window.devicePixelRatio || 1);
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) {
      throw new Error('No se pudo preparar el canvas para renderizar el PDF.');
    }

    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
    context.clearRect(0, 0, viewport.width, viewport.height);

    renderTask = page.render({ canvasContext: context, viewport });
    await renderTask.promise;
    renderTask = null;
  }

  async function renderThumbnails() {
    if (!pdfDocument) return;

    const token = ++thumbnailToken;
    thumbnailItems = Array.from({ length: pageCount }, (_, index) => ({
      pageNumber: index + 1,
      dataUrl: '',
      isLoading: true,
    }));

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      if (token !== thumbnailToken || !pdfDocument) return;
      await yieldToBrowser();

      try {
        const page = await pdfDocument.getPage(pageNumber);
        const dataUrl = await renderThumbnail(page);
        page.cleanup();

        if (token !== thumbnailToken) return;
        thumbnailItems = thumbnailItems.map((item) =>
          item.pageNumber === pageNumber ? { ...item, dataUrl, isLoading: false } : item,
        );
      } catch {
        thumbnailItems = thumbnailItems.map((item) =>
          item.pageNumber === pageNumber ? { ...item, isLoading: false } : item,
        );
      }
    }
  }

  async function renderThumbnail(page: PDFPageProxy) {
    const viewport = page.getViewport({ scale: thumbnailScale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });

    if (!context) return '';

    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    const task = page.render({ canvasContext: context, viewport });
    await task.promise;
    return canvas.toDataURL('image/webp', 0.72);
  }

  function selectPage(pageNumber: number) {
    const nextPage = clampPage(pageNumber);

    if (nextPage === currentPage || !pdfDocument) return;

    currentPage = nextPage;
    dispatch('pageSelect', { pageNumber: currentPage, pageCount });
    void renderCurrentPage();
  }

  function previousPage() {
    selectPage(currentPage - 1);
  }

  function nextPage() {
    selectPage(currentPage + 1);
  }

  function clampPage(pageNumber: number) {
    if (!pageCount) return Math.max(1, Math.floor(pageNumber || 1));
    return Math.min(pageCount, Math.max(1, Math.floor(pageNumber || 1)));
  }

  function clearCanvas() {
    if (!canvasElement) return;
    const context = canvasElement.getContext('2d');
    context?.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasElement.removeAttribute('style');
    canvasElement.width = 0;
    canvasElement.height = 0;
  }

  function cancelRenderTask() {
    if (!renderTask) return;
    renderTask.cancel();
    renderTask = null;
  }

  async function destroyDocument(document: PDFDocumentProxy) {
    try {
      await document.destroy();
    } catch {
      // pdf.js can throw if the document is already being destroyed.
    }
  }

  function handleError(error: unknown) {
    const message = getFriendlyErrorMessage(error);
    errorMessage = message;
    pageCount = 0;
    thumbnailItems = [];
    clearCanvas();
    dispatch('error', { message, error });
  }

  function getFriendlyErrorMessage(error: unknown) {
    if (error instanceof Error) {
      if (/password/i.test(error.name) || /password/i.test(error.message)) {
        return 'El PDF está protegido con contraseña o no se puede abrir sin permisos.';
      }

      if (/invalid|corrupt|damaged/i.test(error.message)) {
        return 'El PDF parece estar dañado o no tiene un formato válido.';
      }

      return error.message;
    }

    return 'No se pudo cargar el PDF. Revisa el archivo e inténtalo de nuevo.';
  }

  function isCancelledRender(error: unknown) {
    return error instanceof Error && error.name === 'RenderingCancelledException';
  }

  function yieldToBrowser() {
    return new Promise<void>((resolve) => {
      window.requestIdleCallback?.(() => resolve(), { timeout: 120 }) ?? window.setTimeout(resolve, 0);
    });
  }

  onDestroy(async () => {
    loadToken += 1;
    renderToken += 1;
    thumbnailToken += 1;
    cancelRenderTask();

    if (pdfDocument) {
      await destroyDocument(pdfDocument);
      pdfDocument = null;
    }
  });
</script>

<div class="pdf-viewer" aria-label={ariaLabel}>
  {#if errorMessage}
    <div class="pdf-viewer__error" role="alert">
      <strong>No se pudo previsualizar el PDF</strong>
      <p>{errorMessage}</p>
    </div>
  {:else if !source}
    <div class="pdf-viewer__empty">
      <strong>Selecciona un PDF</strong>
      <p>El documento se previsualizará aquí sin salir del navegador.</p>
    </div>
  {:else}
    <div class="pdf-viewer__toolbar" aria-live="polite">
      <button type="button" on:click={previousPage} disabled={isLoading || isRendering || currentPage <= 1}>
        Anterior
      </button>
      <span>{isLoading ? 'Cargando PDF…' : `Página ${currentPage} de ${pageCount || '…'}`}</span>
      <button type="button" on:click={nextPage} disabled={isLoading || isRendering || currentPage >= pageCount}>
        Siguiente
      </button>
    </div>

    <div class:pdf-viewer__body={true} class:pdf-viewer__body--with-thumbnails={showThumbnails && pageCount > 1}>
      {#if showThumbnails && pageCount > 1}
        <aside class="pdf-viewer__thumbnails" aria-label="Miniaturas del PDF">
          {#each thumbnailItems as thumbnail}
            <button
              type="button"
              class:active={thumbnail.pageNumber === currentPage}
              on:click={() => selectPage(thumbnail.pageNumber)}
              aria-label={`Ir a la página ${thumbnail.pageNumber}`}
              aria-current={thumbnail.pageNumber === currentPage ? 'page' : undefined}
            >
              {#if thumbnail.dataUrl}
                <img src={thumbnail.dataUrl} alt={`Página ${thumbnail.pageNumber}`} loading="lazy" />
              {:else}
                <span>{thumbnail.isLoading ? '…' : thumbnail.pageNumber}</span>
              {/if}
            </button>
          {/each}
        </aside>
      {/if}

      <div class="pdf-viewer__page" aria-busy={isLoading || isRendering}>
        {#if isLoading}
          <div class="pdf-viewer__loading">Cargando documento…</div>
        {/if}
        <canvas bind:this={canvasElement} aria-label={`Página ${currentPage}`} />
      </div>
    </div>
  {/if}
</div>

<style>
  .pdf-viewer {
    display: grid;
    gap: 16px;
    width: 100%;
  }

  .pdf-viewer__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.86);
  }

  .pdf-viewer__toolbar button,
  .pdf-viewer__thumbnails button {
    border: 0;
    font: inherit;
    cursor: pointer;
  }

  .pdf-viewer__toolbar button {
    padding: 9px 14px;
    border-radius: 999px;
    background: #0f172a;
    color: #fff;
    font-weight: 800;
  }

  .pdf-viewer__toolbar button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .pdf-viewer__toolbar span {
    color: #475569;
    font-weight: 800;
  }

  .pdf-viewer__body {
    display: grid;
    gap: 16px;
  }

  .pdf-viewer__body--with-thumbnails {
    grid-template-columns: minmax(88px, 132px) minmax(0, 1fr);
    align-items: start;
  }

  .pdf-viewer__thumbnails {
    display: grid;
    max-height: min(70vh, 760px);
    gap: 10px;
    overflow: auto;
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.78);
  }

  .pdf-viewer__thumbnails button {
    display: grid;
    min-height: 96px;
    place-items: center;
    overflow: hidden;
    padding: 6px;
    border: 2px solid transparent;
    border-radius: 14px;
    background: #f8fafc;
    color: #64748b;
    font-weight: 900;
  }

  .pdf-viewer__thumbnails button.active {
    border-color: #ef4444;
    background: #fff1f2;
    color: #991b1b;
  }

  .pdf-viewer__thumbnails img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 8px;
  }

  .pdf-viewer__page {
    position: relative;
    display: grid;
    min-height: 260px;
    place-items: start center;
    overflow: auto;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 22px;
    background: #e5e7eb;
  }

  .pdf-viewer__page canvas {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 22px 70px rgba(15, 23, 42, 0.18);
  }

  .pdf-viewer__loading {
    position: absolute;
    inset: 16px;
    display: grid;
    place-items: center;
    border-radius: 16px;
    background: rgba(248, 250, 252, 0.88);
    color: #475569;
    font-weight: 900;
    z-index: 1;
  }

  .pdf-viewer__empty,
  .pdf-viewer__error {
    padding: 24px;
    border-radius: 22px;
    border: 1px solid #e2e8f0;
    background: rgba(255, 255, 255, 0.86);
  }

  .pdf-viewer__empty p,
  .pdf-viewer__error p {
    margin-bottom: 0;
    color: #64748b;
  }

  .pdf-viewer__error {
    border-color: #fecaca;
    background: #fff1f2;
    color: #991b1b;
  }

  .pdf-viewer__error p {
    color: #7f1d1d;
  }

  @media (max-width: 760px) {
    .pdf-viewer__body--with-thumbnails {
      grid-template-columns: 1fr;
    }

    .pdf-viewer__thumbnails {
      grid-auto-flow: column;
      grid-auto-columns: 88px;
      max-height: none;
      overflow-x: auto;
      overflow-y: hidden;
    }
  }
</style>
