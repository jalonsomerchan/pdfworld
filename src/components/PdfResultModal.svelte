<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = 'Vista previa del PDF';
  export let description = 'Comprueba el resultado y descárgalo cuando esté listo.';
  export let pdfUrl = '';
  export let filename = 'pdfworld.pdf';
  export let closeLabel = 'Cerrar';
  export let downloadLabel = 'Descargar PDF';
  export let openLabel = 'Abrir en pestaña';

  const dispatch = createEventDispatcher<{ close: void }>();

  function closeModal() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeModal();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open && pdfUrl}
  <div class="pdf-result-modal" role="presentation" on:click={closeModal}>
    <section
      class="pdf-result-modal__dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-result-title"
      on:click|stopPropagation
    >
      <header class="pdf-result-modal__header">
        <div>
          <span>PDFWorld</span>
          <h3 id="pdf-result-title">{title}</h3>
          <p>{description}</p>
        </div>

        <button type="button" class="pdf-result-modal__close" on:click={closeModal} aria-label={closeLabel}>
          ×
        </button>
      </header>

      <div class="pdf-result-modal__viewer">
        <iframe title={title} src={pdfUrl}></iframe>
      </div>

      <footer class="pdf-result-modal__actions">
        <a class="pdf-result-modal__button pdf-result-modal__button--ghost" href={pdfUrl} target="_blank" rel="noopener noreferrer">
          {openLabel}
        </a>
        <a class="pdf-result-modal__button pdf-result-modal__button--primary" href={pdfUrl} download={filename}>
          {downloadLabel}
        </a>
      </footer>
    </section>
  </div>
{/if}

<style>
  .pdf-result-modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: clamp(12px, 3vw, 28px);
    background:
      radial-gradient(circle at 20% 0%, rgba(240, 82, 61, 0.24), transparent 34rem),
      rgba(15, 23, 42, 0.66);
    backdrop-filter: blur(14px);
    animation: pdf-result-fade 180ms ease both;
  }

  .pdf-result-modal__dialog {
    display: grid;
    grid-template-rows: auto minmax(320px, 1fr) auto;
    width: min(1120px, 100%);
    max-height: min(92vh, 900px);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 34px 110px rgba(15, 23, 42, 0.34);
    animation: pdf-result-rise 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .pdf-result-modal__header,
  .pdf-result-modal__actions {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px;
  }

  .pdf-result-modal__header span {
    display: inline-flex;
    margin-bottom: 7px;
    padding: 5px 9px;
    border-radius: 999px;
    background: #fee2e2;
    color: #991b1b;
    font-size: 0.76rem;
    font-weight: 950;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .pdf-result-modal__header h3 {
    margin: 0 0 6px;
    color: #0f172a;
    font-size: clamp(1.35rem, 2.4vw, 2rem);
    letter-spacing: -0.04em;
  }

  .pdf-result-modal__header p {
    margin: 0;
    color: #64748b;
  }

  .pdf-result-modal__close,
  .pdf-result-modal__button {
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-weight: 950;
    text-decoration: none;
    transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
  }

  .pdf-result-modal__close {
    display: grid;
    width: 42px;
    height: 42px;
    flex: 0 0 auto;
    place-items: center;
    background: #e2e8f0;
    color: #0f172a;
    font-size: 1.7rem;
    line-height: 1;
  }

  .pdf-result-modal__viewer {
    min-height: 0;
    padding: 0 18px;
  }

  .pdf-result-modal__viewer iframe {
    width: 100%;
    height: 100%;
    min-height: min(64vh, 680px);
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    background: #f8fafc;
  }

  .pdf-result-modal__actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .pdf-result-modal__button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 46px;
    padding: 12px 16px;
  }

  .pdf-result-modal__button--ghost {
    background: #e2e8f0;
    color: #0f172a;
  }

  .pdf-result-modal__button--primary {
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    color: #fff;
    box-shadow: 0 16px 34px rgba(239, 68, 68, 0.28);
  }

  .pdf-result-modal__close:hover,
  .pdf-result-modal__button:hover {
    transform: translateY(-1px);
  }

  @keyframes pdf-result-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes pdf-result-rise {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .pdf-result-modal,
    .pdf-result-modal__dialog {
      animation: none;
    }

    .pdf-result-modal__close,
    .pdf-result-modal__button {
      transition: none;
    }
  }

  @media (max-width: 720px) {
    .pdf-result-modal__dialog {
      border-radius: 22px;
    }

    .pdf-result-modal__header,
    .pdf-result-modal__actions {
      padding: 14px;
    }

    .pdf-result-modal__viewer {
      padding: 0 14px;
    }

    .pdf-result-modal__viewer iframe {
      min-height: 58vh;
    }

    .pdf-result-modal__button {
      flex: 1 1 180px;
    }
  }
</style>
