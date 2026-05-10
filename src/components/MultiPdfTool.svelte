<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import UploadedFilesList, { type UploadedFileItem } from './UploadedFilesList.svelte';
  import ToolOptionsPanel, { type ToolOptionAction } from './ToolOptionsPanel.svelte';
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
    error?: string;
  }

  interface PageItem {
    id: string;
    sourceId: string;
    fileName: string;
    pageIndex: number;
    pageNumber: number;
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
      intro:
        'Une, reordena, rota, elimina, divide por selección y añade texto a tus PDFs desde una sola pantalla. Todo se procesa localmente en tu navegador.',
      dropTitle: 'Arrastra uno o varios PDF aquí',
      dropActive: 'Suelta los PDF para añadirlos al editor',
      dropText: 'Suelta archivos o pulsa para seleccionarlos',
      fileHelp: 'Varios PDF · privado · sin subir archivos',
      loadedFiles: 'PDF cargados',
      filesSummary: 'PDF preparados',
      fileReady: 'Listo',
      noFiles: 'Carga uno o varios PDF para empezar a editarlos.',
      invalidFiles: 'Algunos archivos no son PDF y se han ignorado.',
      readError: 'No se pudo leer este PDF. Puede estar dañado o protegido.',
      rendering: 'Generando miniaturas… puedes seguir editando mientras tanto.',
      workspace: 'Editor de páginas',
      page: 'Página',
      from: 'de',
      selected: 'seleccionadas',
      finalPages: 'páginas finales',
      clear: 'Limpiar',
      moveUp: 'Subir',
      moveDown: 'Bajar',
      removePdf: 'Eliminar PDF',
      keepPage: 'Eliminar/restaurar',
      selectPage: 'Seleccionar para extraer',
      rotateLeft: 'Girar izquierda',
      rotateRight: 'Girar derecha',
      movePageUp: 'Mover página arriba',
      movePageDown: 'Mover página abajo',
      optionsBadge: 'Todo en uno',
      optionsTitle: 'Salida y edición',
      optionsDescription:
        'Elige si quieres generar todas las páginas conservadas o solo las seleccionadas, y añade texto visible si lo necesitas.',
      outputGroup: 'Qué quieres descargar',
      outputAll: 'Todas las páginas conservadas',
      outputSelected: 'Solo páginas seleccionadas',
      outputHelp: 'Usa la selección para dividir o extraer páginas concretas en un nuevo PDF.',
      textGroup: 'Añadir texto',
      textNone: 'No añadir texto',
      textAll: 'Añadir a todas las páginas exportadas',
      textSelected: 'Añadir solo a páginas seleccionadas',
      textLabel: 'Texto visible',
      textPlaceholder: 'Ej.: Revisado, borrador, confidencial…',
      textSize: 'Tamaño',
      textOpacity: 'Opacidad',
      textPosition: 'Posición',
      positionCenter: 'Centro',
      positionBottomRight: 'Abajo derecha',
      positionTopRight: 'Arriba derecha',
      positionBottomCenter: 'Abajo centro',
      generate: 'Generar PDF',
      generating: 'Generando PDF…',
      download: 'Descargar PDF',
      preview: 'Ver vista previa',
      readyTitle: 'PDF generado',
      ready: 'Tu PDF está listo. Puedes revisar la vista previa o descargarlo.',
      needPages: 'Selecciona o conserva al menos una página para generar el PDF.',
      needSelected: 'Selecciona al menos una página para exportar solo la selección.',
      createError: 'No se pudo generar el PDF. Revisa que los archivos no estén dañados o protegidos.',
      previewTitle: 'Vista previa de la multiherramienta PDF',
      closePreview: 'Cerrar vista previa',
      outputName: 'facilpdf-multiherramienta.pdf',
      processingStep1: 'Leyendo documentos',
      processingStep2: 'Copiando páginas',
      processingStep3: 'Aplicando rotaciones y texto',
      processingStep4: 'Preparando descarga',
    },
    en: {
      title: 'PDF multitool',
      intro:
        'Merge, reorder, rotate, delete, split by selection and add text to your PDFs from one screen. Everything runs locally in your browser.',
      dropTitle: 'Drag one or more PDFs here',
      dropActive: 'Drop PDFs to add them to the editor',
      dropText: 'Drop files or click to select them',
      fileHelp: 'Multiple PDFs · private · no uploads',
      loadedFiles: 'Loaded PDFs',
      filesSummary: 'PDF ready',
      fileReady: 'Ready',
      noFiles: 'Load one or more PDFs to start editing them.',
      invalidFiles: 'Some files were not PDFs and were ignored.',
      readError: 'This PDF could not be read. It may be damaged or protected.',
      rendering: 'Generating thumbnails… you can keep editing meanwhile.',
      workspace: 'Page editor',
      page: 'Page',
      from: 'from',
      selected: 'selected',
      finalPages: 'final pages',
      clear: 'Clear',
      moveUp: 'Move up',
      moveDown: 'Move down',
      removePdf: 'Remove PDF',
      keepPage: 'Delete/restore',
      selectPage: 'Select to extract',
      rotateLeft: 'Rotate left',
      rotateRight: 'Rotate right',
      movePageUp: 'Move page up',
      movePageDown: 'Move page down',
      optionsBadge: 'All in one',
      optionsTitle: 'Output and editing',
      optionsDescription:
        'Choose whether to export all kept pages or only selected pages, and add visible text if needed.',
      outputGroup: 'What to download',
      outputAll: 'All kept pages',
      outputSelected: 'Selected pages only',
      outputHelp: 'Use selection to split or extract specific pages into a new PDF.',
      textGroup: 'Add text',
      textNone: 'Do not add text',
      textAll: 'Add to all exported pages',
      textSelected: 'Add only to selected pages',
      textLabel: 'Visible text',
      textPlaceholder: 'E.g. Reviewed, draft, confidential…',
      textSize: 'Size',
      textOpacity: 'Opacity',
      textPosition: 'Position',
      positionCenter: 'Center',
      positionBottomRight: 'Bottom right',
      positionTopRight: 'Top right',
      positionBottomCenter: 'Bottom center',
      generate: 'Generate PDF',
      generating: 'Generating PDF…',
      download: 'Download PDF',
      preview: 'Preview',
      readyTitle: 'PDF generated',
      ready: 'Your PDF is ready. You can preview or download it.',
      needPages: 'Select or keep at least one page to generate the PDF.',
      needSelected: 'Select at least one page to export only the selection.',
      createError: 'The PDF could not be generated. Check that files are not damaged or protected.',
      previewTitle: 'PDF multitool preview',
      closePreview: 'Close preview',
      outputName: 'facilpdf-multitool.pdf',
      processingStep1: 'Reading documents',
      processingStep2: 'Copying pages',
      processingStep3: 'Applying rotations and text',
      processingStep4: 'Preparing download',
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
  let textSize = 38;
  let textOpacity = 0.22;
  let textPosition = 'center';
  let workspaceRegion: HTMLDivElement;

  $: t = copy[lang] ?? copy.es;
  $: keptPages = pages.filter((page) => page.kept);
  $: selectedPages = pages.filter((page) => page.kept && page.selected);
  $: exportPages = outputMode === 'selected' ? selectedPages : keptPages;
  $: totalSourcePages = sources.reduce((sum, source) => sum + source.pageCount, 0);
  $: canGenerate = exportPages.length > 0 && !isGenerating;
  $: uploadedFiles = sources.map((source): UploadedFileItem => ({
    id: source.id,
    name: source.file.name,
    size: `${formatFileSize(source.file.size)} · ${source.pageCount} ${t.finalPages}`,
    type: source.file.type || 'application/pdf',
    status: source.error ? 'error' : 'ready',
    statusLabel: source.error ?? t.fileReady,
  }));
  $: optionActions = [
    { label: t.clear, variant: 'secondary', disabled: isGenerating, onClick: clearTool },
    { label: isGenerating ? t.generating : t.generate, variant: 'primary', disabled: !canGenerate, onClick: generatePdf },
    { label: t.preview, variant: 'secondary', disabled: !previewUrl || isGenerating, onClick: () => (isPreviewOpen = true) },
  ] satisfies ToolOptionAction[];

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
          kept: true,
          selected: false,
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

      for (const item of sourcePages) {
        if (token !== renderToken || !sources.some((sourceItem) => sourceItem.id === source.id)) return;
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
    pages = pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page));
  }

  function reorderSource(sourceId: string, direction: -1 | 1) {
    const fromIndex = sources.findIndex((source) => source.id === sourceId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= sources.length) return;

    const nextSources = [...sources];
    const [source] = nextSources.splice(fromIndex, 1);
    nextSources.splice(toIndex, 0, source);
    sources = nextSources;
    pages = nextSources.flatMap((sourceItem) => pages.filter((page) => page.sourceId === sourceItem.id));
    clearResult();
  }

  function removeSource(sourceId: string) {
    pages
      .filter((page) => page.sourceId === sourceId && page.thumbUrl)
      .forEach((page) => URL.revokeObjectURL(page.thumbUrl!));
    sources = sources.filter((source) => source.id !== sourceId);
    pages = pages.filter((page) => page.sourceId !== sourceId);
    clearResult();
  }

  function movePage(pageId: string, direction: -1 | 1) {
    const fromIndex = pages.findIndex((page) => page.id === pageId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= pages.length) return;

    const nextPages = [...pages];
    const [page] = nextPages.splice(fromIndex, 1);
    nextPages.splice(toIndex, 0, page);
    pages = nextPages;
    clearResult();
  }

  function toggleKept(pageId: string) {
    const page = pages.find((item) => item.id === pageId);
    if (!page) return;

    if (page.kept && keptPages.length <= 1) {
      errorMessage = t.needPages;
      return;
    }

    updatePage(pageId, { kept: !page.kept, selected: page.kept ? false : page.selected });
    clearResult();
  }

  function toggleSelected(pageId: string) {
    const page = pages.find((item) => item.id === pageId);
    if (!page?.kept) return;
    updatePage(pageId, { selected: !page.selected });
    clearResult();
  }

  function rotatePage(pageId: string, delta: 90 | -90) {
    const page = pages.find((item) => item.id === pageId);
    if (!page) return;
    updatePage(pageId, { rotation: normalize(page.rotation + delta) });
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
    const size = Number(textSize) || 38;
    const textWidth = font.widthOfTextAtSize(text, size);
    const margin = 42;
    const positions = {
      center: { x: Math.max(margin, (width - textWidth) / 2), y: height / 2 },
      bottomRight: { x: Math.max(margin, width - textWidth - margin), y: margin },
      topRight: { x: Math.max(margin, width - textWidth - margin), y: height - margin - size },
      bottomCenter: { x: Math.max(margin, (width - textWidth) / 2), y: margin },
    } as const;
    const point = positions[textPosition as keyof typeof positions] ?? positions.center;

    page.drawText(text, {
      x: point.x,
      y: point.y,
      size,
      font,
      color: rgb(0.85, 0.12, 0.1),
      opacity: Number(textOpacity) || 0.22,
      rotate: textPosition === 'center' ? degrees(-24) : degrees(0),
    });
  }

  function thumbStyle(rotation: number) {
    const scale = rotation === 90 || rotation === 270 ? 0.72 : 1;
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
  <div class="multi-tool__hero">
    <div>
      <span class="multi-tool__eyebrow">FácilPDF Pro</span>
      <h2 id="multi-tool-title">{t.title}</h2>
      <p>{t.intro}</p>
    </div>

    <div class="multi-tool__stats" aria-live="polite">
      <strong>{keptPages.length}</strong>
      <span>{t.finalPages}</span>
      <small>{sources.length} PDF · {totalSourcePages} páginas · {selectedPages.length} {t.selected}</small>
    </div>
  </div>

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
    <ProcessingState
      title={t.generating}
      description={t.optionsDescription}
      steps={[
        { label: t.processingStep1, done: true },
        { label: t.processingStep2, active: true },
        { label: t.processingStep3 },
        { label: t.processingStep4 },
      ]}
    />
  {/if}

  {#if sources.length === 0}
    <p class="multi-tool__empty">{t.noFiles}</p>
  {:else}
    <div class="multi-tool__workspace" bind:this={workspaceRegion}>
      <aside class="multi-tool__sidebar">
        <UploadedFilesList
          files={uploadedFiles}
          title={t.loadedFiles}
          summaryLabel={t.filesSummary}
          removeLabel={t.removePdf}
          moveUpLabel={t.moveUp}
          moveDownLabel={t.moveDown}
          reorderable={true}
          onRemove={(file) => removeSource(file.id)}
          onMoveUp={(file) => reorderSource(file.id, -1)}
          onMoveDown={(file) => reorderSource(file.id, 1)}
        />

        <ToolOptionsPanel
          title={t.optionsTitle}
          description={t.optionsDescription}
          badge={t.optionsBadge}
          actions={optionActions}
          compact={true}
        >
          <section class="tool-options-group">
            <h3 class="tool-options-group__title">{t.outputGroup}</h3>
            <label class="tool-options-choice">
              <input type="radio" bind:group={outputMode} value="all" />
              <span>{t.outputAll}</span>
            </label>
            <label class="tool-options-choice">
              <input type="radio" bind:group={outputMode} value="selected" />
              <span>{t.outputSelected}</span>
            </label>
            <p class="tool-options-help">{t.outputHelp}</p>
          </section>

          <section class="tool-options-group">
            <h3 class="tool-options-group__title">{t.textGroup}</h3>
            <label class="tool-options-choice">
              <input type="radio" bind:group={textMode} value="none" />
              <span>{t.textNone}</span>
            </label>
            <label class="tool-options-choice">
              <input type="radio" bind:group={textMode} value="all" />
              <span>{t.textAll}</span>
            </label>
            <label class="tool-options-choice">
              <input type="radio" bind:group={textMode} value="selected" />
              <span>{t.textSelected}</span>
            </label>

            {#if textMode !== 'none'}
              <div class="tool-options-field">
                <label class="tool-options-label" for="multi-text">{t.textLabel}</label>
                <input id="multi-text" bind:value={textValue} placeholder={t.textPlaceholder} />
              </div>

              <div class="tool-options-row">
                <div class="tool-options-field">
                  <label class="tool-options-label" for="multi-size">{t.textSize}</label>
                  <input id="multi-size" type="number" min="8" max="120" bind:value={textSize} />
                </div>
                <div class="tool-options-field">
                  <label class="tool-options-label" for="multi-opacity">{t.textOpacity}</label>
                  <input id="multi-opacity" type="range" min="0.05" max="1" step="0.05" bind:value={textOpacity} />
                </div>
              </div>

              <div class="tool-options-field">
                <label class="tool-options-label" for="multi-position">{t.textPosition}</label>
                <select id="multi-position" bind:value={textPosition}>
                  <option value="center">{t.positionCenter}</option>
                  <option value="bottomRight">{t.positionBottomRight}</option>
                  <option value="topRight">{t.positionTopRight}</option>
                  <option value="bottomCenter">{t.positionBottomCenter}</option>
                </select>
              </div>
            {/if}
          </section>
        </ToolOptionsPanel>

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

      <section class="multi-tool__pages" aria-label={t.workspace}>
        {#each pages as item, index (item.id)}
          <article class:multi-page={true} class:multi-page--removed={!item.kept} class:multi-page--selected={item.selected}>
            <div class="multi-page__thumb-frame">
              <div class="multi-page__thumb" style={thumbStyle(item.rotation)}>
                {#if item.thumbStatus === 'ready' && item.thumbUrl}
                  <img src={item.thumbUrl} alt={`${t.page} ${item.pageNumber} ${t.from} ${item.fileName}`} loading="lazy" />
                {:else}
                  <span class:multi-page__placeholder={true} class:multi-page__placeholder--loading={item.thumbStatus === 'pending'}>{item.pageNumber}</span>
                {/if}
              </div>
            </div>

            <div class="multi-page__meta">
              <strong>{t.page} {item.pageNumber}</strong>
              <span>{item.rotation}°</span>
            </div>
            <small>{item.fileName}</small>

            <div class="multi-page__actions">
              <button type="button" on:click={() => movePage(item.id, -1)} disabled={index === 0} aria-label={t.movePageUp}>↑</button>
              <button type="button" on:click={() => movePage(item.id, 1)} disabled={index === pages.length - 1} aria-label={t.movePageDown}>↓</button>
              <button type="button" on:click={() => rotatePage(item.id, -90)} aria-label={t.rotateLeft}>↶</button>
              <button type="button" on:click={() => rotatePage(item.id, 90)} aria-label={t.rotateRight}>↷</button>
              <button type="button" class="multi-page__select" on:click={() => toggleSelected(item.id)} disabled={!item.kept} aria-label={t.selectPage}>✓</button>
              <button type="button" class="multi-page__delete" on:click={() => toggleKept(item.id)} aria-label={t.keepPage}>{item.kept ? '×' : '+'}</button>
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
  .multi-tool{display:grid;gap:22px;margin:34px 0 64px;padding:clamp(18px,3vw,30px);border:1px solid var(--color-border,#e2e8f0);border-radius:32px;background:radial-gradient(circle at top left,color-mix(in srgb,var(--color-primary,#2563eb) 14%,transparent),transparent 34rem),var(--color-surface-raised,#fff);box-shadow:var(--shadow-sm,0 4px 12px rgb(15 23 42 / .08))}.multi-tool__hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.multi-tool__hero h2{margin:0 0 8px;font-size:clamp(1.7rem,3vw,2.5rem);letter-spacing:-.045em}.multi-tool__hero p,.multi-tool__empty{margin:0;color:var(--color-text-muted,#475569)}.multi-tool__eyebrow{display:inline-flex;margin-bottom:10px;padding:6px 10px;border-radius:999px;background:var(--color-primary-soft,#dbeafe);color:var(--color-primary,#2563eb);font-size:.8rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.multi-tool__stats{display:grid;min-width:170px;gap:2px;padding:14px 16px;border:1px solid var(--color-border,#e2e8f0);border-radius:22px;background:var(--color-surface,#fff);text-align:right}.multi-tool__stats strong{font-size:2rem;line-height:1}.multi-tool__stats span,.multi-tool__stats small{color:var(--color-text-muted,#475569);font-weight:800}.multi-tool__message,.multi-tool__empty{padding:13px 15px;border-radius:16px;background:var(--color-surface-soft,#f1f5f9);font-weight:850}.multi-tool__message{margin:0}.multi-tool__message--error{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#dc2626)}.multi-tool__message--success{background:var(--color-success-soft,#dcfce7);color:var(--color-success,#16a34a)}.multi-tool__workspace{display:grid;grid-template-columns:390px minmax(0,1fr);gap:20px;align-items:start}.multi-tool__sidebar{position:sticky;top:18px;display:grid;gap:14px}.multi-tool__pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}.multi-page{display:grid;gap:10px;padding:12px;border:2px solid var(--color-border,#e2e8f0);border-radius:22px;background:var(--color-surface,#fff);box-shadow:var(--shadow-xs,0 1px 2px rgb(15 23 42 / .06));transition:transform 160ms ease,border-color 160ms ease,box-shadow 160ms ease,opacity 160ms ease}.multi-page:hover{transform:translateY(-2px);box-shadow:var(--shadow-sm,0 4px 12px rgb(15 23 42 / .08))}.multi-page--selected{border-color:var(--color-primary,#2563eb);background:color-mix(in srgb,var(--color-primary,#2563eb) 8%,var(--color-surface,#fff))}.multi-page--removed{opacity:.55;border-color:var(--color-danger,#dc2626);background:var(--color-danger-soft,#fee2e2)}.multi-page__thumb-frame{display:grid;min-height:200px;place-items:center;overflow:hidden;border:1px solid var(--color-border,#e2e8f0);border-radius:16px;background:linear-gradient(135deg,var(--color-surface-soft,#f1f5f9),var(--color-surface,#fff))}.multi-page__thumb{display:grid;width:82%;place-items:center;transition:transform 180ms ease}.multi-page__thumb img{display:block;width:100%;height:auto;box-shadow:0 12px 26px rgb(15 23 42 / .16);pointer-events:none}.multi-page__placeholder{display:grid;width:100%;min-height:138px;place-items:center;border-radius:12px;background:var(--color-surface-soft,#f1f5f9);color:var(--color-text-soft,#64748b);font-size:1.35rem;font-weight:950}.multi-page__placeholder--loading{background:linear-gradient(100deg,#f1f5f9 20%,#fff 45%,#f1f5f9 70%);background-size:220% 100%;animation:thumb-loading 1.4s ease-in-out infinite}.multi-page__meta{display:flex;justify-content:space-between;gap:8px;align-items:center}.multi-page__meta span{padding:5px 9px;border-radius:999px;background:var(--color-surface-soft,#f1f5f9);color:var(--color-text-muted,#475569);font-weight:950;font-size:.82rem}.multi-page small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-muted,#475569);font-size:.8rem}.multi-page__actions{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.multi-page__actions button{min-height:36px;border:0;border-radius:999px;background:var(--color-surface-soft,#f1f5f9);color:var(--color-text,#0f172a);cursor:pointer;font:inherit;font-weight:950}.multi-page__actions button:disabled{cursor:not-allowed;opacity:.4}.multi-page__select{background:var(--color-primary-soft,#dbeafe)!important;color:var(--color-primary,#2563eb)!important}.multi-page__delete{background:var(--color-danger-soft,#fee2e2)!important;color:var(--color-danger,#dc2626)!important}@keyframes thumb-loading{0%{background-position:120% 0}100%{background-position:-120% 0}}@media (max-width:980px){.multi-tool__hero,.multi-tool__workspace{display:grid;grid-template-columns:1fr}.multi-tool__sidebar{position:static}.multi-tool__stats{text-align:left}.multi-tool__pages{grid-template-columns:repeat(auto-fill,minmax(145px,1fr))}.multi-page__thumb-frame{min-height:165px}}@media (max-width:520px){.multi-tool{padding:16px;border-radius:24px}.multi-page__actions{grid-template-columns:repeat(3,1fr)}}@media (prefers-reduced-motion:reduce){.multi-page,.multi-page__thumb{transition:none}.multi-page__placeholder--loading{animation:none}}
</style>
