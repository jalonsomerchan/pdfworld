<script lang="ts">
  import { onDestroy } from 'svelte';
  import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { createPdfObjectUrl, formatFileSize, getFriendlyPdfError, getPdfBaseFilename, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';
  type Position = 'center' | 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  type FontChoice = 'helvetica' | 'helvetica-bold' | 'times' | 'courier';
  type WatermarkMode = 'single' | 'repeat';

  export let lang: Lang = 'es';

  const copy = {
    es: {
      title: 'Configura la marca de agua', intro: 'Añade texto visible a todas o algunas páginas sin subir el PDF.', drop: 'Arrastra un PDF aquí', active: 'Suelta el PDF', subtitle: 'Suelta el archivo o pulsa para seleccionarlo', help: 'Solo PDF · procesamiento local', text: 'Texto', placeholder: 'CONFIDENCIAL', size: 'Tamaño', opacity: 'Opacidad', rotation: 'Rotación', position: 'Posición', pages: 'Páginas', pagesHelp: 'Vacío para todas. Ejemplo: 1,3-5,8', allPages: 'Todas las páginas', selectedPages: 'Páginas seleccionadas', generate: 'Generar PDF con marca de agua', generating: 'Generando y abriendo vista previa…', download: 'Descargar PDF', ready: 'PDF generado correctamente. Se ha abierto el modal de vista previa.', invalid: 'Selecciona un PDF válido.', missingText: 'Escribe el texto de la marca de agua.', invalidPages: 'No hay páginas válidas para ese rango.', error: 'No se pudo añadir la marca de agua.', file: 'PDF seleccionado', change: 'Cambiar PDF', preview: 'Vista previa con marca de agua', livePreview: 'Previsualización rápida', previewDesc: 'Comprueba el resultado antes de descargar.', close: 'Cerrar', open: 'Abrir en pestaña', color: 'Color', font: 'Fuente', mode: 'Modo', repeat: 'Repetida', single: 'Única', gap: 'Separación', uppercase: 'Mayúsculas', outline: 'Sello con borde', showPreview: 'El resultado real se abrirá en un modal al generar el PDF.', positions: { center: 'Centro', 'top-left': 'Arriba izquierda', 'top-center': 'Arriba centro', 'top-right': 'Arriba derecha', 'middle-left': 'Centro izquierda', 'middle-right': 'Centro derecha', 'bottom-left': 'Abajo izquierda', 'bottom-center': 'Abajo centro', 'bottom-right': 'Abajo derecha' }, fonts: { helvetica: 'Helvetica', 'helvetica-bold': 'Helvetica negrita', times: 'Times', courier: 'Courier' } },
    en: {
      title: 'Configure the watermark', intro: 'Add visible text to all or selected pages without uploading the PDF.', drop: 'Drag a PDF here', active: 'Drop the PDF', subtitle: 'Drop the file or click to select it', help: 'PDF only · local processing', text: 'Text', placeholder: 'CONFIDENTIAL', size: 'Size', opacity: 'Opacity', rotation: 'Rotation', position: 'Position', pages: 'Pages', pagesHelp: 'Empty for all. Example: 1,3-5,8', allPages: 'All pages', selectedPages: 'Selected pages', generate: 'Generate watermarked PDF', generating: 'Generating and opening preview…', download: 'Download PDF', ready: 'PDF created successfully. The preview modal has opened.', invalid: 'Select a valid PDF.', missingText: 'Type the watermark text.', invalidPages: 'No valid pages found for that range.', error: 'The watermark could not be added.', file: 'Selected PDF', change: 'Change PDF', preview: 'Watermarked PDF preview', livePreview: 'Quick preview', previewDesc: 'Check the result before downloading.', close: 'Close', open: 'Open in tab', color: 'Color', font: 'Font', mode: 'Mode', repeat: 'Repeated', single: 'Single', gap: 'Spacing', uppercase: 'Uppercase', outline: 'Stamp border', showPreview: 'The real result will open in a modal when the PDF is generated.', positions: { center: 'Center', 'top-left': 'Top left', 'top-center': 'Top center', 'top-right': 'Top right', 'middle-left': 'Middle left', 'middle-right': 'Middle right', 'bottom-left': 'Bottom left', 'bottom-center': 'Bottom center', 'bottom-right': 'Bottom right' }, fonts: { helvetica: 'Helvetica', 'helvetica-bold': 'Helvetica bold', times: 'Times', courier: 'Courier' } },
  } as const;

  let file: File | null = null;
  let pageCount = 0;
  let watermarkText = 'CONFIDENCIAL';
  let fontSize = 54;
  let opacity = 0.22;
  let rotation = -35;
  let position: Position = 'center';
  let pageRanges = '';
  let color = '#334155';
  let fontChoice: FontChoice = 'helvetica-bold';
  let mode: WatermarkMode = 'single';
  let gap = 180;
  let uppercase = false;
  let outline = false;
  let isGenerating = false;
  let statusMessage = '';
  let errorMessage = '';
  let previewUrl = '';
  let isPreviewOpen = false;

  const positions: Position[] = ['center', 'top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'];
  const fontChoices: FontChoice[] = ['helvetica', 'helvetica-bold', 'times', 'courier'];

  $: t = copy[lang] ?? copy.es;
  $: selectedPages = parsePageSelection(pageRanges, pageCount);
  $: displayText = uppercase ? watermarkText.trim().toUpperCase() : watermarkText.trim();
  $: affectedLabel = pageRanges.trim() ? `${t.selectedPages}: ${selectedPages.map((page) => page + 1).join(', ') || '—'}` : t.allPages;
  $: canGenerate = Boolean(file && displayText) && !isGenerating;
  $: downloadName = `${getPdfBaseFilename(file, lang === 'en' ? 'watermarked-pdf' : 'pdf-marca-agua')}-marca-de-agua.pdf`;
  $: previewStyle = `color:${color};opacity:${opacity};font-size:${Math.max(16, Math.min(42, fontSize * 0.45))}px;transform:translate(-50%,-50%) rotate(${rotation}deg);font-family:${previewFontFamily(fontChoice)};font-weight:${fontChoice === 'helvetica-bold' ? 900 : 700};`;
  $: repeatedStyle = `color:${color};opacity:${opacity};font-size:${Math.max(12, Math.min(26, fontSize * 0.3))}px;transform:rotate(${rotation}deg);font-family:${previewFontFamily(fontChoice)};font-weight:${fontChoice === 'helvetica-bold' ? 900 : 700};`;

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
    } catch (error) {
      file = null;
      pageCount = 0;
      errorMessage = getFriendlyPdfError(error, t.invalid);
    }
  }

  function handleInvalidFiles() { errorMessage = t.invalid; }

  async function generateWatermark() {
    if (!file) { errorMessage = t.invalid; return; }
    if (!displayText) { errorMessage = t.missingText; return; }
    if (selectedPages.length === 0) { errorMessage = t.invalidPages; return; }

    isGenerating = true;
    errorMessage = '';
    statusMessage = '';
    clearResult();

    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
      const font = await pdf.embedFont(getStandardFont(fontChoice));
      const pages = pdf.getPages();
      const textColor = hexToRgb(color);

      for (const pageIndex of selectedPages) {
        const page = pages[pageIndex];
        if (!page) continue;
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(displayText, fontSize);
        const textHeight = font.heightAtSize(fontSize, { descender: false });

        if (mode === 'repeat') {
          for (let y = gap * -0.5; y < height + gap; y += gap) {
            for (let x = gap * -0.5; x < width + gap; x += gap) {
              drawWatermarkText(page, displayText, x, y, font, textColor);
            }
          }
        } else {
          const coords = getCoordinates(position, width, height, textWidth, textHeight);
          drawWatermarkText(page, displayText, coords.x, coords.y, font, textColor);
        }
        await yieldToBrowser();
      }

      previewUrl = createPdfObjectUrl(await pdf.save({ useObjectStreams: true }));
      isPreviewOpen = true;
      statusMessage = t.ready;
    } catch (error) {
      errorMessage = getFriendlyPdfError(error, t.error);
    } finally {
      isGenerating = false;
    }
  }

  function drawWatermarkText(page: any, text: string, x: number, y: number, font: any, textColor: ReturnType<typeof hexToRgb>) {
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(textColor.r, textColor.g, textColor.b), opacity, rotate: degrees(rotation) });
  }

  function parsePageSelection(value: string, total: number) {
    if (total <= 0) return [];
    if (!value.trim()) return Array.from({ length: total }, (_, index) => index);
    const selected = new Set<number>();
    for (const token of value.split(',')) {
      const part = token.trim();
      const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        const from = Math.min(Number(range[1]), Number(range[2]));
        const to = Math.max(Number(range[1]), Number(range[2]));
        for (let page = from; page <= to; page += 1) addPage(selected, page, total);
      } else if (/^\d+$/.test(part)) addPage(selected, Number(part), total);
    }
    return [...selected].sort((a, b) => a - b);
  }

  function addPage(selected: Set<number>, page: number, total: number) { if (page >= 1 && page <= total) selected.add(page - 1); }

  function getCoordinates(target: Position, width: number, height: number, textWidth: number, textHeight: number) {
    const margin = Math.max(28, fontSize * 0.75);
    const centerX = (width - textWidth) / 2;
    const centerY = (height - textHeight) / 2;
    const map = {
      center: { x: centerX, y: centerY },
      'top-left': { x: margin, y: height - margin - textHeight },
      'top-center': { x: centerX, y: height - margin - textHeight },
      'top-right': { x: width - margin - textWidth, y: height - margin - textHeight },
      'middle-left': { x: margin, y: centerY },
      'middle-right': { x: width - margin - textWidth, y: centerY },
      'bottom-left': { x: margin, y: margin },
      'bottom-center': { x: centerX, y: margin },
      'bottom-right': { x: width - margin - textWidth, y: margin },
    } satisfies Record<Position, { x: number; y: number }>;
    return map[target] ?? map.center;
  }

  function getStandardFont(font: FontChoice) {
    if (font === 'times') return StandardFonts.TimesRoman;
    if (font === 'courier') return StandardFonts.CourierBold;
    if (font === 'helvetica') return StandardFonts.Helvetica;
    return StandardFonts.HelveticaBold;
  }

  function previewFontFamily(font: FontChoice) {
    if (font === 'times') return 'Georgia, Times, serif';
    if (font === 'courier') return 'Courier New, monospace';
    return 'Arial, Helvetica, sans-serif';
  }

  function hexToRgb(hex: string) {
    const value = hex.replace('#', '').padEnd(6, '0').slice(0, 6);
    return { r: parseInt(value.slice(0, 2), 16) / 255, g: parseInt(value.slice(2, 4), 16) / 255, b: parseInt(value.slice(4, 6), 16) / 255 };
  }

  function clearFile() { file = null; pageCount = 0; errorMessage = ''; statusMessage = ''; clearResult(); }
  function clearResult() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; isPreviewOpen = false; }
  onDestroy(clearResult);
</script>

<section class="watermark-tool" aria-labelledby="watermark-title">
  <header class="watermark-tool__header">
    <div><span>FácilPDF</span><h2 id="watermark-title">{t.title}</h2><p>{t.intro}</p></div>
    <strong aria-hidden="true">PDF</strong>
  </header>

  <PdfDropzone title={t.drop} activeTitle={t.active} subtitle={t.subtitle} help={t.help} onFiles={addFiles} onInvalidFiles={handleInvalidFiles} />

  {#if errorMessage}<p class="watermark-tool__message watermark-tool__message--error" role="alert">{errorMessage}</p>{/if}
  {#if statusMessage}<p class="watermark-tool__message watermark-tool__message--success" role="status">{statusMessage}</p>{/if}

  {#if file}
    <div class="watermark-tool__panel">
      <aside>
        <span>{t.file}</span><strong>{file.name}</strong><small>{formatFileSize(file.size)} · {pageCount} páginas</small>
        <button type="button" on:click={clearFile}>{t.change}</button>
        <div class="watermark-tool__preview" aria-label={t.livePreview}>
          <div class="watermark-tool__preview-head"><strong>{t.livePreview}</strong><small>{t.showPreview}</small></div>
          <div class="watermark-tool__mock-page">
            <span></span><span></span><span></span><span></span>
            {#if mode === 'repeat'}
              <div class="watermark-tool__repeat-preview">
                {#each Array(12) as _}
                  <b style={repeatedStyle}>{displayText || t.placeholder}</b>
                {/each}
              </div>
            {:else}
              <b class:watermark-tool__stamp-outline={outline} class={`watermark-tool__stamp-preview watermark-tool__stamp-preview--${position}`} style={previewStyle}>{displayText || t.placeholder}</b>
            {/if}
          </div>
        </div>
      </aside>

      <form on:submit|preventDefault={generateWatermark}>
        <label class="wide"><span>{t.text}</span><input bind:value={watermarkText} type="text" maxlength="120" placeholder={t.placeholder} /></label>
        <label><span>{t.size}: {fontSize}px</span><input bind:value={fontSize} type="range" min="12" max="160" /></label>
        <label><span>{t.opacity}: {Math.round(opacity * 100)}%</span><input bind:value={opacity} type="range" min="0.05" max="1" step="0.05" /></label>
        <label><span>{t.rotation}: {rotation}°</span><input bind:value={rotation} type="range" min="-90" max="90" /></label>
        <label><span>{t.color}</span><input bind:value={color} type="color" /></label>
        <label><span>{t.font}</span><select bind:value={fontChoice}>{#each fontChoices as item}<option value={item}>{t.fonts[item]}</option>{/each}</select></label>
        <label><span>{t.mode}</span><select bind:value={mode}><option value="single">{t.single}</option><option value="repeat">{t.repeat}</option></select></label>
        {#if mode === 'single'}
          <label><span>{t.position}</span><select bind:value={position}>{#each positions as item}<option value={item}>{t.positions[item]}</option>{/each}</select></label>
        {:else}
          <label><span>{t.gap}: {gap}px</span><input bind:value={gap} type="range" min="90" max="320" step="10" /></label>
        {/if}
        <label class="check"><input bind:checked={uppercase} type="checkbox" /><span>{t.uppercase}</span></label>
        <label class="check"><input bind:checked={outline} type="checkbox" /><span>{t.outline}</span></label>
        <label class="wide"><span>{t.pages}</span><input bind:value={pageRanges} type="text" placeholder="1,3-5" /><small>{t.pagesHelp}</small></label>
        <p class="wide summary">{affectedLabel}</p>
        <button class="primary" type="submit" disabled={!canGenerate}>{isGenerating ? t.generating : t.generate}</button>
        <button class="secondary" type="button" disabled={!previewUrl} on:click={() => (isPreviewOpen = true)}>{t.download}</button>
      </form>
    </div>
  {/if}
</section>

<PdfResultModal open={isPreviewOpen && Boolean(previewUrl)} pdfUrl={previewUrl} filename={downloadName} title={t.preview} description={t.previewDesc} downloadLabel={t.download} closeLabel={t.close} openLabel={t.open} on:close={() => (isPreviewOpen = false)} />

<style>
  .watermark-tool{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:linear-gradient(135deg,#fff,#f8fafc);box-shadow:0 30px 90px rgba(15,23,42,.11)}.watermark-tool__header{display:flex;align-items:center;justify-content:space-between;gap:18px}.watermark-tool__header h2{margin:0;font-size:clamp(1.6rem,3vw,2.3rem);letter-spacing:-.04em}.watermark-tool__header p{margin:.45rem 0 0;color:#64748b}.watermark-tool__header span{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:.78rem;font-weight:950}.watermark-tool__header>strong{display:grid;width:96px;height:96px;place-items:center;border:4px solid rgba(185,28,28,.35);border-radius:20px;color:#b91c1c;transform:rotate(-12deg)}.watermark-tool__message{margin:0;padding:13px 15px;border-radius:16px;background:#f8fafc;font-weight:850}.watermark-tool__message--error{background:#fff1f2;color:#991b1b}.watermark-tool__message--success{background:#ecfdf5;color:#166534}.watermark-tool__panel{display:grid;grid-template-columns:320px 1fr;gap:18px;align-items:start}.watermark-tool aside,.watermark-tool form{border:1px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 18px 48px rgba(15,23,42,.07)}.watermark-tool aside{display:grid;gap:10px;padding:18px}.watermark-tool aside strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.watermark-tool aside span,.watermark-tool label span{color:#475569;font-size:.86rem;font-weight:900}.watermark-tool small{color:#64748b}.watermark-tool form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:18px}.watermark-tool label{display:grid;gap:8px}.watermark-tool .wide,.watermark-tool .primary,.watermark-tool .secondary{grid-column:1/-1}.watermark-tool input,.watermark-tool select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:16px;background:#fff;color:#0f172a;font:inherit;font-weight:750}.watermark-tool input[type='text'],.watermark-tool select{min-height:48px;padding:12px 14px}.watermark-tool input[type='range']{accent-color:#ef4444}.watermark-tool input[type='color']{min-height:48px;padding:5px}.watermark-tool .check{display:flex;gap:10px;align-items:center;padding:12px 14px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc}.watermark-tool .check input{width:auto}.watermark-tool button{min-height:46px;border:0;border-radius:999px;cursor:pointer;font:inherit;font-weight:950}.watermark-tool button:disabled{cursor:not-allowed;opacity:.45}.watermark-tool aside button,.watermark-tool .secondary{background:#e2e8f0;color:#0f172a}.watermark-tool .primary{background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff}.watermark-tool .summary{margin:0;padding:12px 14px;border-radius:16px;background:#f8fafc;font-weight:900}.watermark-tool__preview{display:grid;gap:10px;margin-top:8px}.watermark-tool__preview-head{display:grid;gap:2px}.watermark-tool__mock-page{position:relative;isolation:isolate;display:grid;gap:10px;min-height:260px;overflow:hidden;padding:28px 22px;border:1px solid #e2e8f0;border-radius:18px;background:#fff}.watermark-tool__mock-page span{height:10px;border-radius:999px;background:#e2e8f0}.watermark-tool__mock-page span:nth-child(2){width:78%}.watermark-tool__mock-page span:nth-child(3){width:64%}.watermark-tool__mock-page span:nth-child(4){width:86%}.watermark-tool__stamp-preview{position:absolute;left:50%;top:50%;z-index:2;max-width:90%;padding:.2em .35em;white-space:nowrap;text-align:center}.watermark-tool__stamp-outline{border:.14em solid currentColor;border-radius:.28em}.watermark-tool__stamp-preview--top-left{left:22%;top:18%}.watermark-tool__stamp-preview--top-center{left:50%;top:18%}.watermark-tool__stamp-preview--top-right{left:78%;top:18%}.watermark-tool__stamp-preview--middle-left{left:22%;top:50%}.watermark-tool__stamp-preview--middle-right{left:78%;top:50%}.watermark-tool__stamp-preview--bottom-left{left:22%;top:82%}.watermark-tool__stamp-preview--bottom-center{left:50%;top:82%}.watermark-tool__stamp-preview--bottom-right{left:78%;top:82%}.watermark-tool__repeat-preview{position:absolute;inset:-14px;z-index:2;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;place-items:center}.watermark-tool__repeat-preview b{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.watermark-tool__mock-page:after{content:'';position:absolute;inset:0;z-index:3;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(248,250,252,.18))}@media (max-width:900px){.watermark-tool__header,.watermark-tool__panel{grid-template-columns:1fr;display:grid}.watermark-tool form{grid-template-columns:1fr}.watermark-tool__header>strong{width:82px;height:82px}}
</style>
