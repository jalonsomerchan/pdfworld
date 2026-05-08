<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import PdfDropzone from './PdfDropzone.svelte';
  import PdfPageCard from './PdfPageCard.svelte';
  import PdfResultModal from './PdfResultModal.svelte';
  import { getPdfPageCount, rotatePdfWithMapInBrowser, type PageRotationMap, type RotatePdfResult } from '../lib/pdf/rotatePdf';
  import { createPdfObjectUrl, formatFileSize, yieldToBrowser } from '../lib/pdfToolUtils';

  type Lang = 'es' | 'en';
  type ThumbStatus = 'pending' | 'ready' | 'failed';

  export let lang: Lang = 'es';

  const i18n = {
    es: {
      title: 'Rota páginas de tu PDF', intro: 'Carga un PDF, visualiza cada página y gira páginas individuales o todo el documento. Todo funciona localmente en tu navegador.',
      dropTitle: 'Arrastra tu PDF aquí', dropActive: 'Suelta el PDF para cargarlo', dropText: 'Suelta el archivo o pulsa para seleccionarlo', fileHelp: 'Un solo PDF · privado · sin subida',
      invalidFile: 'Selecciona un archivo PDF válido.', readError: 'No se pudo leer el PDF. Puede estar dañado, protegido o no ser compatible.', loaded: 'PDF cargado correctamente.', rendering: 'Generando miniaturas… puedes girar páginas mientras tanto.',
      selectedFile: 'Archivo seleccionado', pages: 'páginas', page: 'Página', quick: 'Acciones rápidas', allLeft: 'Girar todas izquierda', allRight: 'Girar todas derecha', resetAll: 'Restablecer todo',
      rotateLeft: 'Girar izquierda', rotateRight: 'Girar derecha', resetPage: 'Restablecer página', removePage: 'Eliminar página', restorePage: 'Restaurar página', summary: 'Resumen', noChanges: 'Gira o elimina páginas para activar la vista previa.', changed: 'páginas modificadas',
      originalSize: 'Tamaño original', outputSize: 'Tamaño final', clear: 'Limpiar', generate: 'Generar vista previa', generating: 'Generando PDF…', download: 'Descargar PDF',
      previewTitle: 'Vista previa del PDF rotado', closePreview: 'Cerrar vista previa', previewFallback: 'Tu navegador no puede mostrar la vista previa del PDF. Descárgalo para revisarlo.',
      ready: 'PDF rotado correctamente. Revisa la vista previa antes de descargarlo.', needFile: 'Primero carga un PDF.', needChanges: 'Gira al menos una página antes de generar el PDF.', createError: 'No se pudo rotar el PDF. Revisa que el archivo no esté protegido o dañado.', outputName: 'pdf-rotado.pdf',
    },
    en: {
      title: 'Rotate PDF pages', intro: 'Load a PDF, preview every page and rotate individual pages or the whole document. Everything runs locally in your browser.',
      dropTitle: 'Drag your PDF here', dropActive: 'Drop the PDF to load it', dropText: 'Drop the file or click to select it', fileHelp: 'Single PDF · private · no upload',
      invalidFile: 'Select a valid PDF file.', readError: 'The PDF could not be read. It may be damaged, protected or unsupported.', loaded: 'PDF loaded successfully.', rendering: 'Generating thumbnails… you can rotate pages meanwhile.',
      selectedFile: 'Selected file', pages: 'pages', page: 'Page', quick: 'Quick actions', allLeft: 'Rotate all left', allRight: 'Rotate all right', resetAll: 'Reset all',
      rotateLeft: 'Rotate left', rotateRight: 'Rotate right', resetPage: 'Reset page', removePage: 'Remove page', restorePage: 'Restore page', summary: 'Summary', noChanges: 'Rotate or remove pages to enable the preview.', changed: 'pages changed',
      originalSize: 'Original size', outputSize: 'Final size', clear: 'Clear', generate: 'Generate preview', generating: 'Generating PDF…', download: 'Download PDF',
      previewTitle: 'Rotated PDF preview', closePreview: 'Close preview', previewFallback: 'Your browser cannot display the PDF preview. Download it to review it.',
      ready: 'PDF rotated successfully. Review the preview before downloading it.', needFile: 'Load a PDF first.', needChanges: 'Rotate at least one page before generating the PDF.', createError: 'The PDF could not be rotated. Check that the file is not protected or damaged.', outputName: 'pdf-rotated.pdf',
    },
  } as const;

  let file: File | null = null;
  let pageCount = 0;
  let rotations: PageRotationMap = {};
  let pagesToKeep: number[] = [];
  let thumbUrls: Record<number, string> = {};
  let thumbStatus: Record<number, ThumbStatus> = {};
  let pdfDoc: any = null;
  let pdfJsPromise: Promise<any> | null = null;
  let renderToken = 0;
  let result: RotatePdfResult | null = null;
  let previewUrl = '';
  let isPreviewOpen = false;
  let isLoading = false;
  let isRendering = false;
  let isExporting = false;
  let errorMessage = '';
  let statusMessage = '';
  let workspaceRegion: HTMLDivElement;

  $: t = i18n[lang] ?? i18n.es;
  $: pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  $: pageStates = pageNumbers.map((page) => {
    const rotation = normalize(rotations[page] ?? 0);
    return { page, rotation, changed: rotation !== 0, kept: pagesToKeep.includes(page) };
  });
  $: changedStates = pageStates.filter((item) => item.changed || !item.kept);
  $: canGenerate = Boolean(file && changedStates.length > 0 && pagesToKeep.length > 0 && !isLoading && !isExporting);
  $: canDownload = Boolean(result && !isExporting);

  async function loadPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')]).then(([pdfJs, worker]) => {
        pdfJs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfJs;
      });
    }
    return pdfJsPromise;
  }

  async function handleDropzoneFiles(files: File[]) { await loadFile(files[0] ?? null); }
  function handleInvalidFiles() { errorMessage = t.invalidFile; statusMessage = ''; }

  async function loadFile(nextFile: File | null) {
    renderToken += 1;
    cleanupThumbs(); cleanupPreview(); await destroyPdfDoc();
    file = nextFile; pageCount = 0; rotations = {}; pagesToKeep = []; thumbUrls = {}; thumbStatus = {}; result = null; isPreviewOpen = false; errorMessage = ''; statusMessage = '';
    if (!nextFile) return;
    isLoading = true;
    try {
      pageCount = await getPdfPageCount(nextFile);
      pagesToKeep = Array.from({ length: pageCount }, (_, index) => index + 1);
      thumbStatus = Object.fromEntries(Array.from({ length: pageCount }, (_, i) => [i + 1, 'pending']));
      statusMessage = `${t.loaded} ${pageCount} ${t.pages}.`;
      void renderThumbs(nextFile);
      await scrollToWorkspace();
    } catch {
      file = null; pageCount = 0; errorMessage = t.readError;
    } finally { isLoading = false; }
  }

  async function renderThumbs(sourceFile: File) {
    const token = ++renderToken;
    isRendering = true;
    try {
      const pdfJs = await loadPdfJs();
      const bytes = new Uint8Array((await sourceFile.arrayBuffer()).slice(0));
      pdfDoc = await pdfJs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, disableAutoFetch: true, disableStream: true }).promise;
      for (let page = 1; page <= pdfDoc.numPages; page += 1) {
        if (token !== renderToken || !pdfDoc) return;
        await yieldToBrowser();
        try {
          const pdfPage = await pdfDoc.getPage(page);
          const url = await pageToThumb(pdfPage);
          pdfPage.cleanup();
          if (token !== renderToken) { URL.revokeObjectURL(url); return; }
          if (thumbUrls[page]) URL.revokeObjectURL(thumbUrls[page]);
          thumbUrls = { ...thumbUrls, [page]: url };
          thumbStatus = { ...thumbStatus, [page]: 'ready' };
        } catch { thumbStatus = { ...thumbStatus, [page]: 'failed' }; }
      }
    } catch {
      thumbStatus = Object.fromEntries(pageNumbers.map((page) => [page, 'failed']));
    } finally { if (token === renderToken) isRendering = false; }
  }

  async function pageToThumb(pdfPage: any) {
    const viewport = pdfPage.getViewport({ scale: 0.34 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('No canvas context');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
    if (!blob) throw new Error('No thumbnail');
    return URL.createObjectURL(blob);
  }

  function rotatePage(page: number, delta: 90 | -90) {
    const next = normalize((rotations[page] ?? 0) + delta);
    const updated = { ...rotations };
    if (next === 0) delete updated[page]; else updated[page] = next;
    rotations = updated;
    result = null; cleanupPreview(); isPreviewOpen = false; statusMessage = ''; errorMessage = '';
  }

  function resetPage(page: number) {
    const updated = { ...rotations };
    delete updated[page];
    rotations = updated;
    result = null; cleanupPreview(); isPreviewOpen = false; statusMessage = ''; errorMessage = '';
  }

  function rotateAll(delta: 90 | -90) {
    const updated: PageRotationMap = {};
    pageStates.forEach(({ page, rotation }) => {
      const next = normalize(rotation + delta);
      if (next !== 0) updated[page] = next;
    });
    rotations = updated;
    result = null; cleanupPreview(); isPreviewOpen = false; statusMessage = ''; errorMessage = '';
  }

  function resetAll() { rotations = {}; result = null; cleanupPreview(); isPreviewOpen = false; statusMessage = ''; errorMessage = ''; }

  async function generatePreview() {
    if (!file) { errorMessage = t.needFile; return; }
    if (changedStates.length === 0) { errorMessage = t.needChanges; return; }
    isExporting = true; result = null; cleanupPreview(); errorMessage = ''; statusMessage = '';
    try {
      const nextResult = await rotatePdfWithMapInBrowser({ file, rotations, pages: pagesToKeep });
      result = nextResult;
      previewUrl = createPdfObjectUrl(nextResult.bytes);
      isPreviewOpen = true;
      statusMessage = t.ready;
    } catch { errorMessage = t.createError; }
    finally { isExporting = false; }
  }

  function closePreview() { isPreviewOpen = false; }

  function clearTool() {
    renderToken += 1; cleanupThumbs(); cleanupPreview(); void destroyPdfDoc();
    file = null; pageCount = 0; rotations = {}; pagesToKeep = []; thumbUrls = {}; thumbStatus = {}; result = null; isPreviewOpen = false; isLoading = false; isRendering = false; isExporting = false; errorMessage = ''; statusMessage = '';
  }

  function togglePageKeep(page: number) {
    if (pagesToKeep.includes(page)) {
      if (pagesToKeep.length <= 1) return;
      pagesToKeep = pagesToKeep.filter((item) => item !== page);
    } else {
      pagesToKeep = [...pagesToKeep, page].sort((a, b) => a - b);
    }
    result = null; cleanupPreview(); isPreviewOpen = false; statusMessage = ''; errorMessage = '';
  }

  function thumbStyle(rotation: number) {
    const scale = rotation === 90 || rotation === 270 ? 0.74 : 1;
    return `transform: rotate(${rotation}deg) scale(${scale});`;
  }
  function normalize(value: number) { return ((value % 360) + 360) % 360; }
  function outputName() { return file?.name ? `${(file.name.replace(/\.pdf$/i, '').trim() || 'documento')}-rotado.pdf` : t.outputName; }
  function formatSize(bytes: number) { return formatFileSize(bytes); }
  function cleanupThumbs() { Object.values(thumbUrls).forEach((url) => URL.revokeObjectURL(url)); thumbUrls = {}; }
  function cleanupPreview() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ''; }
  async function destroyPdfDoc() { if (!pdfDoc) return; try { await pdfDoc.destroy(); } catch {} finally { pdfDoc = null; } }
  async function scrollToWorkspace() { await tick(); workspaceRegion?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  onDestroy(() => { renderToken += 1; cleanupThumbs(); cleanupPreview(); void destroyPdfDoc(); });
</script>

<section class="rotate-pro" aria-labelledby="rotate-pro-title">
  <div class="rotate-pro__hero">
    <div><span class="rotate-pro__eyebrow">Editor visual local</span><h2 id="rotate-pro-title">{t.title}</h2><p>{t.intro}</p></div>
    <PdfDropzone title={t.dropTitle} activeTitle={t.dropActive} subtitle={t.dropText} help={t.fileHelp} selectedLabel={file?.name ?? ''} onFiles={handleDropzoneFiles} onInvalidFiles={handleInvalidFiles} />
  </div>

  {#if errorMessage}<div class="rotate-pro__alert rotate-pro__alert--error" role="alert">{errorMessage}</div>{/if}
  {#if statusMessage}<div class="rotate-pro__alert rotate-pro__alert--success" role="status">{statusMessage}</div>{/if}
  {#if isLoading}<div class="rotate-pro__alert" role="status">Cargando PDF…</div>{/if}
  {#if isRendering}<div class="rotate-pro__alert" role="status">{t.rendering}</div>{/if}

  {#if file && pageCount > 0}
    <div class="rotate-pro__workspace" bind:this={workspaceRegion}>
      <aside class="rotate-pro__sidebar">
        <section class="rotate-pro__panel rotate-pro__file"><span class="rotate-pro__file-icon">PDF</span><div><h3>{t.selectedFile}</h3><strong>{file.name}</strong><p>{formatSize(file.size)} · {pageCount} {t.pages}</p></div></section>
        <section class="rotate-pro__panel"><h3>{t.quick}</h3><div class="rotate-pro__quick-actions"><button type="button" on:click={() => rotateAll(-90)}>↶ {t.allLeft}</button><button type="button" on:click={() => rotateAll(90)}>↷ {t.allRight}</button><button type="button" on:click={resetAll}>⟲ {t.resetAll}</button></div></section>
        <section class="rotate-pro__panel" aria-live="polite"><h3>{t.summary}</h3>{#if changedStates.length}<p><strong>{changedStates.length}</strong> {t.changed}</p><div class="rotate-pro__summary-list">{#each changedStates as item}<span>{t.page} {item.page}: {item.kept ? `${item.rotation}°` : t.removePage}</span>{/each}</div>{:else}<p>{t.noChanges}</p>{/if}</section>
        <section class="rotate-pro__panel rotate-pro__metrics"><div><span>{t.originalSize}</span><strong>{formatSize(file.size)}</strong></div><div><span>{t.outputSize}</span><strong>{result ? formatSize(result.outputSize) : '—'}</strong></div></section>
        <div class="rotate-pro__actions"><button type="button" class="rotate-pro__secondary" on:click={clearTool} disabled={isExporting}>{t.clear}</button><button type="button" class="rotate-pro__primary" on:click={generatePreview} disabled={!canGenerate}>{isExporting ? t.generating : t.generate}</button><button type="button" class="rotate-pro__primary rotate-pro__primary--dark" on:click={() => (isPreviewOpen = true)} disabled={!canDownload}>{t.download}</button></div>
      </aside>

      <section class="rotate-pro__pages" aria-label={t.title}>
        {#each pageStates as item}
          <PdfPageCard
            pageNumber={item.page}
            title={`${t.page} ${item.page}`}
            thumbnailUrl={thumbUrls[item.page] ?? ''}
            thumbnailStatus={thumbStatus[item.page] ?? 'pending'}
            selected={item.kept}
            removed={!item.kept}
            rotation={item.rotation}
            selectLabel={item.kept ? t.removePage : t.restorePage}
            rotateLeftLabel={t.rotateLeft}
            rotateRightLabel={t.rotateRight}
            removeLabel={t.removePage}
            restoreLabel={t.restorePage}
            onToggle={() => togglePageKeep(item.page)}
            onRotateLeft={() => rotatePage(item.page, -90)}
            onRotateRight={() => rotatePage(item.page, 90)}
            onRemove={() => togglePageKeep(item.page)}
          />
        {/each}
      </section>
    </div>
  {/if}
</section>

<PdfResultModal
  open={isPreviewOpen && Boolean(previewUrl)}
  pdfUrl={previewUrl}
  filename={outputName()}
  title={t.previewTitle}
  description={t.ready}
  downloadLabel={t.download}
  closeLabel={t.closePreview}
  on:close={closePreview}
/>

<style>
  .rotate-pro{display:grid;gap:24px;margin:36px 0 72px}.rotate-pro__hero,.rotate-pro__workspace,.rotate-pro__panel,.rotate-pro__alert{border:1px solid #e2e8f0;border-radius:30px;background:rgba(255,255,255,.92);box-shadow:0 24px 70px rgba(15,23,42,.08)}.rotate-pro__hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);gap:24px;align-items:center;padding:28px;background:radial-gradient(circle at top right,rgba(59,130,246,.18),transparent 34%),linear-gradient(135deg,#fff,rgba(248,250,252,.94))}.rotate-pro__hero h2{margin:0 0 8px;letter-spacing:-.045em}.rotate-pro__hero p,.rotate-pro__panel p,.rotate-pro__file p{margin:0;color:#64748b}.rotate-pro__eyebrow{display:inline-flex;margin-bottom:10px;padding:6px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:.8rem;font-weight:900}.rotate-pro__alert{padding:16px 18px;color:#475569;font-weight:850}.rotate-pro__alert--error{border-color:#fecaca;background:#fff1f2;color:#991b1b}.rotate-pro__alert--success{border-color:#bbf7d0;background:#f0fdf4;color:#166534}.rotate-pro__workspace{display:grid;grid-template-columns:340px minmax(0,1fr);gap:22px;padding:22px;align-items:start}.rotate-pro__sidebar{position:sticky;top:18px;display:grid;gap:14px}.rotate-pro__panel{padding:18px}.rotate-pro__panel h3{margin:0 0 12px}.rotate-pro__file{display:flex;gap:14px;align-items:flex-start}.rotate-pro__file strong{display:block;overflow:hidden;max-width:220px;text-overflow:ellipsis;white-space:nowrap}.rotate-pro__file-icon{display:grid;width:52px;height:64px;place-items:center;border-radius:16px;background:#eff6ff;color:#2563eb;font-size:.75rem;font-weight:950}.rotate-pro__quick-actions,.rotate-pro__actions{display:grid;gap:10px}.rotate-pro__quick-actions button,.rotate-pro__primary,.rotate-pro__secondary,.rotate-pro__page-actions button{border:0;cursor:pointer;font:inherit;font-weight:950;transition:transform 140ms ease,box-shadow 140ms ease,opacity 140ms ease}.rotate-pro__quick-actions button{min-height:44px;border-radius:999px;background:#e2e8f0;color:#334155}.rotate-pro__summary-list{display:flex;flex-wrap:wrap;gap:8px;max-height:136px;overflow:auto}.rotate-pro__summary-list span{display:inline-flex;padding:7px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-weight:900;font-size:.86rem}.rotate-pro__metrics{display:grid;gap:10px}.rotate-pro__metrics div{display:grid;gap:5px;padding:12px;border-radius:16px;background:#f8fafc}.rotate-pro__metrics span{color:#64748b;font-size:.74rem;font-weight:850;text-transform:uppercase}.rotate-pro__metrics strong{font-size:1.1rem;color:#0f172a}.rotate-pro__primary,.rotate-pro__secondary{min-height:48px;padding:12px 16px;border-radius:999px}.rotate-pro__primary{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;box-shadow:0 16px 34px rgba(37,99,235,.24)}.rotate-pro__primary--dark{background:linear-gradient(135deg,#0f172a,#334155);box-shadow:0 16px 34px rgba(15,23,42,.22)}.rotate-pro__secondary{background:#e2e8f0;color:#334155}.rotate-pro__primary:disabled,.rotate-pro__secondary:disabled{cursor:not-allowed;opacity:.45}.rotate-pro__pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:18px;padding:4px}.rotate-pro__page-card{display:grid;gap:12px;padding:14px;border:2px solid #e2e8f0;border-radius:24px;background:#fff;box-shadow:0 12px 28px rgba(15,23,42,.06);transition:transform 160ms ease,border-color 160ms ease,box-shadow 160ms ease}.rotate-pro__page-card--changed{border-color:#2563eb;background:#eff6ff;box-shadow:0 18px 40px rgba(37,99,235,.16)}.rotate-pro__page-card:hover{transform:translateY(-2px)}.rotate-pro__thumb-frame{display:grid;place-items:center;min-height:248px;overflow:hidden;border:1px solid #e2e8f0;border-radius:18px;background:linear-gradient(135deg,#f8fafc,#eef2ff)}.rotate-pro__thumb{display:grid;place-items:center;width:82%;transition:transform 220ms ease}.rotate-pro__thumb img{display:block;width:100%;height:auto;box-shadow:0 14px 30px rgba(15,23,42,.18);pointer-events:none}.rotate-pro__placeholder{display:grid;width:100%;min-height:178px;place-items:center;border-radius:14px;color:#94a3b8;background:#f1f5f9;font-size:1.4rem;font-weight:950}.rotate-pro__placeholder--loading{background:linear-gradient(100deg,#f1f5f9 20%,#fff 45%,#f1f5f9 70%);background-size:220% 100%;animation:thumb-loading 1.4s ease-in-out infinite}.rotate-pro__page-meta{display:flex;justify-content:space-between;align-items:center;gap:10px}.rotate-pro__page-meta span{padding:5px 9px;border-radius:999px;background:#e2e8f0;color:#334155;font-weight:950;font-size:.82rem}.rotate-pro__page-card--changed .rotate-pro__page-meta span{background:#dbeafe;color:#1d4ed8}.rotate-pro__page-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.rotate-pro__page-actions button{min-height:44px;border-radius:999px;background:#e2e8f0;color:#334155}.rotate-pro__page-actions button:hover,.rotate-pro__quick-actions button:hover,.rotate-pro__primary:hover:not(:disabled),.rotate-pro__secondary:hover:not(:disabled){transform:translateY(-1px)}.pdf-modal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px}.pdf-modal__backdrop{position:absolute;inset:0;background:rgba(15,23,42,.72);backdrop-filter:blur(6px)}.pdf-modal__panel{position:relative;z-index:1;display:grid;grid-template-rows:auto minmax(0,1fr);width:min(1120px,96vw);height:min(820px,92vh);overflow:hidden;border-radius:24px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.35)}.pdf-modal__header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid #e2e8f0}.pdf-modal__header h2{margin:0;font-size:1.05rem}.pdf-modal__header div{display:flex;gap:10px;align-items:center}.pdf-modal__viewer{width:100%;height:100%;border:0;background:#f8fafc}.pdf-modal__download,.pdf-modal__close{border:0;cursor:pointer;font:inherit;font-weight:950}.pdf-modal__download{min-height:40px;padding:9px 14px;border-radius:999px;background:#2563eb;color:#fff}.pdf-modal__close{display:grid;width:40px;height:40px;place-items:center;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:1.35rem;line-height:1}@keyframes thumb-loading{0%{background-position:120% 0}100%{background-position:-120% 0}}@media (prefers-reduced-motion:reduce){.rotate-pro__page-card,.rotate-pro__thumb,.rotate-pro__quick-actions button,.rotate-pro__primary,.rotate-pro__secondary,.rotate-pro__page-actions button{transition:none}.rotate-pro__placeholder--loading{animation:none}}@media (min-width:1280px){.rotate-pro__pages{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}.rotate-pro__thumb-frame{min-height:280px}}@media (max-width:980px){.rotate-pro__hero,.rotate-pro__workspace{grid-template-columns:1fr}.rotate-pro__sidebar{position:static}.rotate-pro__hero{padding:18px;border-radius:24px}.rotate-pro__pages{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.rotate-pro__thumb-frame{min-height:180px}.pdf-modal{padding:10px}.pdf-modal__panel{width:100%;height:94vh;border-radius:18px}.pdf-modal__header{align-items:flex-start}.pdf-modal__header div{flex-wrap:wrap;justify-content:flex-end}}
  .rotate-pro__page-card--removed{opacity:.58;border-color:#fecaca;background:#fff1f2}
  .rotate-pro__page-actions{grid-template-columns:repeat(4,1fr)}
  .rotate-pro__page-actions button:last-child{background:#fee2e2;color:#991b1b}
</style>
