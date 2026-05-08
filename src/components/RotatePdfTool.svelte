<script lang="ts">
  import RotatePdfToolProFixed from './RotatePdfToolProFixed.svelte';

  type Lang = 'es' | 'en';

  export let lang: Lang = 'es';
</script>

<RotatePdfToolProFixed {lang} />
