<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { PDFDocument, rgb } from 'pdf-lib';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, formatFileSize, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';
  type PageSize = 'a4' | 'letter' | 'fit';
  type Orientation = 'auto' | 'portrait' | 'landscape';

  type ImageItem = {
    id: string;
    file: File;
    url: string;
    name: string;
    size: number;
    width: number;
    height: number;
    status: 'loading' | 'ready' | 'error';
  };

  type EmbeddedImage = Awaited<ReturnType<PDFDocument['embedJpg']>>;

  export let lang: Lang = 'es';

  const labels = {
    es: {
      eyebrow: 'Conversión local',
      title: 'Convierte imágenes en un PDF',
      description: 'Añade JPG, PNG o WebP, cambia el orden y genera un PDF privado directamente en tu navegador.',
      dropTitle: 'Arrastra imágenes aquí',
      dropActive: 'Suelta las imágenes para añadirlas',
      dropText: 'JPG, PNG o WebP · varias imágenes · sin subir archivos',
      choose: 'Seleccionar imágenes',
      privacy: 'Tus imágenes se procesan en este navegador. No se suben a ningún servidor.',
      invalid: 'Solo se admiten imágenes JPG, PNG o WebP.',
      empty: 'Añade al menos una imagen para generar el PDF.',
      options: 'Opciones del PDF',
      pageSize: 'Tamaño de página',
      a4: 'A4',
      letter: 'Carta',
      fit: 'Ajustar a imagen',
      orientation: 'Orientación',
      auto: 'Automática',
      portrait: 'Vertical',
      landscape: 'Horizontal',
      quality: 'Calidad WebP convertido',
      generate: 'Generar PDF',
      generating: 'Generando PDF…',
      ready: 'PDF generado correctamente. Revisa la vista previa o descárgalo.',
      error: 'No se pudo generar el PDF. Revisa las imágenes e inténtalo de nuevo.',
      reorder: 'Arrastra las miniaturas para ordenar. En móvil usa los botones ↑ y ↓.',
      up: 'Mover arriba',
      down: 'Mover abajo',
      remove: 'Eliminar',
      clear: 'Limpiar todo',
      totalSize: 'Tamaño total',
      pages: 'Páginas',
      loaded: 'imágenes listas',
      download: 'Descargar PDF',
      open: 'Abrir en pestaña',
      close: 'Cerrar',
      modalTitle: 'Vista previa del PDF generado',
      outputName: 'imagenes-a-pdf.pdf',
      loading: 'Cargando…',
    },
    en: {
      eyebrow: 'Local conversion',
      title: 'Convert images into a PDF',
      description: 'Add JPG, PNG or WebP files, reorder them and create a private PDF directly in your browser.',
      dropTitle: 'Drag images here',
      dropActive: 'Drop images to add them',
      dropText: 'JPG, PNG or WebP · multiple images · no uploads',
      choose: 'Select images',
      privacy: 'Your images are processed in this browser. They are not uploaded to any server.',
      invalid: 'Only JPG, PNG or WebP images are supported.',
      empty: 'Add at least one image to generate the PDF.',
      options: 'PDF options',
      pageSize: 'Page size',
      a4: 'A4',
      letter: 'Letter',
      fit: 'Fit to image',
      orientation: 'Orientation',
      auto: 'Automatic',
      portrait: 'Portrait',
      landscape: 'Landscape',
      quality: 'Converted WebP quality',
      generate: 'Generate PDF',
      generating: 'Generating PDF…',
      ready: 'PDF created successfully. Review the preview or download it.',
      error: 'The PDF could not be generated. Check the images and try again.',
      reorder: 'Drag thumbnails to reorder. On mobile, use the ↑ and ↓ buttons.',
      up: 'Move up',
      down: 'Move down',
      remove: 'Remove',
      clear: 'Clear all',
      totalSize: 'Total size',
      pages: 'Pages',
      loaded: 'images ready',
      download: 'Download PDF',
      open: 'Open in tab',
      close: 'Close',
      modalTitle: 'Generated PDF preview',
      outputName: 'images-to-pdf.pdf',
      loading: 'Loading…',
    },
  } as const;

  const fixedPageSizes: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
    a4: [595.28, 841.89],
    letter: [612, 792],
  };

  let inputElement: HTMLInputElement;
  let workspaceRegion: HTMLDivElement;
  let images: ImageItem[] = [];
  let pageSize: PageSize = 'a4';
  let orientation: Orientation = 'auto';
  let quality = 0.92;
  let isDragging = false;
  let dragDepth = 0;
  let draggedId = '';
  let dropTargetId = '';
  let isGenerating = false;
  let errorMessage = '';
  let statusMessage = '';
  let resultUrl = '';

  $: t = labels[lang] ?? labels.es;
  $: readyImages = images.filter((image) => image.status === 'ready');
  $: totalSize = images.reduce((sum, image) => sum + image.size, 0);
  $: canGenerate = readyImages.length > 0 && !isGenerating;

  function openFileDialog() {
    inputElement?.click();
  }

  async function handleInputChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    await addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    dragDepth += 1;
    isDragging = true;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    isDragging = dragDepth > 0;
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth = 0;
    isDragging = false;
    await addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  async function addFiles(files: File[]) {
    if (!files.length) return;

    cleanupResultUrl();
    statusMessage = '';

    const acceptedFiles = files.filter(isAcceptedImage);
    const invalidFiles = files.filter((file) => !isAcceptedImage(file));

    if (invalidFiles.length) errorMessage = t.invalid;
    if (!acceptedFiles.length) return;

    errorMessage = '';

    const nextImages = acceptedFiles.map((file, index) => ({
      id: `image-${crypto.randomUUID?.() ?? `${Date.now()}-${index}`}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
      width: 0,
      height: 0,
      status: 'loading' as const,
    }));

    images = [...images, ...nextImages];
    await tick();
    workspaceRegion?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    for (const item of nextImages) {
      try {
        const dimensions = await readImageDimensions(item.url);
        images = images.map((image) => image.id === item.id ? { ...image, ...dimensions, status: 'ready' } : image);
      } catch {
        images = images.map((image) => image.id === item.id ? { ...image, status: 'error' } : image);
      }

      await yieldToBrowser();
    }
  }

  function isAcceptedImage(file: File) {
    const lowerName = file.name.toLowerCase();
    return ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      || ['.jpg', '.jpeg', '.png', '.webp'].some((extension) => lowerName.endsWith(extension));
  }

  function readImageDimensions(url: string) {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = url;
    });
  }

  function removeImage(id: string) {
    const item = images.find((image) => image.id === id);
    if (item) URL.revokeObjectURL(item.url);
    images = images.filter((image) => image.id !== id);
    cleanupResultUrl();
  }

  function clearTool() {
    images.forEach((image) => URL.revokeObjectURL(image.url));
    images = [];
    pageSize = 'a4';
    orientation = 'auto';
    quality = 0.92;
    errorMessage = '';
    statusMessage = '';
    cleanupResultUrl();
  }

  function moveImage(id: string, offset: number) {
    const currentIndex = images.findIndex((image) => image.id === id);
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= images.length) return;

    const nextImages = [...images];
    const [item] = nextImages.splice(currentIndex, 1);
    nextImages.splice(nextIndex, 0, item);
    images = nextImages;
    cleanupResultUrl();
  }

  function handleImageDragStart(event: DragEvent, id: string) {
    draggedId = id;
    dropTargetId = '';
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function handleImageDragOver(event: DragEvent, id: string) {
    event.preventDefault();
    if (draggedId && draggedId !== id) dropTargetId = id;
  }

  function handleImageDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    const sourceId = event.dataTransfer?.getData('text/plain') || draggedId;
    draggedId = '';
    dropTargetId = '';
    moveImageBefore(sourceId, targetId);
  }

  function moveImageBefore(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const sourceIndex = images.findIndex((image) => image.id === sourceId);
    const targetIndex = images.findIndex((image) => image.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextImages = [...images];
    const [source] = nextImages.splice(sourceIndex, 1);
    const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    nextImages.splice(adjustedTargetIndex, 0, source);
    images = nextImages;
    cleanupResultUrl();
  }

  async function generatePdf() {
    if (!readyImages.length) {
      errorMessage = t.empty;
      return;
    }

    isGenerating = true;
    errorMessage = '';
    statusMessage = '';
    cleanupResultUrl();

    try {
      const pdfDocument = await PDFDocument.create();
      pdfDocument.setTitle('Imágenes a PDF');
      pdfDocument.setCreator('FácilPDF');
      pdfDocument.setProducer('FácilPDF');

      for (const item of readyImages) {
        const embedded = await embedImage(pdfDocument, item);
        const [pageWidth, pageHeight] = getPageDimensions(item);
        const page = pdfDocument.addPage([pageWidth, pageHeight]);
        page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });

        const margin = pageSize === 'fit' ? 0 : Math.min(36, pageWidth * 0.07, pageHeight * 0.07);
        const imageScale = Math.min((pageWidth - margin * 2) / embedded.width, (pageHeight - margin * 2) / embedded.height);
        const imageWidth = embedded.width * imageScale;
        const imageHeight = embedded.height * imageScale;

        page.drawImage(embedded.image, {
          x: (pageWidth - imageWidth) / 2,
          y: (pageHeight - imageHeight) / 2,
          width: imageWidth,
          height: imageHeight,
        });

        await yieldToBrowser();
      }

      const bytes = await pdfDocument.save({ useObjectStreams: true });
      resultUrl = createPdfObjectUrl(bytes);
      statusMessage = t.ready;
    } catch {
      errorMessage = t.error;
    } finally {
      isGenerating = false;
    }
  }

  async function embedImage(pdfDocument: PDFDocument, item: ImageItem) {
    const lowerName = item.name.toLowerCase();
    const isJpeg = item.file.type === 'image/jpeg' || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');
    const isPng = item.file.type === 'image/png' || lowerName.endsWith('.png');
    let image: EmbeddedImage;

    if (isJpeg) {
      image = await pdfDocument.embedJpg(await item.file.arrayBuffer());
    } else if (isPng) {
      image = await pdfDocument.embedPng(await item.file.arrayBuffer());
    } else {
      image = await pdfDocument.embedJpg(await renderImageToJpegBytes(item));
    }

    return { image, width: image.width, height: image.height };
  }

  async function renderImageToJpegBytes(item: ImageItem) {
    const image = await loadImageElement(item.url);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('No canvas context');

    canvas.width = Math.max(1, item.width);
    canvas.height = Math.max(1, item.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => nextBlob ? resolve(nextBlob) : reject(new Error('No blob')), 'image/jpeg', quality);
    });

    canvas.width = 1;
    canvas.height = 1;
    return await blob.arrayBuffer();
  }

  function loadImageElement(url: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function getPageDimensions(item: ImageItem): [number, number] {
    if (pageSize === 'fit') {
      return applyOrientation(clamp(item.width * 0.75, 144, 2400), clamp(item.height * 0.75, 144, 2400), item);
    }

    return applyOrientation(...fixedPageSizes[pageSize], item);
  }

  function applyOrientation(width: number, height: number, item: ImageItem): [number, number] {
    const shouldBeLandscape = orientation === 'landscape' || (orientation === 'auto' && item.width > item.height);
    const isLandscape = width > height;
    return shouldBeLandscape === isLandscape ? [width, height] : [height, width];
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function getOutputName() {
    if (readyImages.length === 1) {
      const baseName = readyImages[0].name.replace(/\.(jpe?g|png|webp)$/i, '').trim();
      return `${baseName || 'imagen'}-a-pdf.pdf`;
    }

    return t.outputName;
  }

  function cleanupResultUrl() {
    if (!resultUrl) return;
    URL.revokeObjectURL(resultUrl);
    resultUrl = '';
  }

  onDestroy(() => {
    cleanupResultUrl();
    images.forEach((image) => URL.revokeObjectURL(image.url));
  });
</script>

<section class="images-pdf-tool" aria-labelledby="images-pdf-title">
  <div class="images-pdf-tool__hero-card">
    <div class="images-pdf-tool__intro">
      <span class="images-pdf-tool__eyebrow">{t.eyebrow}</span>
      <h2 id="images-pdf-title">{t.title}</h2>
      <p>{t.description}</p>
      <p class="images-pdf-tool__privacy">🔒 {t.privacy}</p>
    </div>

    <button
      type="button"
      class:images-pdf-tool__dropzone={true}
      class:images-pdf-tool__dropzone--active={isDragging}
      on:click={openFileDialog}
      on:dragenter={handleDragEnter}
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
      aria-describedby="images-pdf-drop-help"
    >
      <span class="images-pdf-tool__drop-icon" aria-hidden="true">🖼️</span>
      <strong>{isDragging ? t.dropActive : t.dropTitle}</strong>
      <span id="images-pdf-drop-help">{t.dropText}</span>
      <em>{t.choose}</em>
    </button>

    <input
      bind:this={inputElement}
      class="images-pdf-tool__input"
      type="file"
      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
      multiple
      on:change={handleInputChange}
    />
  </div>

  {#if errorMessage}
    <div class="images-pdf-tool__alert images-pdf-tool__alert--error" role="alert">{errorMessage}</div>
  {/if}

  {#if statusMessage}
    <div class="images-pdf-tool__alert images-pdf-tool__alert--success" role="status">{statusMessage}</div>
  {/if}

  {#if images.length > 0}
    <div class="images-pdf-tool__workspace" bind:this={workspaceRegion}>
      <section class="images-pdf-tool__summary" aria-labelledby="images-pdf-summary-title">
        <h3 id="images-pdf-summary-title">{readyImages.length} {t.loaded}</h3>
        <div class="images-pdf-tool__metric-grid">
          <div><span>{t.pages}</span><strong>{readyImages.length}</strong></div>
          <div><span>{t.totalSize}</span><strong>{formatFileSize(totalSize)}</strong></div>
        </div>
      </section>

      <section class="images-pdf-tool__options" aria-labelledby="images-pdf-options-title">
        <h3 id="images-pdf-options-title">{t.options}</h3>
        <div class="images-pdf-tool__field-grid">
          <label>
            <span>{t.pageSize}</span>
            <select bind:value={pageSize} disabled={isGenerating}>
              <option value="a4">{t.a4}</option>
              <option value="letter">{t.letter}</option>
              <option value="fit">{t.fit}</option>
            </select>
          </label>
          <label>
            <span>{t.orientation}</span>
            <select bind:value={orientation} disabled={isGenerating}>
              <option value="auto">{t.auto}</option>
              <option value="portrait">{t.portrait}</option>
              <option value="landscape">{t.landscape}</option>
            </select>
          </label>
          <label>
            <span>{t.quality}: {Math.round(quality * 100)}%</span>
            <input type="range" min="0.65" max="1" step="0.01" bind:value={quality} disabled={isGenerating} />
          </label>
        </div>
      </section>

      <section class="images-pdf-tool__images" aria-labelledby="images-pdf-list-title">
        <div class="images-pdf-tool__section-header">
          <div>
            <h3 id="images-pdf-list-title">{t.pages}</h3>
            <p>{t.reorder}</p>
          </div>
          <button type="button" class="images-pdf-tool__secondary" on:click={clearTool} disabled={isGenerating}>{t.clear}</button>
        </div>

        <div class="images-pdf-tool__grid">
          {#each images as image, index (image.id)}
            <article
              class:images-pdf-tool__card={true}
              class:images-pdf-tool__card--dragging={draggedId === image.id}
              class:images-pdf-tool__card--drop-target={dropTargetId === image.id}
              draggable={image.status === 'ready'}
              on:dragstart={(event) => handleImageDragStart(event, image.id)}
              on:dragover={(event) => handleImageDragOver(event, image.id)}
              on:dragleave={() => (dropTargetId = '')}
              on:drop={(event) => handleImageDrop(event, image.id)}
              on:dragend={() => { draggedId = ''; dropTargetId = ''; }}
            >
              <div class="images-pdf-tool__thumb">
                {#if image.status === 'ready'}
                  <img src={image.url} alt={image.name} loading="lazy" />
                {:else if image.status === 'loading'}
                  <span>{t.loading}</span>
                {:else}
                  <span>{t.invalid}</span>
                {/if}
              </div>
              <div class="images-pdf-tool__card-body">
                <strong>{index + 1}. {image.name}</strong>
                <span>{image.width && image.height ? `${image.width} × ${image.height}px · ` : ''}{formatFileSize(image.size)}</span>
              </div>
              <div class="images-pdf-tool__card-actions">
                <button type="button" on:click={() => moveImage(image.id, -1)} disabled={index === 0 || isGenerating} aria-label={t.up}>↑</button>
                <button type="button" on:click={() => moveImage(image.id, 1)} disabled={index === images.length - 1 || isGenerating} aria-label={t.down}>↓</button>
                <button type="button" class="images-pdf-tool__danger" on:click={() => removeImage(image.id)} disabled={isGenerating}>{t.remove}</button>
              </div>
            </article>
          {/each}
        </div>
      </section>

      <div class="images-pdf-tool__actions">
        <button type="button" class="images-pdf-tool__primary" on:click={generatePdf} disabled={!canGenerate}>
          {isGenerating ? t.generating : t.generate}
        </button>
      </div>
    </div>
  {/if}

  <PdfResultModal
    open={Boolean(resultUrl)}
    pdfUrl={resultUrl}
    filename={getOutputName()}
    title={t.modalTitle}
    description={t.ready}
    downloadLabel={t.download}
    openLabel={t.open}
    closeLabel={t.close}
    on:close={cleanupResultUrl}
  />
</section>

<style>
  .images-pdf-tool { display: grid; gap: 20px; margin: 32px 0 64px; }
  .images-pdf-tool__hero-card, .images-pdf-tool__workspace, .images-pdf-tool__summary, .images-pdf-tool__options, .images-pdf-tool__images, .images-pdf-tool__alert { border: 1px solid #e2e8f0; border-radius: 24px; background: rgba(255, 255, 255, 0.88); box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08); }
  .images-pdf-tool__hero-card { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.95fr); gap: 20px; align-items: center; padding: 24px; border-radius: 32px; background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.17), transparent 34%), linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(248, 250, 252, 0.9)); }
  .images-pdf-tool__eyebrow { display: inline-flex; margin-bottom: 10px; padding: 6px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: .8rem; font-weight: 900; }
  .images-pdf-tool__intro h2, .images-pdf-tool__summary h3, .images-pdf-tool__options h3, .images-pdf-tool__images h3 { margin: 0 0 10px; letter-spacing: -.04em; }
  .images-pdf-tool__intro p, .images-pdf-tool__section-header p, .images-pdf-tool__card-body span { margin: 0; color: #64748b; }
  .images-pdf-tool__privacy { margin-top: 14px !important; font-weight: 850; }
  .images-pdf-tool__dropzone { display: grid; min-height: 250px; place-items: center; gap: 8px; width: 100%; padding: clamp(28px, 6vw, 48px); border: 2px dashed rgba(148, 163, 184, .95); border-radius: 28px; background: linear-gradient(135deg, rgba(248, 250, 252, .94), rgba(255, 255, 255, .82)); color: #0f172a; cursor: pointer; text-align: center; font: inherit; transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease; }
  .images-pdf-tool__dropzone:hover, .images-pdf-tool__dropzone:focus-visible, .images-pdf-tool__dropzone--active { border-color: #2563eb; box-shadow: 0 24px 70px rgba(37, 99, 235, .16); outline: none; transform: translateY(-2px); }
  .images-pdf-tool__dropzone--active { background: linear-gradient(135deg, rgba(239, 246, 255, .98), rgba(255, 255, 255, .92)); transform: scale(1.01); }
  .images-pdf-tool__drop-icon { display: grid; width: 78px; height: 78px; place-items: center; border-radius: 22px; background: #dbeafe; font-size: 2rem; box-shadow: 0 18px 40px rgba(15, 23, 42, .12); }
  .images-pdf-tool__dropzone strong { font-size: clamp(1.2rem, 2.4vw, 1.55rem); letter-spacing: -.03em; }
  .images-pdf-tool__dropzone span:not(.images-pdf-tool__drop-icon) { color: #64748b; font-weight: 800; }
  .images-pdf-tool__dropzone em { display: inline-flex; margin-top: 6px; padding: 10px 14px; border-radius: 999px; background: #2563eb; color: #fff; font-style: normal; font-weight: 950; }
  .images-pdf-tool__input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .images-pdf-tool__alert { padding: 16px 18px; font-weight: 850; }
  .images-pdf-tool__alert--error { border-color: #fecaca; background: #fff1f2; color: #991b1b; }
  .images-pdf-tool__alert--success { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
  .images-pdf-tool__workspace { display: grid; grid-template-columns: minmax(220px, .72fr) minmax(0, 1.28fr); gap: 18px; padding: 18px; }
  .images-pdf-tool__summary, .images-pdf-tool__options, .images-pdf-tool__images { padding: 18px; }
  .images-pdf-tool__images, .images-pdf-tool__actions { grid-column: 1 / -1; }
  .images-pdf-tool__metric-grid, .images-pdf-tool__field-grid { display: grid; gap: 12px; }
  .images-pdf-tool__metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .images-pdf-tool__metric-grid div { display: grid; gap: 6px; padding: 14px; border-radius: 18px; background: #f8fafc; }
  .images-pdf-tool__metric-grid span, .images-pdf-tool__field-grid label > span { color: #64748b; font-size: .78rem; font-weight: 850; text-transform: uppercase; }
  .images-pdf-tool__metric-grid strong { color: #0f172a; font-size: 1.15rem; }
  .images-pdf-tool__field-grid label { display: grid; gap: 8px; }
  .images-pdf-tool__field-grid select, .images-pdf-tool__field-grid input[type='range'] { width: 100%; }
  .images-pdf-tool__section-header { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
  .images-pdf-tool__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; }
  .images-pdf-tool__card { display: grid; gap: 10px; padding: 10px; border: 2px solid #e2e8f0; border-radius: 22px; background: #fff; box-shadow: 0 14px 34px rgba(15, 23, 42, .07); cursor: grab; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease; }
  .images-pdf-tool__card--dragging { opacity: .58; transform: scale(.98); }
  .images-pdf-tool__card--drop-target { border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, .1), 0 14px 34px rgba(15, 23, 42, .1); }
  .images-pdf-tool__thumb { display: grid; min-height: 158px; place-items: center; overflow: hidden; border-radius: 16px; background: #f1f5f9; color: #64748b; font-weight: 900; text-align: center; }
  .images-pdf-tool__thumb img { width: 100%; height: 100%; max-height: 220px; object-fit: contain; }
  .images-pdf-tool__card-body { display: grid; gap: 3px; min-width: 0; }
  .images-pdf-tool__card-body strong, .images-pdf-tool__card-body span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .images-pdf-tool__card-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .images-pdf-tool__card-actions button, .images-pdf-tool__primary, .images-pdf-tool__secondary { min-height: 42px; border: 0; border-radius: 999px; cursor: pointer; font: inherit; font-weight: 950; transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease; }
  .images-pdf-tool__card-actions button { background: #e2e8f0; color: #0f172a; }
  .images-pdf-tool__card-actions .images-pdf-tool__danger { grid-column: 1 / -1; background: #fee2e2; color: #991b1b; }
  .images-pdf-tool__primary:hover:not(:disabled), .images-pdf-tool__secondary:hover:not(:disabled), .images-pdf-tool__card-actions button:hover:not(:disabled) { transform: translateY(-1px); }
  .images-pdf-tool__primary:disabled, .images-pdf-tool__secondary:disabled, .images-pdf-tool__card-actions button:disabled { cursor: not-allowed; opacity: .5; }
  .images-pdf-tool__actions { display: flex; justify-content: flex-end; }
  .images-pdf-tool__primary, .images-pdf-tool__secondary { padding: 12px 16px; }
  .images-pdf-tool__primary { background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; box-shadow: 0 16px 34px rgba(37, 99, 235, .24); }
  .images-pdf-tool__secondary { background: #e2e8f0; color: #0f172a; }
  @media (prefers-reduced-motion: reduce) { .images-pdf-tool__dropzone, .images-pdf-tool__card, .images-pdf-tool__primary, .images-pdf-tool__secondary, .images-pdf-tool__card-actions button { transition: none; } }
  @media (max-width: 860px) { .images-pdf-tool__hero-card, .images-pdf-tool__workspace { grid-template-columns: 1fr; } }
  @media (max-width: 560px) { .images-pdf-tool__hero-card, .images-pdf-tool__workspace { padding: 14px; } .images-pdf-tool__dropzone { min-height: 220px; border-radius: 22px; } .images-pdf-tool__metric-grid, .images-pdf-tool__grid { grid-template-columns: 1fr; } .images-pdf-tool__actions, .images-pdf-tool__primary, .images-pdf-tool__secondary { width: 100%; } }
</style>
