<script lang="ts">
  export type ToolOptionAction = {
    label: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    disabled?: boolean;
    onClick?: () => void;
  };

  type Props = {
    title?: string;
    description?: string;
    badge?: string;
    actions?: ToolOptionAction[];
    compact?: boolean;
  };

  let {
    title = 'Opciones de la herramienta',
    description = 'Configura cómo quieres procesar el PDF antes de generar el resultado.',
    badge = '',
    actions = [],
    compact = false,
  }: Props = $props();
</script>

<section class:tool-options-panel={true} class:tool-options-panel--compact={compact} aria-labelledby="tool-options-title">
  <header class="tool-options-panel__header">
    <div>
      {#if badge}
        <span class="tool-options-panel__badge">{badge}</span>
      {/if}
      <h2 id="tool-options-title">{title}</h2>
      {#if description}
        <p>{description}</p>
      {/if}
    </div>
  </header>

  <div class="tool-options-panel__body">
    <slot />
  </div>

  {#if actions.length > 0}
    <footer class="tool-options-panel__actions">
      {#each actions as action}
        <button
          type="button"
          class={`tool-options-panel__action tool-options-panel__action--${action.variant ?? 'secondary'}`}
          disabled={action.disabled}
          onclick={action.onClick}
        >
          {action.label}
        </button>
      {/each}
    </footer>
  {/if}
</section>

<style>
  .tool-options-panel {
    display: grid;
    gap: clamp(1rem, 2vw, 1.35rem);
    width: 100%;
    padding: clamp(1rem, 2.4vw, 1.5rem);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-2xl, 1.5rem);
    background:
      radial-gradient(circle at top right, color-mix(in srgb, var(--color-primary, #2563eb) 9%, transparent), transparent 18rem),
      var(--color-surface-raised, #fff);
    box-shadow: var(--shadow-sm, 0 4px 12px rgb(15 23 42 / .08));
  }

  .tool-options-panel--compact {
    padding: 1rem;
    border-radius: var(--radius-xl, 1.25rem);
  }

  .tool-options-panel__header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: flex-start;
  }

  .tool-options-panel__badge {
    display: inline-flex;
    width: fit-content;
    margin-bottom: .55rem;
    padding: .35rem .65rem;
    border-radius: var(--radius-full, 999px);
    background: var(--color-primary-soft, #dbeafe);
    color: var(--color-primary, #2563eb);
    font-size: .75rem;
    font-weight: 900;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  .tool-options-panel h2,
  .tool-options-panel p {
    margin: 0;
  }

  .tool-options-panel h2 {
    color: var(--color-text, #0f172a);
    font-size: clamp(1.2rem, 2vw, 1.55rem);
    line-height: 1.08;
  }

  .tool-options-panel p {
    margin-top: .35rem;
    color: var(--color-text-muted, #475569);
  }

  .tool-options-panel__body {
    display: grid;
    gap: 1rem;
  }

  .tool-options-panel :global(.tool-options-group) {
    display: grid;
    gap: .8rem;
    padding: .95rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-xl, 1.25rem);
    background: color-mix(in srgb, var(--color-surface, #fff) 88%, transparent);
  }

  .tool-options-panel :global(.tool-options-group__title) {
    margin: 0;
    color: var(--color-text, #0f172a);
    font-size: .95rem;
    font-weight: 900;
  }

  .tool-options-panel :global(.tool-options-field) {
    display: grid;
    gap: .45rem;
  }

  .tool-options-panel :global(.tool-options-label) {
    color: var(--color-text, #0f172a);
    font-size: .9rem;
    font-weight: 850;
  }

  .tool-options-panel :global(.tool-options-help) {
    margin: 0;
    color: var(--color-text-soft, #64748b);
    font-size: .86rem;
    line-height: 1.45;
  }

  .tool-options-panel :global(.tool-options-error) {
    margin: 0;
    color: var(--color-danger, #dc2626);
    font-size: .86rem;
    font-weight: 800;
  }

  .tool-options-panel :global(.tool-options-row) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: .8rem;
  }

  .tool-options-panel :global(input:not([type='checkbox']):not([type='radio'])),
  .tool-options-panel :global(select),
  .tool-options-panel :global(textarea) {
    width: 100%;
    min-height: 2.85rem;
    padding: .7rem .85rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-lg, 1rem);
    background: var(--color-surface, #fff);
    color: var(--color-text, #0f172a);
    box-shadow: var(--shadow-xs, 0 1px 2px rgb(15 23 42 / .06));
  }

  .tool-options-panel :global(input[type='range']) {
    min-height: auto;
    padding: 0;
    box-shadow: none;
  }

  .tool-options-panel :global(.tool-options-choice) {
    display: flex;
    align-items: flex-start;
    gap: .55rem;
    padding: .7rem .8rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: var(--radius-lg, 1rem);
    background: var(--color-surface, #fff);
    color: var(--color-text, #0f172a);
    cursor: pointer;
  }

  .tool-options-panel :global(.tool-options-choice input) {
    margin-top: .2rem;
  }

  .tool-options-panel__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: .7rem;
    padding-top: .2rem;
  }

  .tool-options-panel__action {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    padding: .72rem 1rem;
    border: 1px solid transparent;
    border-radius: var(--radius-full, 999px);
    cursor: pointer;
    font-weight: 900;
    line-height: 1;
    transition: transform var(--transition-fast, 120ms ease), background var(--transition-base, 180ms ease), border-color var(--transition-base, 180ms ease), opacity var(--transition-base, 180ms ease);
  }

  .tool-options-panel__action:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .tool-options-panel__action:disabled {
    cursor: not-allowed;
    opacity: .5;
  }

  .tool-options-panel__action--primary {
    background: var(--color-primary, #2563eb);
    color: #fff;
  }

  .tool-options-panel__action--secondary {
    border-color: var(--color-border, #e2e8f0);
    background: var(--color-surface, #fff);
    color: var(--color-text, #0f172a);
  }

  .tool-options-panel__action--ghost {
    background: transparent;
    color: var(--color-text-muted, #475569);
  }

  @media (max-width: 560px) {
    .tool-options-panel__actions,
    .tool-options-panel__action {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tool-options-panel__action {
      transition: none;
    }
  }
</style>
