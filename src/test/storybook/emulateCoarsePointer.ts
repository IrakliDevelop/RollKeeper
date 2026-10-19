/**
 * Storybook's browser can't switch to a coarse pointer, so this copies every
 * `@media (pointer: coarse)` rule on the page into an unconditional <style>
 * element, keeping each rule's cascade layer and, for Tailwind's nested
 * variants, its parent selector. Computed styles then show what a touch
 * device would get. Returns a function that removes the copy.
 */
export function emulateCoarsePointer(): () => void {
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
        const name = layer ? `${layer}.${rule.name}` : rule.name;
        visit(rule.cssRules, name, parentSelector);
      } else if (rule instanceof CSSMediaRule) {
        if (/pointer:\s*coarse/.test(rule.media.mediaText)) {
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
  style.dataset.emulatedPointer = 'coarse';
  style.textContent = chunks.join('\n');
  document.head.appendChild(style);
  return () => style.remove();
}
