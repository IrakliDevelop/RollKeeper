/**
 * Storybook's browser can't switch to a coarse pointer or to reduced motion,
 * so this copies every `@media` rule whose query matches into an
 * unconditional <style> element, keeping each rule's cascade layer and, for
 * Tailwind's nested variants, its parent selector. Computed styles then show
 * what that device would get. Returns a function that removes the copy.
 */
function emulateMedia(query: RegExp, name: string): () => void {
  const chunks: string[] = [];

  const wrap = (text: string, layer: string | null) =>
    layer ? `@layer ${layer} { ${text} }` : text;

  const visit = (
    rules: CSSRuleList,
    layer: string | null,
    parentSelector: string | null
  ) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSLayerBlockRule) {
        const layerName = layer ? `${layer}.${rule.name}` : rule.name;
        visit(rule.cssRules, layerName, parentSelector);
      } else if (rule instanceof CSSMediaRule) {
        if (query.test(rule.media.mediaText)) {
          const body = Array.from(rule.cssRules)
            .map(inner => inner.cssText)
            .join('\n');
          chunks.push(
            wrap(parentSelector ? `${parentSelector} { ${body} }` : body, layer)
          );
        } else {
          visit(rule.cssRules, layer, parentSelector);
        }
      } else if (rule instanceof CSSStyleRule && rule.cssRules.length > 0) {
        visit(rule.cssRules, layer, rule.selectorText);
      }
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    visit(rules, null, null);
  }

  const style = document.createElement('style');
  style.dataset.emulatedMedia = name;
  style.textContent = chunks.join('\n');
  document.head.appendChild(style);
  return () => style.remove();
}

/** Copies the `(pointer: coarse)` rules: what an iPad would get. */
export function emulateCoarsePointer(): () => void {
  return emulateMedia(/pointer:\s*coarse/, 'coarse-pointer');
}

/** Copies the `(prefers-reduced-motion: reduce)` rules. */
export function emulateReducedMotion(): () => void {
  return emulateMedia(/prefers-reduced-motion:\s*reduce/, 'reduced-motion');
}
