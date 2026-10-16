import { redirect } from 'next/navigation';

import { legacyTableRedirectHref } from '@/components/ui/campaign/table/workspace/tableWorkspaceRoutes';

/**
 * PR06 W8: the PR01–PR05 per-scene Table URL is an adapter onto the unified
 * workspace. It only redirects (307) — the scene id becomes `?scene=` and
 * `run` / `tableWorkspace` are preserved raw — so selection stays private
 * preparation and no presentation command can be sent from here.
 */
export default async function LegacyTableScenePage(props: {
  params: Promise<{ code: string; sceneId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code, sceneId } = await props.params;
  const search = await props.searchParams;
  redirect(legacyTableRedirectHref(code, sceneId, search));
}
