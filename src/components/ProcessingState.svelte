<script lang="ts">
  type Step = {
    label: string;
    done?: boolean;
    active?: boolean;
  };

  type Props = {
    title?: string;
    description?: string;
    progress?: number | null;
    steps?: Step[];
    longOperationHint?: string;
    cancelLabel?: string;
    onCancel?: (() => void) | null;
  };

  let {
    title = 'Procesando archivo',
    description = 'Estamos preparando tu documento. Mantén esta pestaña abierta hasta que termine el proceso.',
    progress = null,
    steps = [],
    longOperationHint = 'Los PDFs grandes pueden tardar un poco más, pero el proceso sigue ejecutándose en tu navegador.',
    cancelLabel = 'Cancelar',
    onCancel = null,
  }: Props = $props();

  const normalizedProgress = $derived(
    typeof progress === 'number' ? Math.min(100, Math.max(0, progress)) : null,
  );
</script>

<section class="processing-state" aria-live="polite" aria-busy="true">
  <div class="processing-state__visual" aria-hidden="true">
    <span class="processing-state__spinner"></span>
  </div>

  <div class="processing-state__content">
    <p class="processing-state__eyebrow">FácilPDF</p>
    <h2>{title}</h2>
    <p>{description}</p>

    {#if normalizedProgress !== null}
      <div class="processing-state__progress" aria-label={`Progreso: ${Math.round(normalizedProgress)}%`}>
        <span style={`width: ${normalizedProgress}%`}></span>
      </div>
      <strong class="processing-state__percent">{Math.round(normalizedProgress)}%</strong>
    {:else}
      <div class="processing-state__progress processing-state__progress--indeterminate" aria-hidden="true">
        <span></span>
      </div>
    {/if}

    {#if steps.length > 0}
      <ol class="processing-state__steps">
        {#each steps as step}
          <li class:done={step.done} class:active={step.active}>
            <span aria-hidden="true">{step.done ? '✓' : step.active ? '…' : '•'}</span>
            {step.label}
          </li>
        {/each}
      </ol>
    {/if}

    <p class="processing-state__hint">{longOperationHint}</p>

    {#if onCancel}
      <button class="processing-state__cancel" type="button" onclick={onCancel}>{cancelLabel}</button>
    {/if}
  </div>
</section>

<style>
  .processing-state {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: clamp(1rem, 3vw, 1.5rem);
    align-items: start;
    width: min(48rem, 100%);
    margin-inline: auto;
    padding: clamp(1.25rem, 3vw, 2rem);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-2xl, 1.5rem);
    background: var(--color-surface-raised, #fff);
    box-shadow: var(--shadow-sm, 0 4px 12px rgb(15 23 42 / .08));
  }

  .processing-state__visual {
    display: grid;
    width: 3.75rem;
    height: 3.75rem;
    place-items: center;
    border-radius: var(--radius-xl, 1.25rem);
    background: var(--color-primary-soft, #dbeafe);
  }

  .processing-state__spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid color-mix(in srgb, var(--color-primary, #2563eb) 24%, transparent);
    border-top-color: var(--color-primary, #2563eb);
    border-radius: 50%;
    animation: processing-spin 850ms linear infinite;
  }

  .processing-state__content {
    display: grid;
    gap: .75rem;
    min-width: 0;
  }

  .processing-state__eyebrow {
    margin: 0;
    color: var(--color-primary, #2563eb);
    font-size: .78rem;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .processing-state h2,
  .processing-state p {
    margin: 0;
  }

  .processing-state h2 {
    color: var(--color-text, #0f172a);
    font-size: clamp(1.35rem, 3vw, 2rem);
    line-height: 1.05;
  }

  .processing-state p {
    color: var(--color-text-muted, #475569);
  }

  .processing-state__progress {
    position: relative;
    height: .7rem;
    overflow: hidden;
    border-radius: var(--radius-full, 999px);
    background: var(--color-surface-soft, #f1f5f9);
  }

  .processing-state__progress span {
    position: absolute;
    inset-block: 0;
    left: 0;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--color-primary, #2563eb), var(--color-secondary, #7c3aed));
    transition: width var(--transition-base, 180ms ease);
  }

  .processing-state__progress--indeterminate span {
    width: 42%;
    animation: processing-progress 1.2s ease-in-out infinite;
  }

  .processing-state__percent {
    width: fit-content;
    color: var(--color-text, #0f172a);
    font-size: .9rem;
  }

  .processing-state__steps {
    display: grid;
    gap: .45rem;
    margin: .25rem 0 0;
    padding: 0;
    list-style: none;
  }

  .processing-state__steps li {
    display: flex;
    align-items: center;
    gap: .55rem;
    color: var(--color-text-muted, #475569);
    font-weight: 750;
  }

  .processing-state__steps span {
    display: grid;
    width: 1.35rem;
    height: 1.35rem;
    place-items: center;
    border-radius: 50%;
    background: var(--color-surface-soft, #f1f5f9);
    color: var(--color-text-soft, #64748b);
    font-size: .8rem;
  }

  .processing-state__steps li.done span {
    background: var(--color-success-soft, #dcfce7);
    color: var(--color-success, #16a34a);
  }

  .processing-state__steps li.active {
    color: var(--color-text, #0f172a);
  }

  .processing-state__steps li.active span {
    background: var(--color-primary-soft, #dbeafe);
    color: var(--color-primary, #2563eb);
  }

  .processing-state__hint {
    padding: .75rem .9rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-lg, 1rem);
    background: var(--color-surface-soft, #f1f5f9);
    font-size: .92rem;
  }

  .processing-state__cancel {
    width: fit-content;
    min-height: 2.65rem;
    padding: .7rem 1rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-full, 999px);
    background: var(--color-surface, #fff);
    color: var(--color-text, #0f172a);
    cursor: pointer;
    font-weight: 850;
  }

  .processing-state__cancel:hover {
    border-color: var(--color-border-strong, #cbd5e1);
    background: var(--color-surface-soft, #f1f5f9);
  }

  @keyframes processing-spin {
    to { transform: rotate(360deg); }
  }

  @keyframes processing-progress {
    0% { transform: translateX(-110%); }
    100% { transform: translateX(260%); }
  }

  @media (max-width: 560px) {
    .processing-state {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .processing-state__spinner,
    .processing-state__progress--indeterminate span {
      animation: none;
    }
  }
</style>
