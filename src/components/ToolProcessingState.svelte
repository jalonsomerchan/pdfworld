<script lang="ts">
  export let title = 'Procesando archivo…';
  export let description = 'Mantén esta pestaña abierta mientras termina la operación.';
  export let progress: number | null = null;
  export let indeterminate = false;

  $: safeProgress = progress === null ? null : Math.min(100, Math.max(0, Math.round(progress)));
</script>

<section class="tool-processing" aria-live="polite" aria-busy="true">
  <div class="tool-processing__spinner" aria-hidden="true"></div>
  <div class="tool-processing__content">
    <strong>{title}</strong>
    <p>{description}</p>
    <div
      class:tool-processing__bar={true}
      class:tool-processing__bar--indeterminate={indeterminate || safeProgress === null}
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={safeProgress ?? undefined}
    >
      <span style={`width: ${safeProgress ?? 38}%`}></span>
    </div>
    {#if safeProgress !== null}
      <small>{safeProgress}%</small>
    {/if}
  </div>
</section>

<style>
  .tool-processing {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: clamp(1rem, 2.5vw, 1.35rem);
    border: 1px solid color-mix(in srgb, var(--color-primary, #ef4444) 18%, var(--color-border, #e2e8f0));
    border-radius: var(--radius-xl, 1.25rem);
    background: color-mix(in srgb, var(--color-primary, #ef4444) 7%, var(--color-surface, #fff));
    box-shadow: var(--shadow-sm, 0 14px 36px rgb(15 23 42 / .08));
  }

  .tool-processing__spinner {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 999px;
    border: .28rem solid color-mix(in srgb, var(--color-primary, #ef4444) 16%, transparent);
    border-top-color: var(--color-primary, #ef4444);
    animation: tool-processing-spin .8s linear infinite;
  }

  .tool-processing__content {
    display: grid;
    gap: .35rem;
    min-width: 0;
  }

  .tool-processing strong {
    color: var(--color-text, #0f172a);
    font-size: clamp(1rem, 2vw, 1.12rem);
    overflow-wrap: anywhere;
  }

  .tool-processing p,
  .tool-processing small {
    margin: 0;
    color: var(--color-text-muted, #64748b);
    font-weight: 750;
  }

  .tool-processing p {
    overflow-wrap: anywhere;
  }

  .tool-processing__bar {
    position: relative;
    overflow: hidden;
    height: .7rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-border, #e2e8f0) 72%, transparent);
  }

  .tool-processing__bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--color-primary, #ef4444), var(--color-secondary, #b91c1c));
    transition: width 180ms ease;
  }

  .tool-processing__bar--indeterminate span {
    width: 38%;
    animation: tool-processing-slide 1.15s ease-in-out infinite;
  }

  @keyframes tool-processing-spin {
    to { transform: rotate(1turn); }
  }

  @keyframes tool-processing-slide {
    0% { transform: translateX(-110%); }
    100% { transform: translateX(290%); }
  }

  @media (prefers-reduced-motion: reduce) {
    .tool-processing__spinner,
    .tool-processing__bar--indeterminate span {
      animation: none;
    }
  }

  @media (max-width: 520px) {
    .tool-processing {
      grid-template-columns: 1fr;
      justify-items: start;
      padding: 1rem;
      border-radius: var(--radius-lg, 1rem);
    }

    .tool-processing__spinner {
      width: 2.25rem;
      height: 2.25rem;
    }

    .tool-processing__bar {
      width: 100%;
    }
  }
</style>
