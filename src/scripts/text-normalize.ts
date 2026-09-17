const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»'
};

const validCodePoint = (value: number) =>
  Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff);

const decodeOnce = (value: string) => value
  .replace(/&#(\d+);/g, (match, raw) => {
    const codePoint = Number.parseInt(raw, 10);
    return validCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
  })
  .replace(/&#x([0-9a-f]+);/gi, (match, raw) => {
    const codePoint = Number.parseInt(raw, 16);
    return validCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
  })
  .replace(/&([a-z]+);/gi, (match, raw) => NAMED_ENTITIES[String(raw).toLowerCase()] ?? match);

/**
 * Normalises text imported from WordPress/legacy HTML.
 * Handles both ordinary and accidentally double-encoded entities
 * (for example &#8211; and &amp;#8211;).
 */
export const decodeHtmlEntities = (value: string): string => {
  let result = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeOnce(result);
    if (next === result) break;
    result = next;
  }
  return result.replace(/\u00a0/g, ' ');
};
