<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { PDFDocument } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { savePendingPdfTransfer } from '../lib/pdfTransfer';
  import { createPdfObjectUrl, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';

  interface ScanPage {
    id: string;
    blob: Blob;
    objectUrl: string;
    name: string;
    width: number;
    height: number;
    rotation: number;
  }

  export let lang: Lang = 'es';

  const labels = {
    es: {
      title: 'Escanea documentos con la cámara',
      description: 'Haz fotos de una o varias páginas desde el móvil, ordénalas y genera un PDF privado sin subir nada a servidores.',
      camera: 'Cámara',
      upload: 'Subir imágenes',
      startCamera: 'Abrir cámara',
      stopCamera: 'Cerrar cámara',
      capture: 'Escanear página',
      captureAgain: 'Escanear otra página',
      cameraHelp: 'En móvil se intentará usar la cámara trasera. En escritorio puedes usar webcam o subir imágenes.',
      noCamera: 'No se pudo abrir la cámara. Revisa permisos o sube imágenes desde el dispositivo.',
      fileButton: 'Añadir imágenes',
      fileHelp: 'Puedes añadir JPG, PNG o WEBP. Cada imagen será una página del PDF.',
      pages: 'páginas escaneadas',
      empty: 'Todavía no has escaneado ninguna página.',
      rotateLeft: 'Girar izquierda',
      rotateRight: 'Girar derecha',
      remove: 'Eliminar página',
      moveUp: 'Subir página',
      moveDown: 'Bajar página',
      clear: 'Limpiar',
      generate: 'Generar PDF',
      generating: 'Generando PDF…',
      download: 'Descargar PDF',
      preview: 'Vista previa',
      closePreview: 'Cerrar vista previa',
      previewFallback: 'Tu navegador no puede mostrar la vista previa del PDF. Descárgalo para revisarlo.',
      needPages: 'Escanea o añade al menos una página para generar el PDF.',
      ready: 'PDF generado correctamente. Puedes revisarlo, descargarlo o abrirlo en otra herramienta.',
      error: 'No se pudo generar el PDF. Prueba con imágenes menos pesadas.',
      transferError: 'No se pudo pasar el PDF a la herramienta seleccionada. Descárgalo y súbelo manualmente.',
      downloadName: 'pdfworld-escaneado.pdf',
      sendTo: 'Pasar a otra herramienta',
      merge: 'Unir PDF',
      split: 'Dividir PDF',
      reorder: 'Ordenar PDF',
      rotate: 'Rotar PDF',
      deletePages: 'Eliminar páginas',
      compress: 'Comprimir PDF',
      scannedPage: 'Página escaneada',
      dragHint: 'Reordena páginas con los botones. El PDF se generará en este mismo orden.',
    },
    en: {
      title: 'Scan documents with your camera',
      description: 'Take photos of one or many pages from mobile, arrange them and create a private PDF without server uploads.',
      camera: 'Camera',
      upload: 'Upload images',
      startCamera: 'Open camera',
      stopCamera: 'Close camera',
      capture: 'Scan page',
      captureAgain: 'Scan another page',
      cameraHelp: 'On mobile, the rear camera will be requested. On desktop, use a webcam or upload images.',
      noCamera: 'The camera could not be opened. Check permissions or upload images from your device.',
      fileButton: 'Add images',
      fileHelp: 'You can add JPG, PNG or WEBP files. Each image becomes one PDF page.',
      pages: 'scanned pages',
      empty: 'No pages scanned yet.',
      rotateLeft: 'Rotate left',
      rotateRight: 'Rotate right',
      remove: 'Delete page',
      moveUp: 'Move page up',
      moveDown: 'Move page down',
      clear: 'Clear',
      generate: 'Generate PDF',
      generating: 'Generating PDF…',
      download: 'Download PDF',
      preview: 'Preview',
      closePreview: 'Close preview',
      previewFallback: 'Your browser cannot display the PDF preview. Download it to review it.',
      needPages: 'Scan or add at least one page to generate the PDF.',
      ready: 'PDF created successfully. You can review it, download it or open it in another tool.',
      error: 'The PDF could not be generated. Try with lighter images.',
      transferError: 'The PDF could not be passed to the selected tool. Download it and upload it manually.',
      downloadName: 'pdfworld-scanned.pdf',
      sendTo: 'Send to another tool',
      merge: 'Merge PDF',
      split: 'Split PDF',
      reorder: 'Reorder PDF',
      rotate: 'Rotate PDF',
      deletePages: 'Delete pages',
      compress: 'Compress PDF',
      scannedPage: 'Scanned page',
      dragHint: 'Reorder pages with the buttons. The PDF will be generated in this exact order.',
    },
  } as const;

  const transferTools = [
    { key: 'merge', route: 'unir-pdf' },
    { key: 'split', route: 'dividir-pdf' },
    { key: 'reorder', route: 'ordenar-pdf' },
    { key: 'rotate', route: 'rotar-pdf' },
    { key: 'deletePages', route: 'eliminar-paginas-pdf' },
    { key: 'compress', route: 'comprimir-pdf' },
  ] as const;

  let videoElement: HTMLVideoElement;
  let pages: ScanPage[] = [];
  let stream: MediaStream | null = null;
  let isCameraOpen = false;
  let isGenerating = false;
  let errorMessage = '';
  let statusMessage = '';
  let resultBytes: Uint8Array | null = null;
  let previewUrl = '';
  let isPreviewOpen = false;
  let pagesRegion: HTMLElement;

  $: t = labels[lang] ?? labels.es;
  $: canGenerate = pages.length > 0 && !isGenerating;
  $: canDownload = Boolean(resultBytes && !isGenerating);

  onMount(() => {
    return () => stopCamera();
  });

  onDestroy(() => {
    stopCamera();
    clearPages(false);
    clearResult();
  });

  async function startCamera() {
    errorMessage = '';
    statusMessage = '';

    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 2560 },
        },
        audio: false,
      });

      videoElement.srcObject = stream;
      await videoElement.play();
      isCameraOpen = true;
    } catch {
      errorMessage = t.noCamera;
      isCameraOpen = false;
    }
  }

  function stopCamera() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    isCameraOpen = false;
    if (videoElement) videoElement.srcObject = null;
  }

  async function capturePage() {
    if (!videoElement?.videoWidth || !videoElement?.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    if (!blob) return;

    addPage(blob, `${t.scannedPage} ${pages.length + 1}.jpg`, canvas.width, canvas.height);
  }

  async function handleImageInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith('image/'));
    await addImageFiles(files);
    input.value = '';
  }

  async function addImageFiles(files: File[]) {
    for (const file of files) {
      const dimensions = await getImageDimensions(file);
      addPage(file, file.name, dimensions.width, dimensions.height);
    }
  }

  function addPage(blob: Blob, name: string, width: number, height: number) {
    pages = [...pages, {
      id: newId(),
      blob,
      objectUrl: URL.createObjectURL(blob),
      name,
      width,
      height,
      rotation: 0,
    }];
    clearResult();
    errorMessage = '';
    statusMessage = '';
    void scrollToPages();
  }

  function rotatePage(id: string, delta: 90 | -90) {
    pages = pages.map((page) => page.id === id ? { ...page, rotation: normalizeRotation(page.rotation + delta) } : page);
    clearResult();
    statusMessage = '';
  }

  function removePage(id: string) {
    const page = pages.find((item) => item.id === id);
    if (page) URL.revokeObjectURL(page.objectUrl);
    pages = pages.filter((item) => item.id !== id);
    clearResult();
    statusMessage = '';
  }

  function movePage(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const nextPages = [...pages];
    const [page] = nextPages.splice(index, 1);
    nextPages.splice(targetIndex, 0, page);
    pages = nextPages;
    clearResult();
    statusMessage = '';
  }

  function clearPages(resetMessages = true) {
    pages.forEach((page) => URL.revokeObjectURL(page.objectUrl));
    pages = [];
    clearResult();
    if (resetMessages) {
      errorMessage = '';
      statusMessage = '';
    }
  }

  async function generatePdf(openPreview = true) {
    if (!canGenerate) {
      errorMessage = t.needPages;
      return null;
    }

    isGenerating = true;
    errorMessage = '';
    statusMessage = '';
    clearResult();

    try {
      const pdf = await PDFDocument.create();

      for (const page of pages) {
        const normalized = await normalizeImagePage(page);
        const imageBytes = await normalized.blob.arrayBuffer();
        const image = await pdf.embedJpg(imageBytes);
        const pdfPage = pdf.addPage([normalized.width, normalized.height]);
        pdfPage.drawImage(image, { x: 0, y: 0, width: normalized.width, height: normalized.height });
        await yieldToBrowser();
      }

      const bytes = await pdf.save({ useObjectStreams: true });
      resultBytes = new Uint8Array(bytes);
      previewUrl = createPdfObjectUrl(resultBytes);
      isPreviewOpen = openPreview;
      statusMessage = t.ready;
      return resultBytes;
    } catch {
      errorMessage = t.error;
      return null;
    } finally {
      isGenerating = false;
    }
  }

  async function normalizeImagePage(page: ScanPage) {
    const bitmap = await createImageBitmap(page.blob);
    const isSideways = page.rotation === 90 || page.rotation === 270;
    const width = isSideways ? bitmap.height : bitmap.width;
    const height = isSideways ? bitmap.width : bitmap.height;
    const maxSide = 1800;
    const ratio = Math.min(1, maxSide / Math.max(width, height));
    const outputWidth = Math.max(1, Math.round(width * ratio));
    const outputHeight = Math.max(1, Math.round(height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('No canvas context');

    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((page.rotation * Math.PI) / 180);
    context.drawImage(bitmap, -bitmap.width * ratio / 2, -bitmap.height * ratio / 2, bitmap.width * ratio, bitmap.height * ratio);
    context.restore();
    bitmap.close();

    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9);
    if (!blob) throw new Error('No blob generated');

    return { blob, width: outputWidth, height: outputHeight };
  }

  async function sendToTool(route: string) {
    const bytes = resultBytes ?? await generatePdf(false);
    if (!bytes) return;

    try {
      const file = new File([new Uint8Array(bytes)], t.downloadName, { type: 'application/pdf' });
      await savePendingPdfTransfer(file, 'Escanear PDF');
      window.location.href = `/${lang}/${route}`;
    } catch {
      errorMessage = t.transferError;
    }
  }

  function closePreview() {
    isPreviewOpen = false;
  }

  function clearResult() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    resultBytes = null;
    isPreviewOpen = false;
  }

  function thumbStyle(rotation: number) {
    const scale = rotation === 90 || rotation === 270 ? 0.72 : 1;
    return `transform: rotate(${rotation}deg) scale(${scale});`;
  }

  function getImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Invalid image'));
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  }

  function normalizeRotation(value: number) {
    return ((value % 360) + 360) % 360;
  }

  function newId() {
    return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  }

  async function scrollToPages() {
    await tick();
    pagesRegion?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<section class="scan-tool" aria-labelledby="scan-tool-title">
  <div class="scan-tool__hero">
    <div>
      <span class="scan-tool__eyebrow">PDFWorld</span>
      <h2 id="scan-tool-title">{t.title}</h2>
      <p>{t.description}</p>
    </div>
    <div class="scan-tool__counter" aria-live="polite">
      <strong>{pages.length}</strong>
      <span>{t.pages}</span>
    </div>
  </div>

  <div class="scan-tool__capture-grid">
    <section class="scan-tool__camera-card" aria-labelledby="camera-title">
      <div class="scan-tool__section-head">
        <h3 id="camera-title">{t.camera}</h3>
        <button type="button" class="scan-tool__secondary" on:click={isCameraOpen ? stopCamera : startCamera}>
          {isCameraOpen ? t.stopCamera : t.startCamera}
        </button>
      </div>

      <div class="scan-tool__video-frame">
        <video bind:this={videoElement} playsinline muted aria-label={t.camera}></video>
        {#if !isCameraOpen}
          <div class="scan-tool__video-placeholder" aria-hidden="true">
            <span>📷</span>
            <strong>{t.startCamera}</strong>
          </div>
        {/if}
      </div>

      <p>{t.cameraHelp}</p>
      <button type="button" class="scan-tool__primary" disabled={!isCameraOpen} on:click={capturePage}>
        {pages.length ? t.captureAgain : t.capture}
      </button>
    </section>

    <section class="scan-tool__upload-card" aria-labelledby="upload-title">
      <div class="scan-tool__section-head">
        <h3 id="upload-title">{t.upload}</h3>
      </div>
      <PdfDropzone
        multiple
        title={t.fileButton}
        activeTitle={t.fileButton}
        subtitle={t.fileHelp}
        help={t.fileHelp}
        accept="image/jpeg,image/png,image/webp"
        acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
        acceptedExtensions={['.jpg', '.jpeg', '.png', '.webp']}
        onFiles={addImageFiles}
        onInvalidFiles={() => (errorMessage = t.error)}
      />
    </section>
  </div>

  {#if errorMessage}<p class="scan-tool__message scan-tool__message--error" role="alert">{errorMessage}</p>{/if}
  {#if statusMessage}<p class="scan-tool__message scan-tool__message--success" role="status">{statusMessage}</p>{/if}

  <section class="scan-tool__pages" bind:this={pagesRegion} aria-labelledby="scan-pages-title">
    <div class="scan-tool__section-head scan-tool__section-head--wide">
      <div>
        <h3 id="scan-pages-title">{t.preview}</h3>
        <p>{t.dragHint}</p>
      </div>
      <div class="scan-tool__actions">
        <button type="button" class="scan-tool__secondary" disabled={!pages.length} on:click={() => clearPages()}>{t.clear}</button>
        <button type="button" class="scan-tool__primary" disabled={!canGenerate} on:click={() => generatePdf(true)}>{isGenerating ? t.generating : t.generate}</button>
        <button type="button" class="scan-tool__dark" disabled={!canDownload} on:click={() => (isPreviewOpen = true)}>{t.download}</button>
      </div>
    </div>

    {#if pages.length === 0}
      <p class="scan-tool__empty">{t.empty}</p>
    {:else}
      <div class="scan-tool__page-grid">
        {#each pages as page, index (page.id)}
          <article class="scan-tool__page-card">
            <div class="scan-tool__thumb-frame">
              <img src={page.objectUrl} alt={`${t.scannedPage} ${index + 1}`} style={thumbStyle(page.rotation)} loading="lazy" />
            </div>
            <div class="scan-tool__page-meta">
              <strong>{t.scannedPage} {index + 1}</strong>
              <span>{page.rotation}°</span>
            </div>
            <small>{page.name}</small>
            <div class="scan-tool__page-actions">
              <button type="button" aria-label={t.moveUp} disabled={index === 0} on:click={() => movePage(index, -1)}>↑</button>
              <button type="button" aria-label={t.moveDown} disabled={index === pages.length - 1} on:click={() => movePage(index, 1)}>↓</button>
              <button type="button" aria-label={t.rotateLeft} on:click={() => rotatePage(page.id, -90)}>↶</button>
              <button type="button" aria-label={t.rotateRight} on:click={() => rotatePage(page.id, 90)}>↷</button>
              <button type="button" aria-label={t.remove} on:click={() => removePage(page.id)}>×</button>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  {#if resultBytes}
    <section class="scan-tool__send" aria-labelledby="send-title">
      <h3 id="send-title">{t.sendTo}</h3>
      <div>
        {#each transferTools as tool}
          <button type="button" on:click={() => sendToTool(tool.route)}>{t[tool.key]}</button>
        {/each}
      </div>
    </section>
  {/if}
</section>

<PdfResultModal
  open={isPreviewOpen && Boolean(previewUrl)}
  pdfUrl={previewUrl}
  filename={t.downloadName}
  title={t.preview}
  description={t.ready}
  downloadLabel={t.download}
  closeLabel={t.closePreview}
  on:close={closePreview}
/>

<style>
  .scan-tool{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:radial-gradient(circle at top left,rgba(239,68,68,.12),transparent 34%),linear-gradient(135deg,rgba(255,255,255,.97),rgba(248,250,252,.9));box-shadow:0 30px 90px rgba(15,23,42,.11)}.scan-tool__hero,.scan-tool__section-head,.scan-tool__section-head--wide,.scan-tool__actions,.scan-tool__send div{display:flex;gap:14px;align-items:center}.scan-tool__hero,.scan-tool__section-head,.scan-tool__section-head--wide{justify-content:space-between}.scan-tool__hero h2,.scan-tool h3{margin:0}.scan-tool__hero h2{font-size:clamp(1.65rem,3vw,2.25rem);letter-spacing:-.04em}.scan-tool__hero p,.scan-tool__camera-card p,.scan-tool__section-head p,.scan-tool__empty,.scan-tool__page-card small{margin:0;color:#64748b}.scan-tool__eyebrow{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:rgba(239,68,68,.1);color:#b91c1c;font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.scan-tool__counter{display:grid;min-width:150px;gap:2px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:22px;background:rgba(255,255,255,.78);text-align:right}.scan-tool__counter strong{font-size:1.9rem;line-height:1}.scan-tool__counter span{color:#64748b;font-weight:800}.scan-tool__capture-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:18px}.scan-tool__camera-card,.scan-tool__upload-card,.scan-tool__pages,.scan-tool__send{display:grid;gap:14px;padding:16px;border:1px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 16px 38px rgba(15,23,42,.06)}.scan-tool__video-frame{position:relative;display:grid;min-height:360px;overflow:hidden;place-items:center;border-radius:22px;background:#0f172a}.scan-tool__video-frame video{display:block;width:100%;height:100%;max-height:62vh;object-fit:cover}.scan-tool__video-placeholder{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:10px;color:#fff;background:linear-gradient(135deg,#111827,#334155)}.scan-tool__video-placeholder span{font-size:3rem}.scan-tool__upload-button{display:grid;min-height:260px;place-items:center;align-content:center;gap:10px;width:100%;padding:28px;border:2px dashed #cbd5e1;border-radius:22px;background:linear-gradient(135deg,#f8fafc,#fff1f2);color:#0f172a;text-align:center}.scan-tool__upload-button span{font-size:2.4rem}.scan-tool button{border:0;cursor:pointer;font:inherit;font-weight:850;transition:transform 140ms ease,opacity 140ms ease,box-shadow 140ms ease}.scan-tool button:hover:not(:disabled){transform:translateY(-1px)}.scan-tool button:disabled{cursor:not-allowed;opacity:.45}.scan-tool__primary,.scan-tool__dark,.scan-tool__secondary,.scan-tool__send button{min-height:42px;padding:10px 14px;border-radius:999px}.scan-tool__primary{background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;box-shadow:0 16px 34px rgba(239,68,68,.24)}.scan-tool__dark{background:linear-gradient(135deg,#0f172a,#334155);color:#fff;box-shadow:0 16px 34px rgba(15,23,42,.18)}.scan-tool__secondary{background:#e2e8f0;color:#334155}.scan-tool__send button{background:#fff1f2;color:#991b1b}.scan-tool__file-input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.scan-tool__message,.scan-tool__empty{margin:0;padding:13px 15px;border-radius:16px;background:#f8fafc;font-weight:850}.scan-tool__message--error{background:#fff1f2;color:#991b1b}.scan-tool__message--success{background:#ecfdf5;color:#166534}.scan-tool__page-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(166px,1fr));gap:14px}.scan-tool__page-card{display:grid;gap:10px;padding:12px;border:2px solid #e2e8f0;border-radius:22px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,.06)}.scan-tool__thumb-frame{display:grid;min-height:210px;overflow:hidden;place-items:center;border:1px solid #e2e8f0;border-radius:16px;background:linear-gradient(135deg,#f8fafc,#fff1f2)}.scan-tool__thumb-frame img{display:block;max-width:86%;max-height:190px;object-fit:contain;box-shadow:0 12px 26px rgba(15,23,42,.16);transition:transform 180ms ease}.scan-tool__page-meta{display:flex;justify-content:space-between;gap:8px;align-items:center}.scan-tool__page-meta span{padding:5px 9px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:950;font-size:.82rem}.scan-tool__page-actions{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.scan-tool__page-actions button{min-height:36px;padding:6px;border-radius:999px;background:#e2e8f0;color:#334155}.scan-tool__page-actions button:last-child{background:#fee2e2;color:#991b1b}.pdf-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px}.pdf-modal__backdrop{position:absolute;inset:0;background:rgba(15,23,42,.72);backdrop-filter:blur(6px)}.pdf-modal__panel{position:relative;z-index:1;display:grid;grid-template-rows:auto minmax(0,1fr);width:min(1120px,96vw);height:min(820px,92vh);overflow:hidden;border-radius:24px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.35)}.pdf-modal__header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid #e2e8f0}.pdf-modal__header h2{margin:0;font-size:1.05rem}.pdf-modal__header div{display:flex;gap:10px;align-items:center}.pdf-modal__viewer{width:100%;height:100%;border:0;background:#f8fafc}.pdf-modal__download,.pdf-modal__close{border:0;cursor:pointer;font:inherit;font-weight:950}.pdf-modal__download{min-height:40px;padding:9px 14px;border-radius:999px;background:#ef4444;color:#fff}.pdf-modal__close{display:grid;width:40px;height:40px;place-items:center;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:1.35rem;line-height:1}@media (prefers-reduced-motion:reduce){.scan-tool button,.scan-tool__thumb-frame img{transition:none}}@media (max-width:900px){.scan-tool__hero,.scan-tool__capture-grid,.scan-tool__section-head--wide{display:grid;grid-template-columns:1fr}.scan-tool__counter{text-align:left}.scan-tool__actions,.scan-tool__send div{display:grid;grid-template-columns:1fr}.scan-tool__video-frame{min-height:310px}.pdf-modal{padding:10px}.pdf-modal__panel{height:94vh;border-radius:18px}}@media (max-width:560px){.scan-tool__page-grid{grid-template-columns:repeat(auto-fill,minmax(138px,1fr))}.scan-tool__thumb-frame{min-height:170px}.scan-tool__thumb-frame img{max-height:150px}.scan-tool__section-head{align-items:start;display:grid;grid-template-columns:1fr}}
</style>
