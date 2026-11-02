// Bundled by build-launcher.mjs (esbuild) and run in Node: renders the
// React launcher to static markup for public/launcher.html.
import { renderToStaticMarkup } from 'react-dom/server';
import { LauncherTable } from '@/components/launcher/LauncherTable';
import { ContinueLinkView } from '@/components/launcher/LauncherParts';
import {
  CONTINUE_SLOT_ID,
  CONTINUE_TEMPLATE_ID,
  staticContinueScript,
} from '@/components/launcher/staticContinue';
import { themeScript } from '@/app/themeScript';

export function renderLauncher() {
  // `hidden` keeps the placeholder out of the header's flex gap, exactly as
  // the React launcher renders nothing when there is no character.
  const body = renderToStaticMarkup(
    <LauncherTable continueSlot={<span id={CONTINUE_SLOT_ID} hidden />} />
  );
  const continueTemplate = `<template id="${CONTINUE_TEMPLATE_ID}">${renderToStaticMarkup(
    <ContinueLinkView href="/player" name="" />
  )}</template>`;
  return { body, continueTemplate, themeScript, staticContinueScript };
}
