/** FU-7: a run's creation as locale date plus short time (null if invalid). */
export function runCreatedText(createdAt: string | undefined): string | null {
  const date = new Date(createdAt ?? '');
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString(undefined, { timeStyle: 'short' })}`;
}

interface RunChoice {
  runId: string;
  sceneId: string;
  label?: string | null;
  createdAt: string;
  localWorkspaceId?: string;
}

/**
 * FU-7 / FC-8: distinguishable run choices — scene name, run label,
 * creation date and short time, plus "copy n" only when labels collide
 * within one (localWorkspaceId, sceneId) group, ordered by createdAt then
 * runId. Returned in the input order.
 */
export function runChoiceLabels<T extends RunChoice>(
  runs: readonly T[],
  sceneName: (run: T) => string
): string[] {
  const groupOf = (run: RunChoice) =>
    JSON.stringify([run.localWorkspaceId ?? '', run.sceneId]);
  const labelOf = (run: RunChoice) => run.label ?? 'Scene run';
  const groups = new Map<string, T[]>();
  for (const run of runs) {
    const group = groups.get(groupOf(run)) ?? [];
    group.push(run);
    groups.set(groupOf(run), group);
  }
  for (const group of groups.values())
    group.sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.runId.localeCompare(right.runId)
    );
  return runs.map(run => {
    const group = groups.get(groupOf(run)) ?? [run];
    const collides =
      group.filter(other => labelOf(other) === labelOf(run)).length > 1;
    const created = runCreatedText(run.createdAt);
    return [
      sceneName(run),
      labelOf(run),
      ...(created ? [created] : []),
      ...(collides ? [`copy ${group.indexOf(run) + 1}`] : []),
    ].join(' · ');
  });
}
