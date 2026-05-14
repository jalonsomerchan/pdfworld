<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import MultiPdfToolImproved from './MultiPdfToolImproved.svelte';

  type Lang = 'es' | 'en';

  export let lang: Lang = 'es';

  let root: HTMLDivElement;
  let observer: MutationObserver | null = null;
  let frame = 0;
  let modal: HTMLDivElement | null = null;
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  $: labels =
    lang === 'en'
      ? {
          generate: '⚡ View and download PDF',
          generating: 'Generating PDF…',
          enlarge: 'Enlarge thumbnail',
          close: 'Close enlarged thumbnail',
          title: 'Enlarged thumbnail',
          empty: 'The thumbnail is not ready yet.',
        }
      : {
          generate: '⚡ Ver y Descargar PDF',
          generating: 'Generando PDF…',
          enlarge: 'Ampliar miniatura',
          close: 'Cerrar miniatura ampliada',
          title: 'Miniatura ampliada',
          empty: 'La miniatura aún no está lista.',
        };

  function scheduleEnhance() {
    if (!isBrowser || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      enhanceTool();
    });
  }

  function enhanceTool() {
    if (!isBrowser || !root) return;

    root.querySelectorAll<HTMLButtonElement>('.side-actions .secondary-action').forEach((button) => {
      button.remove();
    });

    root.querySelectorAll<HTMLButtonElement>('.side-actions .primary-action').forEach((button) => {
      const text = button.textContent?.trim() ?? '';
      button.textContent = /Generando|Generating/.test(text) ? `⚡ ${labels.generating}` : labels.generate;
      button.setAttribute('aria-label', labels.generate.replace('⚡ ', ''));
    });

    root.querySelectorAll<HTMLElement>('.multi-page').forEach((card) => {
      if (card.querySelector('.multi-page__zoom')) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'multi-page__zoom';
      button.textContent = '⛶';
      button.setAttribute('aria-label', labels.enlarge);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        openThumbnail(card);
      });
      card.append(button);
    });
  }

  function openThumbnail(card: HTMLElement) {
    if (!isBrowser) return;

    const image = card.querySelector<HTMLImageElement>('.multi-page__thumb img');
    const title = card.querySelector('.multi-page__meta strong')?.textContent?.trim() || labels.title;
    const fileName = card.querySelector('small')?.textContent?.trim() || '';

    closeThumbnail();

    modal = document.createElement('div');
    modal.className = 'multi-thumb-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'multi-thumb-modal-title');

    const panel = document.createElement('div');
    panel.className = 'multi-thumb-modal__panel';
    panel.setAttribute('role', 'document');

    const header = document.createElement('header');
    const headingWrap = document.createElement('div');
    const eyebrow = document.createElement('span');
    const heading = document.createElement('h3');
    const file = document.createElement('p');
    const close = document.createElement('button');
    const body = document.createElement('div');

    eyebrow.textContent = labels.title;
    heading.id = 'multi-thumb-modal-title';
    heading.textContent = title;
    file.textContent = fileName;
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', labels.close);
    body.className = 'multi-thumb-modal__body';

    if (image?.src) {
      const clone = document.createElement('img');
      clone.src = image.src;
      clone.alt = image.alt || title;
      body.append(clone);
    } else {
      const empty = document.createElement('p');
      empty.className = 'multi-thumb-modal__empty';
      empty.textContent = labels.empty;
      body.append(empty);
    }

    headingWrap.append(eyebrow, heading, file);
    header.append(headingWrap, close);
    panel.append(header, body);
    modal.append(panel);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeThumbnail();
    });
    close.addEventListener('click', closeThumbnail);
    document.addEventListener('keydown', closeOnEscape);
    document.body.append(modal);
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape') closeThumbnail();
  }

  function closeThumbnail() {
    if (!isBrowser) return;

    document.removeEventListener('keydown', closeOnEscape);
    modal?.remove();
    modal = null;
  }

  onMount(() => {
    if (!isBrowser) return;

    enhanceTool();
    observer = new MutationObserver(scheduleEnhance);
    observer.observe(root, { childList: true, subtree: true });
  });

  onDestroy(() => {
    if (!isBrowser) return;

    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    closeThumbnail();
  });
</script>

<div class="multi-tool-wrapper" bind:this={root}>
  <MultiPdfToolImproved {lang} />
</div>

<style>
  :global(.multi-tool-wrapper .side-actions .secondary-action) {
    display: none !important;
  }

  :global(.multi-tool-wrapper .multi-page__zoom) {
    position: absolute;
    right: 0.6rem;
    bottom: 5.7rem;
    z-index: 4;
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 999px;
    background: var(--color-surface, #fff);
    color: var(--color-text, #0f172a);
    box-shadow: var(--shadow-sm, 0 4px 12px rgb(15 23 42 / 0.08));
    cursor: pointer;
    font: inherit;
    font-weight: 950;
  }

  :global(.multi-tool-wrapper .multi-page__zoom:hover),
  :global(.multi-tool-wrapper .multi-page__zoom:focus-visible) {
    border-color: var(--color-primary, #2563eb);
    color: var(--color-primary, #2563eb);
    outline: 3px solid color-mix(in srgb, var(--color-primary, #2563eb) 18%, transparent);
    outline-offset: 2px;
  }

  :global(.multi-thumb-modal) {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgb(15 23 42 / 0.72);
    backdrop-filter: blur(10px);
  }

  :global(.multi-thumb-modal__panel) {
    display: grid;
    gap: 1rem;
    width: min(100%, 52rem);
    max-height: 92vh;
    padding: clamp(0.9rem, 2vw, 1.25rem);
    border: 1px solid color-mix(in srgb, var(--color-border, #e2e8f0) 55%, transparent);
    border-radius: var(--radius-2xl, 1.5rem);
    background: var(--color-surface, #fff);
    box-shadow: var(--shadow-lg, 0 24px 60px rgb(15 23 42 / 0.16));
  }

  :global(.multi-thumb-modal__panel header) {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }

  :global(.multi-thumb-modal__panel header span) {
    color: var(--color-text-muted, #475569);
    font-size: 0.8rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  :global(.multi-thumb-modal__panel h3),
  :global(.multi-thumb-modal__panel p) {
    margin: 0;
  }

  :global(.multi-thumb-modal__panel p) {
    color: var(--color-text-muted, #475569);
    font-size: 0.9rem;
    font-weight: 750;
  }

  :global(.multi-thumb-modal__panel button) {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border: 0;
    border-radius: 999px;
    background: var(--color-surface-soft, #f1f5f9);
    color: var(--color-text, #0f172a);
    cursor: pointer;
    font: inherit;
    font-size: 1.5rem;
    font-weight: 900;
  }

  :global(.multi-thumb-modal__body) {
    display: grid;
    place-items: center;
    overflow: auto;
  }

  :global(.multi-thumb-modal__body img) {
    display: block;
    width: auto;
    max-width: 100%;
    max-height: 72vh;
    border-radius: var(--radius-lg, 1rem);
    background: #fff;
    box-shadow: 0 20px 55px rgb(15 23 42 / 0.26);
  }

  :global(.multi-thumb-modal__empty) {
    margin: 0;
    padding: 1rem;
    color: var(--color-text-muted, #475569);
    font-weight: 800;
  }

  @media (max-width: 900px) {
    :global(.multi-tool-wrapper .multi-page__zoom) {
      bottom: 6.1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.multi-thumb-modal) {
      backdrop-filter: none;
    }
  }
</style>
