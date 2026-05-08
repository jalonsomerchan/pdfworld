<script lang="ts">
  import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
  import { saveAs } from 'file-saver';

  type Lang = 'es' | 'en';
  type PagePreset = 'a4' | 'a3' | 'a5' | 'letter' | 'legal' | 'custom';
  type Unit = 'mm' | 'px';
  type Orientation = 'portrait' | 'landscape';
  type Density = 'low' | 'medium' | 'high' | 'custom';
  type ImageMode = 'none' | 'placeholder' | 'upload';
  type ImagePlacement = 'text' | 'top' | 'bottom' | 'wrap';
  type ImageScope = 'all' | 'odd' | 'even' | 'custom';

  export let lang: Lang = 'es';

  const l = {
    es: {
      title: 'Generador de PDFs de prueba', intro: 'Crea documentos de ejemplo para probar unir, dividir, comprimir, ordenar o convertir PDF. Todo se genera en tu navegador.',
      presetSmall: '1 página pequeña', presetMedium: '10 páginas', presetLarge: '100 páginas', presetImages: 'Muchas imágenes', presetText: 'Solo texto',
      doc: 'Documento', pages: 'Páginas', titleField: 'Título', author: 'Autor', subject: 'Asunto', keywords: 'Palabras clave', numbering: 'Añadir numeración de páginas',
      page: 'Página', pageSize: 'Tamaño de página', orientation: 'Orientación', portrait: 'Vertical', landscape: 'Horizontal', customSize: 'Tamaño personalizado', width: 'Ancho', height: 'Alto', unit: 'Unidad',
      content: 'Contenido', density: 'Densidad de texto', low: 'Poco texto', medium: 'Medio', high: 'Mucho texto', custom: 'Personalizado', wordsPerPage: 'Palabras por página', fontSize: 'Tamaño de fuente', margins: 'Márgenes', marginHelp: 'Márgenes en milímetros.',
      images: 'Imágenes', imageMode: 'Tipo de imagen', noImages: 'Sin imágenes', placeholder: 'Placeholder generado localmente', uploaded: 'Imagen subida por el usuario', imageUpload: 'Subir imagen', imageScope: 'Dónde usar la imagen', allPages: 'Todas las páginas', oddPages: 'Páginas impares', evenPages: 'Páginas pares', customPages: 'Páginas concretas', customPagesHelp: 'Ejemplo: 1-3,5,8', imagePlacement: 'Ubicación del contenido', textOnly: 'Solo texto', top: 'Texto + imagen superior', bottom: 'Texto + imagen inferior', wrap: 'Texto alrededor de imagen',
      summary: 'Resumen antes de generar', estimatedChars: 'Caracteres estimados', estimatedSize: 'Estimación de peso', includesImages: 'Incluye imágenes', warningHeavy: 'Esta configuración puede generar un PDF pesado o tardar más en móviles.',
      generate: 'Generar PDF de prueba', generating: 'Generando PDF…', reset: 'Restablecer configuración', downloadName: 'pdfworld-pdf-prueba', ready: 'PDF generado correctamente.', error: 'No se pudo generar el PDF. Revisa la configuración o reduce páginas/imágenes.',
      invalidPages: 'El número de páginas debe estar entre 1 y 120.', invalidCustomSize: 'El tamaño personalizado debe ser mayor que cero y razonable.', invalidMargins: 'Los márgenes no pueden ocupar toda la página.', invalidFont: 'El tamaño de fuente debe estar entre 6 y 48.', invalidImage: 'La imagen debe ser JPG, PNG o WEBP y pesar menos de 6 MB.', invalidRanges: 'Las páginas de imagen no son válidas. Usa rangos como 1-3,5,8.', chooseImage: 'Selecciona una imagen para usar el modo de imagen subida.',
      privacy: 'Procesamiento local: no se sube ningún archivo a servidores.',
    },
    en: {
      title: 'Test PDF generator', intro: 'Create sample documents to test merge, split, compress, reorder or convert PDF tools. Everything is generated in your browser.',
      presetSmall: 'Small 1-page PDF', presetMedium: '10 pages', presetLarge: '100 pages', presetImages: 'Many images', presetText: 'Text only',
      doc: 'Document', pages: 'Pages', titleField: 'Title', author: 'Author', subject: 'Subject', keywords: 'Keywords', numbering: 'Add page numbers',
      page: 'Page', pageSize: 'Page size', orientation: 'Orientation', portrait: 'Portrait', landscape: 'Landscape', customSize: 'Custom size', width: 'Width', height: 'Height', unit: 'Unit',
      content: 'Content', density: 'Text density', low: 'Light text', medium: 'Medium', high: 'Heavy text', custom: 'Custom', wordsPerPage: 'Words per page', fontSize: 'Font size', margins: 'Margins', marginHelp: 'Margins in millimeters.',
      images: 'Images', imageMode: 'Image type', noImages: 'No images', placeholder: 'Locally generated placeholder', uploaded: 'User uploaded image', imageUpload: 'Upload image', imageScope: 'Where to use image', allPages: 'All pages', oddPages: 'Odd pages', evenPages: 'Even pages', customPages: 'Specific pages', customPagesHelp: 'Example: 1-3,5,8', imagePlacement: 'Content layout', textOnly: 'Text only', top: 'Text + top image', bottom: 'Text + bottom image', wrap: 'Text around image',
      summary: 'Summary before generation', estimatedChars: 'Estimated characters', estimatedSize: 'Estimated size', includesImages: 'Includes images', warningHeavy: 'This configuration may create a heavy PDF or take longer on mobile.',
      generate: 'Generate test PDF', generating: 'Generating PDF…', reset: 'Reset configuration', downloadName: 'pdfworld-test-pdf', ready: 'PDF generated successfully.', error: 'The PDF could not be generated. Check settings or reduce pages/images.',
      invalidPages: 'Page count must be between 1 and 120.', invalidCustomSize: 'Custom size must be greater than zero and reasonable.', invalidMargins: 'Margins cannot take the whole page.', invalidFont: 'Font size must be between 6 and 48.', invalidImage: 'Image must be JPG, PNG or WEBP and smaller than 6 MB.', invalidRanges: 'Image pages are invalid. Use ranges such as 1-3,5,8.', chooseImage: 'Select an image to use uploaded image mode.',
      privacy: 'Local processing: no files are uploaded to servers.',
    },
  } as const;

  const sizes = {
    a4: [595.28, 841.89],
    a3: [841.89, 1190.55],
    a5: [419.53, 595.28],
    letter: [612, 792],
    legal: [612, 1008],
  } as const;

  const lorem = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

  let pageCount = 10;
  let documentTitle = 'PDF de prueba FácilPDF';
  let author = 'FácilPDF';
  let subject = 'Documento de prueba generado localmente';
  let keywords = 'pdf, prueba, ejemplo, facilpdf';
  let addPageNumbers = true;
  let pagePreset: PagePreset = 'a4';
  let orientation: Orientation = 'portrait';
  let customWidth = 210;
  let customHeight = 297;
  let customUnit: Unit = 'mm';
  let density: Density = 'medium';
  let customWordsPerPage = 250;
  let fontSize = 12;
  let marginMm = 18;
  let imageMode: ImageMode = 'none';
  let imagePlacement: ImagePlacement = 'text';
  let imageScope: ImageScope = 'all';
  let imagePages = '1-3';
  let uploadedImage: File | null = null;
  let uploadedImageName = '';
  let isGenerating = false;
  let errorMessage = '';
  let statusMessage = '';

  $: t = l[lang] ?? l.es;
  $: pageSize = getPageSize();
  $: wordsPerPage = density === 'low' ? 80 : density === 'medium' ? 220 : density === 'high' ? 520 : customWordsPerPage;
  $: estimatedCharacters = Math.round(pageCount * wordsPerPage * 6.2);
  $: imagePagesSet = getImagePagesSet();
  $: includesImages = imageMode !== 'none' && imagePlacement !== 'text' && imagePagesSet.size > 0;
  $: estimatedSizeKb = Math.max(8, Math.round(pageCount * 5 + estimatedCharacters / 90 + (includesImages ? imagePagesSet.size * 38 : 0)));
  $: isHeavy = pageCount > 60 || estimatedSizeKb > 3500 || (includesImages && imagePagesSet.size > 40);
  $: validationError = validateConfig();

  function getPageSize(): [number, number] {
    let width: number;
    let height: number;

    if (pagePreset === 'custom') {
      const factor = customUnit === 'mm' ? 72 / 25.4 : 72 / 96;
      width = customWidth * factor;
      height = customHeight * factor;
    } else {
      [width, height] = sizes[pagePreset];
    }

    return orientation === 'landscape' ? [Math.max(width, height), Math.min(width, height)] : [Math.min(width, height), Math.max(width, height)];
  }

  function validateConfig() {
    const [width, height] = pageSize;
    const margin = mmToPt(marginMm);

    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 120) return t.invalidPages;
    if (pagePreset === 'custom' && (customWidth <= 0 || customHeight <= 0 || width < 72 || height < 72 || width > 3000 || height > 3000)) return t.invalidCustomSize;
    if (margin < 0 || margin * 2 >= Math.min(width, height) - 36) return t.invalidMargins;
    if (fontSize < 6 || fontSize > 48) return t.invalidFont;
    if (imageMode === 'upload' && !uploadedImage) return t.chooseImage;
    if (imageScope === 'custom' && getImagePagesSet().size === 0 && imageMode !== 'none') return t.invalidRanges;

    return '';
  }

  function applyPreset(preset: 'small' | 'medium' | 'large' | 'images' | 'text') {
    errorMessage = '';
    statusMessage = '';
    if (preset === 'small') {
      pageCount = 1; density = 'low'; imageMode = 'none'; imagePlacement = 'text'; pagePreset = 'a4';
    }
    if (preset === 'medium') {
      pageCount = 10; density = 'medium'; imageMode = 'placeholder'; imagePlacement = 'top'; imageScope = 'odd'; pagePreset = 'a4';
    }
    if (preset === 'large') {
      pageCount = 100; density = 'medium'; imageMode = 'none'; imagePlacement = 'text'; pagePreset = 'a4';
    }
    if (preset === 'images') {
      pageCount = 25; density = 'low'; imageMode = 'placeholder'; imagePlacement = 'bottom'; imageScope = 'all'; pagePreset = 'a4';
    }
    if (preset === 'text') {
      pageCount = 20; density = 'high'; imageMode = 'none'; imagePlacement = 'text'; pagePreset = 'letter';
    }
  }

  function resetConfig() {
    pageCount = 10;
    documentTitle = 'PDF de prueba FácilPDF';
    author = 'FácilPDF';
    subject = 'Documento de prueba generado localmente';
    keywords = 'pdf, prueba, ejemplo, facilpdf';
    addPageNumbers = true;
    pagePreset = 'a4';
    orientation = 'portrait';
    customWidth = 210;
    customHeight = 297;
    customUnit = 'mm';
    density = 'medium';
    customWordsPerPage = 250;
    fontSize = 12;
    marginMm = 18;
    imageMode = 'none';
    imagePlacement = 'text';
    imageScope = 'all';
    imagePages = '1-3';
    uploadedImage = null;
    uploadedImageName = '';
    errorMessage = '';
    statusMessage = '';
  }

  async function handleImageInput(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    errorMessage = '';
    uploadedImage = null;
    uploadedImageName = '';

    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) {
      errorMessage = t.invalidImage;
      input.value = '';
      return;
    }

    uploadedImage = file;
    uploadedImageName = file.name;
    imageMode = 'upload';
  }

  async function generatePdf() {
    errorMessage = validationError;
    statusMessage = '';
    if (errorMessage) return;

    isGenerating = true;
    try {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
      const imageBytes = includesImages ? await getImageBytes() : null;
      const embeddedImage = imageBytes ? await pdf.embedJpg(imageBytes) : null;
      const [width, height] = pageSize;
      const margin = mmToPt(marginMm);
      const bodyText = buildLoremWords(wordsPerPage + 40);

      pdf.setTitle(documentTitle || 'PDF de prueba');
      pdf.setAuthor(author || 'FácilPDF');
      pdf.setSubject(subject || 'Documento de prueba');
      pdf.setKeywords(keywords.split(',').map((item) => item.trim()).filter(Boolean));
      pdf.setCreator('FácilPDF');
      pdf.setProducer('FácilPDF');

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageNumber = pageIndex + 1;
        const page = pdf.addPage([width, height]);
        const hasImage = Boolean(embeddedImage && shouldImageBeUsed(pageNumber));
        const title = `${documentTitle || 'PDF de prueba'} · ${t.page} ${pageNumber}`;
        const titleSize = Math.min(18, fontSize + 5);
        const footerSize = Math.max(8, fontSize - 2);
        let cursorY = height - margin;

        page.drawText(title, { x: margin, y: cursorY - titleSize, size: titleSize, font: boldFont, color: rgb(0.15, 0.17, 0.22) });
        cursorY -= titleSize + 16;

        let imageBox: { x: number; y: number; width: number; height: number } | null = null;
        if (hasImage && embeddedImage) {
          imageBox = getImageBox(width, height, margin, cursorY, embeddedImage.width / embeddedImage.height);
          if (imagePlacement === 'top') {
            drawImage(page, embeddedImage, imageBox);
            cursorY = imageBox.y - 18;
          }
        }

        const words = bodyText.split(' ');
        const text = words.slice(0, wordsPerPage).join(' ');
        drawWrappedText({ page, text, font, fontSize, margin, width, height, startY: cursorY, imageBox: imagePlacement === 'wrap' && hasImage && imageBox ? imageBox : null });

        if (hasImage && embeddedImage && imageBox && imagePlacement === 'bottom') {
          drawImage(page, embeddedImage, imageBox);
        }
        if (hasImage && embeddedImage && imageBox && imagePlacement === 'wrap') {
          drawImage(page, embeddedImage, imageBox);
        }

        drawPageMarkers(page, width, height, margin, pageNumber, addPageNumbers ? `${pageNumber} / ${pageCount}` : '', font, footerSize);
        if (pageIndex % 5 === 0) await yieldToBrowser();
      }

      const bytes = await pdf.save({ useObjectStreams: true });
      const filename = `${t.downloadName}-${pageCount}-paginas.pdf`;
      saveAs(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), filename);
      statusMessage = t.ready;
    } catch {
      errorMessage = t.error;
    } finally {
      isGenerating = false;
    }
  }

  function drawWrappedText(args: { page: any; text: string; font: PDFFont; fontSize: number; margin: number; width: number; height: number; startY: number; imageBox: { x: number; y: number; width: number; height: number } | null }) {
    const { page, text, font, fontSize, margin, width, startY, imageBox } = args;
    const lineHeight = fontSize * 1.35;
    const bottomY = margin + 36;
    let y = startY;
    const words = text.split(/\s+/);
    let line = '';

    for (const word of words) {
      const wrapAround = imageBox && y <= imageBox.y + imageBox.height && y >= imageBox.y - lineHeight;
      const rightEdge = wrapAround ? imageBox.x - 14 : width - margin;
      const x = margin;
      const maxWidth = rightEdge - x;
      const testLine = line ? `${line} ${word}` : word;

      if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth && line) {
        if (y < bottomY) break;
        page.drawText(line, { x, y, size: fontSize, font, color: rgb(0.24, 0.26, 0.32), lineHeight });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line && y >= bottomY) {
      page.drawText(line, { x: margin, y, size: fontSize, font, color: rgb(0.24, 0.26, 0.32), lineHeight });
    }
  }

  function getImageBox(width: number, height: number, margin: number, cursorY: number, ratio: number) {
    if (imagePlacement === 'wrap') {
      const boxWidth = Math.min((width - margin * 2) * 0.34, 180);
      const boxHeight = boxWidth / ratio;
      return { x: width - margin - boxWidth, y: cursorY - boxHeight, width: boxWidth, height: boxHeight };
    }

    const boxWidth = Math.min(width - margin * 2, 360);
    const boxHeight = Math.min(boxWidth / ratio, height * 0.24);
    const x = margin + (width - margin * 2 - boxWidth) / 2;
    const y = imagePlacement === 'bottom' ? margin + 52 : cursorY - boxHeight;
    return { x, y, width: boxWidth, height: boxHeight };
  }

  function drawImage(page: any, image: any, box: { x: number; y: number; width: number; height: number }) {
    page.drawRectangle({ x: box.x - 4, y: box.y - 4, width: box.width + 8, height: box.height + 8, color: rgb(0.95, 0.96, 0.98), borderColor: rgb(0.82, 0.85, 0.9), borderWidth: 1 });
    page.drawImage(image, box);
  }

  function drawPageMarkers(page: any, width: number, height: number, margin: number, pageNumber: number, pageText: string, font: PDFFont, size: number) {
    page.drawRectangle({ x: margin, y: margin, width: 28, height: 12, color: pageNumber % 2 ? rgb(0.93, 0.23, 0.18) : rgb(0.2, 0.35, 0.75) });
    page.drawLine({ start: { x: margin, y: height - margin + 8 }, end: { x: width - margin, y: height - margin + 8 }, thickness: 0.5, color: rgb(0.82, 0.84, 0.88) });
    if (pageText) page.drawText(pageText, { x: width - margin - font.widthOfTextAtSize(pageText, size), y: margin, size, font, color: rgb(0.38, 0.42, 0.5) });
  }

  async function getImageBytes() {
    if (imageMode === 'placeholder') return createPlaceholderImage();
    if (!uploadedImage) throw new Error('No image');
    return imageBlobToJpegBytes(uploadedImage);
  }

  async function createPlaceholderImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 520;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#fee2e2');
    gradient.addColorStop(1, '#dbeafe');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText('FácilPDF', 70, 150);
    ctx.fillStyle = '#334155';
    ctx.font = '36px system-ui, sans-serif';
    ctx.fillText('Imagen de prueba generada localmente', 70, 230);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
    return canvasToJpegBytes(canvas, 0.88);
  }

  async function imageBlobToJpegBytes(blob: Blob) {
    const bitmap = await createImageBitmap(blob);
    const maxSide = 1400;
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('No canvas context');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvasToJpegBytes(canvas, 0.86);
  }

  async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('No jpeg blob');
    return new Uint8Array(await blob.arrayBuffer());
  }

  function getImagePagesSet() {
    const set = new Set<number>();
    if (imageMode === 'none' || imagePlacement === 'text') return set;
    if (imageScope === 'all') for (let i = 1; i <= pageCount; i += 1) set.add(i);
    if (imageScope === 'odd') for (let i = 1; i <= pageCount; i += 2) set.add(i);
    if (imageScope === 'even') for (let i = 2; i <= pageCount; i += 2) set.add(i);
    if (imageScope === 'custom') {
      const parsed = parseRanges(imagePages, pageCount);
      if (!parsed.error) parsed.pages.forEach((page) => set.add(page));
    }
    return set;
  }

  function shouldImageBeUsed(page: number) {
    return imagePagesSet.has(page);
  }

  function parseRanges(input: string, total: number) {
    const pages: number[] = [];
    const value = input.trim();
    if (!value) return { pages, error: 'empty' };
    for (const chunk of value.split(',')) {
      const match = chunk.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) return { pages: [], error: 'format' };
      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);
      if (start < 1 || end < start || end > total) return { pages: [], error: 'range' };
      for (let i = start; i <= end; i += 1) pages.push(i);
    }
    return { pages: [...new Set(pages)], error: '' };
  }

  function buildLoremWords(words: number) {
    const source = lorem.split(' ');
    return Array.from({ length: words }, (_, index) => source[index % source.length]).join(' ');
  }

  function mmToPt(mm: number) {
    return mm * 72 / 25.4;
  }

  function formatPageSize() {
    return `${Math.round(pageSize[0])} × ${Math.round(pageSize[1])} pt`;
  }

  function yieldToBrowser() {
    return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
</script>

<section class="test-pdf" aria-labelledby="test-pdf-title">
  <div class="test-pdf__hero">
    <div>
      <span class="test-pdf__eyebrow">FácilPDF</span>
      <h2 id="test-pdf-title">{t.title}</h2>
      <p>{t.intro}</p>
    </div>
    <div class="test-pdf__summary" aria-live="polite">
      <strong>{pageCount}</strong>
      <span>{t.pages}</span>
      <small>{estimatedCharacters.toLocaleString()} chars · ~{estimatedSizeKb} KB</small>
    </div>
  </div>

  <div class="test-pdf__presets" aria-label="Presets rápidos">
    <button type="button" on:click={() => applyPreset('small')}>{t.presetSmall}</button>
    <button type="button" on:click={() => applyPreset('medium')}>{t.presetMedium}</button>
    <button type="button" on:click={() => applyPreset('large')}>{t.presetLarge}</button>
    <button type="button" on:click={() => applyPreset('images')}>{t.presetImages}</button>
    <button type="button" on:click={() => applyPreset('text')}>{t.presetText}</button>
  </div>

  <div class="test-pdf__grid">
    <fieldset class="test-pdf__panel">
      <legend>{t.doc}</legend>
      <label>{t.pages}<input type="number" min="1" max="120" bind:value={pageCount} /></label>
      <label>{t.titleField}<input bind:value={documentTitle} /></label>
      <label>{t.author}<input bind:value={author} /></label>
      <label>{t.subject}<input bind:value={subject} /></label>
      <label>{t.keywords}<input bind:value={keywords} /></label>
      <label class="test-pdf__check"><input type="checkbox" bind:checked={addPageNumbers} /> {t.numbering}</label>
    </fieldset>

    <fieldset class="test-pdf__panel">
      <legend>{t.page}</legend>
      <label>{t.pageSize}<select bind:value={pagePreset}><option value="a4">A4</option><option value="a3">A3</option><option value="a5">A5</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="custom">{t.customSize}</option></select></label>
      <label>{t.orientation}<select bind:value={orientation}><option value="portrait">{t.portrait}</option><option value="landscape">{t.landscape}</option></select></label>
      {#if pagePreset === 'custom'}
        <div class="test-pdf__inline">
          <label>{t.width}<input type="number" min="1" bind:value={customWidth} /></label>
          <label>{t.height}<input type="number" min="1" bind:value={customHeight} /></label>
          <label>{t.unit}<select bind:value={customUnit}><option value="mm">mm</option><option value="px">px</option></select></label>
        </div>
      {/if}
      <label>{t.margins}<input type="number" min="0" max="80" bind:value={marginMm} /></label>
      <p class="test-pdf__help">{t.marginHelp}</p>
    </fieldset>

    <fieldset class="test-pdf__panel">
      <legend>{t.content}</legend>
      <label>{t.density}<select bind:value={density}><option value="low">{t.low}</option><option value="medium">{t.medium}</option><option value="high">{t.high}</option><option value="custom">{t.custom}</option></select></label>
      {#if density === 'custom'}
        <label>{t.wordsPerPage}<input type="number" min="10" max="1200" bind:value={customWordsPerPage} /></label>
      {/if}
      <label>{t.fontSize}<input type="number" min="6" max="48" bind:value={fontSize} /></label>
    </fieldset>

    <fieldset class="test-pdf__panel">
      <legend>{t.images}</legend>
      <label>{t.imageMode}<select bind:value={imageMode}><option value="none">{t.noImages}</option><option value="placeholder">{t.placeholder}</option><option value="upload">{t.uploaded}</option></select></label>
      {#if imageMode === 'upload'}
        <label>{t.imageUpload}<input type="file" accept="image/jpeg,image/png,image/webp" on:change={handleImageInput} /></label>
        {#if uploadedImageName}<p class="test-pdf__help">{uploadedImageName}</p>{/if}
      {/if}
      {#if imageMode !== 'none'}
        <label>{t.imagePlacement}<select bind:value={imagePlacement}><option value="top">{t.top}</option><option value="bottom">{t.bottom}</option><option value="wrap">{t.wrap}</option><option value="text">{t.textOnly}</option></select></label>
        <label>{t.imageScope}<select bind:value={imageScope}><option value="all">{t.allPages}</option><option value="odd">{t.oddPages}</option><option value="even">{t.evenPages}</option><option value="custom">{t.customPages}</option></select></label>
        {#if imageScope === 'custom'}
          <label>{t.customPages}<input bind:value={imagePages} placeholder="1-3,5,8" /></label>
          <p class="test-pdf__help">{t.customPagesHelp}</p>
        {/if}
      {/if}
    </fieldset>
  </div>

  <section class="test-pdf__review" aria-labelledby="summary-title">
    <div>
      <h3 id="summary-title">{t.summary}</h3>
      <dl>
        <div><dt>{t.pages}</dt><dd>{pageCount}</dd></div>
        <div><dt>{t.pageSize}</dt><dd>{formatPageSize()} · {orientation === 'portrait' ? t.portrait : t.landscape}</dd></div>
        <div><dt>{t.estimatedChars}</dt><dd>{estimatedCharacters.toLocaleString()}</dd></div>
        <div><dt>{t.includesImages}</dt><dd>{includesImages ? `${imagePagesSet.size} ${t.pages}` : t.noImages}</dd></div>
        <div><dt>{t.estimatedSize}</dt><dd>~{estimatedSizeKb} KB</dd></div>
      </dl>
      {#if isHeavy}<p class="test-pdf__warning">⚠️ {t.warningHeavy}</p>{/if}
      {#if validationError}<p class="test-pdf__error" role="alert">{validationError}</p>{/if}
      {#if errorMessage}<p class="test-pdf__error" role="alert">{errorMessage}</p>{/if}
      {#if statusMessage}<p class="test-pdf__success" role="status">{statusMessage}</p>{/if}
      <p class="test-pdf__privacy">🔒 {t.privacy}</p>
    </div>
    <div class="test-pdf__actions">
      <button type="button" class="test-pdf__primary" disabled={isGenerating || Boolean(validationError)} on:click={generatePdf}>{isGenerating ? t.generating : t.generate}</button>
      <button type="button" class="test-pdf__secondary" disabled={isGenerating} on:click={resetConfig}>{t.reset}</button>
    </div>
  </section>
</section>

<style>
  .test-pdf{display:grid;gap:22px;margin:34px 0 56px;padding:clamp(18px,3vw,30px);border:1px solid #e2e8f0;border-radius:32px;background:radial-gradient(circle at top left,rgba(239,68,68,.12),transparent 34%),linear-gradient(135deg,rgba(255,255,255,.97),rgba(248,250,252,.9));box-shadow:0 30px 90px rgba(15,23,42,.11)}.test-pdf__hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.test-pdf__hero h2{margin:0;font-size:clamp(1.65rem,3vw,2.25rem);letter-spacing:-.04em}.test-pdf__hero p,.test-pdf__help{margin:0;color:#64748b}.test-pdf__eyebrow{display:inline-flex;margin-bottom:8px;padding:5px 10px;border-radius:999px;background:rgba(239,68,68,.1);color:#b91c1c;font-size:.78rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.test-pdf__summary{display:grid;min-width:170px;gap:2px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:22px;background:rgba(255,255,255,.78);text-align:right}.test-pdf__summary strong{font-size:1.9rem;line-height:1}.test-pdf__summary span,.test-pdf__summary small{color:#64748b;font-weight:800}.test-pdf__presets{display:flex;flex-wrap:wrap;gap:10px}.test-pdf__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.test-pdf__panel,.test-pdf__review{display:grid;gap:13px;margin:0;padding:16px;border:1px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 16px 38px rgba(15,23,42,.06)}.test-pdf__panel legend{padding:0 8px;color:#0f172a;font-size:1.08rem;font-weight:950}.test-pdf label{display:grid;gap:6px;color:#334155;font-size:.92rem;font-weight:900}.test-pdf input:not([type='checkbox']):not([type='file']),.test-pdf select{width:100%;min-height:42px;border:1px solid #cbd5e1;border-radius:14px;padding:8px 10px;background:#fff;color:#0f172a}.test-pdf input[type='file']{font:inherit;color:#334155}.test-pdf__check{display:flex!important;grid-template-columns:auto 1fr;align-items:center}.test-pdf__inline{display:grid;grid-template-columns:1fr 1fr .8fr;gap:10px}.test-pdf button{border:0;cursor:pointer;font:inherit;font-weight:900;transition:transform 140ms ease,opacity 140ms ease,box-shadow 140ms ease}.test-pdf button:hover:not(:disabled){transform:translateY(-1px)}.test-pdf button:disabled{cursor:not-allowed;opacity:.5}.test-pdf__presets button,.test-pdf__secondary{min-height:42px;padding:10px 14px;border-radius:999px;background:#e2e8f0;color:#334155}.test-pdf__primary{min-height:48px;padding:12px 18px;border-radius:999px;background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;box-shadow:0 16px 34px rgba(239,68,68,.24)}.test-pdf__review{grid-template-columns:minmax(0,1fr) 260px;align-items:start}.test-pdf__review h3{margin:0 0 10px}.test-pdf dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0}.test-pdf dl div{padding:10px;border-radius:14px;background:#f8fafc}.test-pdf dt{color:#64748b;font-size:.78rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.test-pdf dd{margin:2px 0 0;color:#0f172a;font-weight:950}.test-pdf__warning,.test-pdf__error,.test-pdf__success,.test-pdf__privacy{margin:12px 0 0;padding:11px 12px;border-radius:14px;font-weight:850}.test-pdf__warning{background:#fffbeb;color:#854d0e}.test-pdf__error{background:#fff1f2;color:#991b1b}.test-pdf__success{background:#ecfdf5;color:#166534}.test-pdf__privacy{background:#f8fafc;color:#475569}.test-pdf__actions{display:grid;gap:10px}.test-pdf__actions button{width:100%}@media (max-width:900px){.test-pdf__hero,.test-pdf__grid,.test-pdf__review{grid-template-columns:1fr;display:grid}.test-pdf__summary{text-align:left}.test-pdf dl{grid-template-columns:1fr}}@media (max-width:560px){.test-pdf__inline{grid-template-columns:1fr}.test-pdf__presets{display:grid}.test-pdf__presets button{width:100%}}
</style>
