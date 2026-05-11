<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { PDFDocument } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, formatFileSize, getFriendlyPdfError, getPdfBaseFilename, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';
  type SignatureMode = 'draw' | 'upload';

  export let lang: Lang = 'es';

  const copy = {
    es: {
      title: 'Firma visual para PDF',
      intro: 'Dibuja una firma o sube una imagen, elige la página, colócala y descarga una copia firmada.',
      warning: 'Aviso: esta herramienta añade una firma visual. No crea una firma digital criptográfica ni valida la identidad del firmante.',
      drop: 'Arrastra un PDF aquí',
      active: 'Suelta el PDF',
      subtitle: 'Suelta el archivo o pulsa para seleccionarlo',
      help: 'Solo PDF · procesamiento local',
      invalid: 'Selecciona un PDF válido.',
      invalidSignature: 'Dibuja una firma o sube una imagen PNG/JPG de firma.',
      unsupportedImage: 'Sube una imagen PNG o JPG válida.',
      error: 'No se pudo insertar la firma en el PDF.',
      file: 'PDF seleccionado',
      change: 'Cambiar PDF',
      mode: 'Tipo de firma',
      drawMode: 'Dibujar firma',
      uploadMode: 'Subir imagen',
      padLabel: 'Pad de firma',
      padHelp: 'Firma con el ratón, lápiz o dedo. El fondo será transparente.',
      clear: 'Limpiar firma',
      image: 'Imagen de firma',
      imageHelp: 'PNG o JPG con fondo transparente o blanco.',
      page: 'Página',
      size: 'Tamaño',
      opacity: 'Opacidad',
      position: 'Posición',
      positionHelp: 'Arrastra la firma sobre la hoja para ajustar la posición.',
      generate: 'Generar PDF firmado',
      generating: 'Insertando firma…',
      download: 'Descargar PDF firmado',
      ready: 'PDF firmado correctamente. Se ha abierto la vista previa.',
      previewTitle: 'Vista previa del PDF firmado',
      previewDesc: 'Revisa la copia firmada antes de descargarla.',
      close: 'Cerrar',
      open: 'Abrir en pestaña',
      noPreview: 'La firma aparecerá aquí al dibujarla o subirla.',
    },
    en: {
      title: 'Visual PDF signature',
      intro: 'Draw a signature or upload an image, choose the page, place it and download a signed copy.',
      warning: 'Notice: this tool adds a visual signature. It does not create a cryptographic digital signature or validate signer identity.',
      drop: 'Drag a PDF here',
      active: 'Drop the PDF',
      subtitle: 'Drop the file or click to select it',
      help: 'PDF only · local processing',
      invalid: 'Select a valid PDF.',
      invalidSignature: 'Draw a signature or upload a PNG/JPG signature image.',
      unsupportedImage: 'Upload a valid PNG or JPG image.',
      error: 'The signature could not be inserted into the PDF.',
      file: 'Selected PDF',
      change: 'Change PDF',
      mode: 'Signature type',
      drawMode: 'Draw signature',
      uploadMode: 'Upload image',
      padLabel: 'Signature pad',
      padHelp: 'Sign with mouse, stylus or finger. The background will be transparent.',
      clear: 'Clear signature',
      image: 'Signature image',
      imageHelp: 'PNG or JPG with a transparent or white background.',
      page: 'Page',
      size: 'Size',
      opacity: 'Opacity',
      position: 'Position',
      positionHelp: 'Drag the signature on the sheet to adjust its position.',
      generate: 'Generate signed PDF',
      generating: 'Inserting signature…',
      download: 'Download signed PDF',
      ready: 'PDF signed successfully. The preview has opened.',
      previewTitle: 'Signed PDF preview',
      previewDesc: 'Review the signed copy before downloading it.',
      close: 'Close',
      open: 'Open in tab',
      noPreview: 'The signature will appear here after drawing or uploading it.',
    },
  } as const;

  let file: File | null = null;
  let pageCount = 0;
  let pageWidths: number[] = [];
  let pageHeights: number[] = [];
  let selectedPage = 1;
  let signatureMode: SignatureMode = 'draw';
  let signatureFile: File | null = null;
  let uploadedSignatureBuffer: ArrayBuffer | null = null;
  let uploadedSignatureUrl = '';
  let drawnSignatureUrl = '';
  let hasDrawing = false;
  let signatureWidthPercent = 32;
  let opacity = 1;
  let xPercent = 50;
  let yPercent = 78;
  let isGenerating = false;
  let statusMessage = '';
  let errorMessage = '';
  let previewUrl = '';
  let isPreviewOpen = false;
  let canvasElement: HTMLCanvasElement;
  let canvasContext: CanvasRenderingContext2D | null = null;
  let isDrawing = false;
  let isDraggingSignature = false;
  let previewElement: HTMLDivElement;

  $: t = copy[lang] ?? copy.es;
  $: pageOptions = Array.from({ length: pageCount }, (_, index) => index + 1);
  $: currentPageWidth = pageWidths[selectedPage - 1] || 595;
  $: currentPageHeight = pageHeights[selectedPage - 1] || 842;
  $: previewAspect = `${currentPageWidth} / ${currentPageHeight}`;
  $: signaturePreviewUrl = signatureMode === 'upload' ? uploadedSignatureUrl : drawnSignatureUrl;
  $: canGenerate = Boolean(file && signaturePreviewUrl) && !isGenerating;
  $: downloadName = `${getPdfBaseFilename(file, lang === 'en' ? 'signed-pdf' : 'pdf-firmado')}-firmado.pdf`;
  $: signatureStyle = `left:${xPercent}%;top:${yPercent}%;width:${signatureWidthPercent}%;opacity:${opacity};`;

  onMount(() => {
    setupCanvas();
  });

  async function addFiles(files: File[]) {
    const selectedFile = files[0];
    if (!selectedFile) return;
    clearResult();
    errorMessage = '';
    statusMessage = '';

    try {
      const pdf = await PDFDocument.load(await selectedFile.arrayBuffer(), { ignoreEncryption: false });
      file = selectedFile;
      pageCount = pdf.getPageCount();
      pageWidths = pdf.getPages().map((page) => page.getSize().width);
      pageHeights = pdf.getPages().map((page) => page.getSize().height);
      selectedPage = 1;
    } catch (error) {
      file = null;
      pageCount = 0;
      pageWidths = [];
      pageHeights = [];
      errorMessage = getFriendlyPdfError(error, t.invalid);
    }
  }

  function handleInvalidFiles() {
    errorMessage = t.invalid;
  }

  function setupCanvas() {
    if (!canvasElement) return;
    const ratio = window.devicePixelRatio || 1;
    const width = 760;
    const height = 250;
    canvasElement.width = width * ratio;
    canvasElement.height = height * ratio;
    canvasElement.style.width = '100%';
    canvasElement.style.height = '210px';
    canvasContext = canvasElement.getContext('2d');
    canvasContext?.scale(ratio, ratio);
    if (canvasContext) {
      canvasContext.lineWidth = 4;
      canvasContext.lineCap = 'round';
      canvasContext.lineJoin = 'round';
      canvasContext.strokeStyle = '#0f172a';
    }
  }

  function getCanvasPoint(event: PointerEvent) {
    const rect = canvasElement.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 760,
      y: ((event.clientY - rect.top) / rect.height) * 250,
    };
  }

  function startDrawing(event: PointerEvent) {
    if (!canvasContext) setupCanvas();
    if (!canvasContext) return;
    signatureMode = 'draw';
    isDrawing = true;
    hasDrawing = true;
    canvasElement.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    canvasContext.beginPath();
    canvasContext.moveTo(point.x, point.y);
  }

  function draw(event: PointerEvent) {
    if (!isDrawing || !canvasContext) return;
    const point = getCanvasPoint(event);
    canvasContext.lineTo(point.x, point.y);
    canvasContext.stroke();
    drawnSignatureUrl = canvasElement.toDataURL('image/png');
  }

  function stopDrawing(event: PointerEvent) {
    if (!isDrawing) return;
    isDrawing = false;
    canvasElement.releasePointerCapture(event.pointerId);
    drawnSignatureUrl = canvasElement.toDataURL('image/png');
  }

  function clearSignaturePad() {
    if (!canvasElement || !canvasContext) return;
    canvasContext.clearRect(0, 0, 760, 250);
    hasDrawing = false;
    drawnSignatureUrl = '';
  }

  async function handleSignatureImage(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const image = input.files?.[0];
    input.value = '';
    if (!image) return;

    const lowerName = image.name.toLowerCase();
    const isSupported = image.type === 'image/png' || image.type === 'image/jpeg' || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg');
    if (!isSupported) {
      errorMessage = t.unsupportedImage;
      return;
    }

    if (uploadedSignatureUrl) URL.revokeObjectURL(uploadedSignatureUrl);
    signatureMode = 'upload';
    signatureFile = image;
    uploadedSignatureBuffer = await image.arrayBuffer();
    uploadedSignatureUrl = URL.createObjectURL(image);
    errorMessage = '';
  }

  function startSignatureDrag(event: PointerEvent) {
    if (!previewElement) return;
    isDraggingSignature = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    updateSignaturePosition(event);
  }

  function dragSignature(event: PointerEvent) {
    if (!isDraggingSignature) return;
    updateSignaturePosition(event);
  }

  function stopSignatureDrag(event: PointerEvent) {
    if (!isDraggingSignature) return;
    isDraggingSignature = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function updateSignaturePosition(event: PointerEvent) {
    const rect = previewElement.getBoundingClientRect();
    xPercent = clamp(((event.clientX - rect.left) / rect.width) * 100, 4, 96);
    yPercent = clamp(((event.clientY - rect.top) / rect.height) * 100, 4, 96);
  }

  async function generateSignedPdf() {
    if (!file) {
      errorMessage = t.invalid;
      return;
    }
    if (!signaturePreviewUrl) {
      errorMessage = t.invalidSignature;
      return;
    }

    isGenerating = true;
    errorMessage = '';
    statusMessage = '';
    clearResult();

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
      const pages = pdf.getPages();
      const page = pages[selectedPage - 1];
      if (!page) throw new Error('Invalid page');

      const signatureBytes = await getSignatureBytes();
      const signatureImage = await embedSignatureImage(pdf, signatureBytes);
      const { width, height } = page.getSize();
      const drawWidth = width * (signatureWidthPercent / 100);
      const drawHeight = drawWidth * (signatureImage.height / signatureImage.width);
      const x = clamp((width * xPercent) / 100 - drawWidth / 2, 0, width - drawWidth);
      const y = clamp(height - (height * yPercent) / 100 - drawHeight / 2, 0, height - drawHeight);

      page.drawImage(signatureImage, { x, y, width: drawWidth, height: drawHeight, opacity });
      await yieldToBrowser();

      previewUrl = createPdfObjectUrl(await pdf.save({ useObjectStreams: true }));
      isPreviewOpen = true;
      statusMessage = t.ready;
    } catch (error) {
      errorMessage = getFriendlyPdfError(error, t.error);
    } finally {
      isGenerating = false;
    }
  }

  async function getSignatureBytes() {
    if (signatureMode === 'upload' && uploadedSignatureBuffer) return uploadedSignatureBuffer;
    if (!hasDrawing || !drawnSignatureUrl) throw new Error('Missing signature');
    return await fetch(drawnSignatureUrl).then((response) => response.arrayBuffer());
  }

  async function embedSignatureImage(pdf: PDFDocument, bytes: ArrayBuffer) {
    const isJpg = signatureMode === 'upload' && (signatureFile?.type === 'image/jpeg' || /\.jpe?g$/i.test(signatureFile?.name || ''));
    return isJpg ? pdf.embedJpg(bytes) : pdf.embedPng(bytes);
  }

  function clearFile() {
    file = null;
    pageCount = 0;
    pageWidths = [];
    pageHeights = [];
    selectedPage = 1;
    errorMessage = '';
    statusMessage = '';
    clearResult();
  }

  function clearResult() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    isPreviewOpen = false;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  $: if (signatureMode === 'draw' && !canvasContext && canvasElement) {
    void tick().then(setupCanvas);
  }

  onDestroy(() => {
    clearResult();
    if (uploadedSignatureUrl) URL.revokeObjectURL(uploadedSignatureUrl);
  });
</script>

<section class="sign-tool" aria-labelledby="sign-title">
  <header class="sign-tool__header">
    <div>
      <span>FácilPDF</span>
      <h2 id="sign-title">{t.title}</h2>
      <p>{t.intro}</p>
    </div>
    <strong aria-hidden="true">✍️</strong>
  </header>

  <p class="sign-tool__warning" role="note">{t.warning}</p>

  <PdfDropzone title={t.drop} activeTitle={t.active} subtitle={t.subtitle} help={t.help} onFiles={addFiles} onInvalidFiles={handleInvalidFiles} />

  {#if errorMessage}<p class="sign-tool__message sign-tool__message--error" role="alert">{errorMessage}</p>{/if}
  {#if statusMessage}<p class="sign-tool__message sign-tool__message--success" role="status">{statusMessage}</p>{/if}

  {#if file}
    <div class="sign-tool__panel">
      <aside>
        <span>{t.file}</span>
        <strong>{file.name}</strong>
        <small>{formatFileSize(file.size)} · {pageCount} páginas</small>
        <button type="button" on:click={clearFile}>{t.change}</button>

        <label>
          <span>{t.page}</span>
          <select bind:value={selectedPage}>
            {#each pageOptions as page}
              <option value={page}>{page}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>{t.size}: {signatureWidthPercent}%</span>
          <input bind:value={signatureWidthPercent} type="range" min="8" max="75" />
        </label>
        <label>
          <span>{t.opacity}: {Math.round(opacity * 100)}%</span>
          <input bind:value={opacity} type="range" min="0.15" max="1" step="0.05" />
        </label>
      </aside>

      <div class="sign-tool__workspace">
        <div class="sign-tool__modes" role="group" aria-label={t.mode}>
          <button type="button" class:active={signatureMode === 'draw'} on:click={() => (signatureMode = 'draw')}>{t.drawMode}</button>
          <button type="button" class:active={signatureMode === 'upload'} on:click={() => (signatureMode = 'upload')}>{t.uploadMode}</button>
        </div>

        {#if signatureMode === 'draw'}
          <div class="sign-tool__signature-card">
            <div class="sign-tool__signature-head">
              <div><strong>{t.padLabel}</strong><small>{t.padHelp}</small></div>
              <button type="button" on:click={clearSignaturePad}>{t.clear}</button>
            </div>
            <canvas
              bind:this={canvasElement}
              class="sign-tool__canvas"
              aria-label={t.padLabel}
              on:pointerdown={startDrawing}
              on:pointermove={draw}
              on:pointerup={stopDrawing}
              on:pointercancel={stopDrawing}
            ></canvas>
          </div>
        {:else}
          <label class="sign-tool__upload">
            <span>{t.image}</span>
            <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" on:change={handleSignatureImage} />
            <small>{signatureFile ? signatureFile.name : t.imageHelp}</small>
          </label>
        {/if}

        <div class="sign-tool__position-head">
          <div><strong>{t.position}</strong><small>{t.positionHelp}</small></div>
          <output>{Math.round(xPercent)}%, {Math.round(yPercent)}%</output>
        </div>

        <div class="sign-tool__page-preview" bind:this={previewElement} style={`aspect-ratio:${previewAspect};`}>
          <div class="sign-tool__page-lines" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
          {#if signaturePreviewUrl}
            <img
              class="sign-tool__signature-preview"
              style={signatureStyle}
              src={signaturePreviewUrl}
              alt=""
              draggable="false"
              on:pointerdown={startSignatureDrag}
              on:pointermove={dragSignature}
              on:pointerup={stopSignatureDrag}
              on:pointercancel={stopSignatureDrag}
            />
          {:else}
            <p>{t.noPreview}</p>
          {/if}
        </div>

        <div class="sign-tool__actions">
          <button class="primary" type="button" disabled={!canGenerate} on:click={generateSignedPdf}>{isGenerating ? t.generating : t.generate}</button>
          <button class="secondary" type="button" disabled={!previewUrl} on:click={() => (isPreviewOpen = true)}>{t.download}</button>
        </div>
      </div>
    </div>
  {/if}
</section>

<PdfResultModal open={isPreviewOpen && Boolean(previewUrl)} pdfUrl={previewUrl} filename={downloadName} title={t.previewTitle} description={t.previewDesc} downloadLabel={t.download} closeLabel={t.close} openLabel={t.open} on:close={() => (isPreviewOpen = false)} />

<style>
  .sign-tool{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 30px 90px rgba(15,23,42,.11)}
  .sign-tool__header{display:flex;align-items:center;justify-content:space-between;gap:18px}.sign-tool__header h2{margin:0;font-size:clamp(1.6rem,3vw,2.3rem);letter-spacing:-.04em}.sign-tool__header p{margin:.45rem 0 0;color:#64748b}.sign-tool__header span{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:.78rem;font-weight:950}.sign-tool__header>strong{display:grid;width:96px;height:96px;place-items:center;border-radius:24px;background:#fff1f2;font-size:2.8rem;box-shadow:0 20px 48px rgba(15,23,42,.12);transform:rotate(-7deg)}
  .sign-tool__warning{margin:0;padding:14px 16px;border:1px solid #fed7aa;border-radius:18px;background:#fff7ed;color:#9a3412;font-weight:850}.sign-tool__message{margin:0;padding:13px 15px;border-radius:16px;background:#f8fafc;font-weight:850}.sign-tool__message--error{background:#fff1f2;color:#991b1b}.sign-tool__message--success{background:#ecfdf5;color:#166534}
  .sign-tool__panel{display:grid;grid-template-columns:300px 1fr;gap:18px;align-items:start}.sign-tool aside,.sign-tool__workspace{border:1px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 18px 48px rgba(15,23,42,.07)}.sign-tool aside{display:grid;gap:12px;padding:18px}.sign-tool aside strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sign-tool aside span,.sign-tool label span{color:#475569;font-size:.86rem;font-weight:900}.sign-tool small{color:#64748b}.sign-tool label{display:grid;gap:8px}.sign-tool input,.sign-tool select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:16px;background:#fff;color:#0f172a;font:inherit;font-weight:750}.sign-tool select{min-height:48px;padding:12px 14px}.sign-tool input[type='range']{accent-color:#ef4444}.sign-tool button{min-height:46px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-weight:950}.sign-tool button:disabled{cursor:not-allowed;opacity:.45}.sign-tool aside button,.sign-tool .secondary{background:#e2e8f0;color:#0f172a}.sign-tool .primary{background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff}
  .sign-tool__workspace{display:grid;gap:16px;padding:18px}.sign-tool__modes{display:flex;gap:10px;flex-wrap:wrap}.sign-tool__modes button{padding:0 18px;background:#f1f5f9;color:#334155}.sign-tool__modes button.active{background:#0f172a;color:#fff}.sign-tool__signature-card,.sign-tool__upload{display:grid;gap:12px;padding:14px;border:1px solid #e2e8f0;border-radius:20px;background:#f8fafc}.sign-tool__signature-head,.sign-tool__position-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.sign-tool__signature-head div,.sign-tool__position-head div{display:grid;gap:2px}.sign-tool__signature-head button{min-height:38px;padding:0 14px;background:#fee2e2;color:#991b1b}.sign-tool__canvas{display:block;width:100%;height:210px;border:1px dashed #94a3b8;border-radius:18px;background:#fff;touch-action:none;cursor:crosshair}.sign-tool__upload input{min-height:50px;padding:12px;border-style:dashed;background:#fff}.sign-tool__position-head output{padding:8px 11px;border-radius:999px;background:#f1f5f9;color:#334155;font-weight:900}.sign-tool__page-preview{position:relative;isolation:isolate;width:min(100%,520px);max-height:640px;margin-inline:auto;overflow:hidden;border:1px solid #cbd5e1;border-radius:18px;background:#fff;box-shadow:0 18px 45px rgba(15,23,42,.12)}.sign-tool__page-lines{position:absolute;inset:8%;display:grid;align-content:start;gap:12px}.sign-tool__page-lines span{height:10px;border-radius:999px;background:#e2e8f0}.sign-tool__page-lines span:nth-child(2){width:74%}.sign-tool__page-lines span:nth-child(3){width:88%}.sign-tool__page-lines span:nth-child(4){width:62%}.sign-tool__page-lines span:nth-child(5){width:82%}.sign-tool__page-preview p{position:absolute;left:50%;top:50%;width:min(80%,22rem);margin:0;transform:translate(-50%,-50%);color:#64748b;font-weight:850;text-align:center}.sign-tool__signature-preview{position:absolute;z-index:3;max-width:90%;height:auto;transform:translate(-50%,-50%);touch-action:none;cursor:grab;user-select:none}.sign-tool__signature-preview:active{cursor:grabbing}.sign-tool__actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:900px){.sign-tool__header,.sign-tool__panel{grid-template-columns:1fr;display:grid}.sign-tool__header>strong{width:82px;height:82px}.sign-tool__actions{grid-template-columns:1fr}}
</style>
