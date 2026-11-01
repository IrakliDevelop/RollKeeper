/** A value the page prints, tagged so a play function can read it back. */
export function Measured({ id, value }: { id: string; value: string }) {
  return <span data-measure={id}>{value}</span>;
}

/** The text a `Measured` span shows; `undefined` until it renders. */
export function measured(root: ParentNode, id: string) {
  return root.querySelector(`[data-measure="${id}"]`)?.textContent;
}
