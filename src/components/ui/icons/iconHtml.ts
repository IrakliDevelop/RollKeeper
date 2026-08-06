import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { ICONS, type IconName } from './iconRegistry';

/** Render a canonical icon for HTML-string pipelines that cannot render JSX. */
export function renderIconHtml(name: IconName): string {
  return renderToStaticMarkup(
    createElement(ICONS[name], {
      'aria-hidden': true,
      className: 'app-inline-icon',
      width: 16,
      height: 16,
    })
  );
}

const LEGACY_ICON_PATTERN =
  /^(?:⚔️?|✨|🔍|🎲|🐉|💫|⚡|🎯|👁️?|💥|📈|🏹|🔢|🛡️?|❌|✅|↩️|❓)\s*/u;

/** Replace a legacy leading badge emoji with the supplied canonical icon. */
export function replaceLegacyBadgeIcon(
  content: string,
  name: IconName
): string {
  return content.replace(LEGACY_ICON_PATTERN, `${renderIconHtml(name)} `);
}
