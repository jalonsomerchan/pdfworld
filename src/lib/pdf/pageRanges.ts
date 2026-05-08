export interface ParsedPageRange {
  label: string;
  pages: number[];
}

export interface PageRangeMessages {
  needFile: string;
  badFormat: string;
  invalidNumber: string;
  reversedRange: string;
  outOfBounds: string;
  duplicated: string;
}

export interface ParsePageRangesResult {
  pages: number[];
  ranges: ParsedPageRange[];
  error: string;
}

export function parsePageRanges(input: string, totalPages: number, messages: PageRangeMessages): ParsePageRangesResult {
  const value = input.trim();
  const pages: number[] = [];
  const ranges: ParsedPageRange[] = [];
  const seen = new Set<number>();

  if (!value) {
    return { pages, ranges, error: '' };
  }

  if (!totalPages) {
    return { pages, ranges, error: messages.needFile };
  }

  const chunks = value.split(',').map((chunk) => chunk.trim());

  if (chunks.some((chunk) => !chunk)) {
    return { pages: [], ranges: [], error: messages.badFormat };
  }

  for (const chunk of chunks) {
    const match = chunk.match(/^(\d+)(?:\s*-\s*(\d+))?$/);

    if (!match) {
      return { pages: [], ranges: [], error: messages.badFormat };
    }

    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < 1) {
      return { pages: [], ranges: [], error: messages.invalidNumber };
    }

    if (start > end) {
      return { pages: [], ranges: [], error: messages.reversedRange.replace('{range}', chunk) };
    }

    const rangePages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

    for (const page of rangePages) {
      if (page > totalPages) {
        return {
          pages: [],
          ranges: [],
          error: messages.outOfBounds.replace('{page}', String(page)).replace('{total}', String(totalPages)),
        };
      }

      if (seen.has(page)) {
        return { pages: [], ranges: [], error: messages.duplicated.replace('{page}', String(page)) };
      }

      seen.add(page);
    }

    pages.push(...rangePages);
    ranges.push({ label: start === end ? String(start) : `${start}-${end}`, pages: rangePages });
  }

  return { pages, ranges, error: '' };
}

export function pagesToRanges(pages: number[]): ParsedPageRange[] {
  if (pages.length === 0) return [];

  const sortedPages = [...pages].sort((a, b) => a - b);
  const ranges: ParsedPageRange[] = [];
  let start = sortedPages[0];
  let previous = sortedPages[0];

  for (const page of sortedPages.slice(1)) {
    if (page === previous + 1) {
      previous = page;
      continue;
    }

    ranges.push(createPageRange(start, previous));
    start = page;
    previous = page;
  }

  ranges.push(createPageRange(start, previous));
  return ranges;
}

export function createPageRange(start: number, end: number): ParsedPageRange {
  return {
    label: start === end ? String(start) : `${start}-${end}`,
    pages: Array.from({ length: end - start + 1 }, (_, index) => start + index),
  };
}
