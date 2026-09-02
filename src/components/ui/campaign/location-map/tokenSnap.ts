/**
 * zIndex stamped on every token element (DM combatant tokens and player
 * self-tokens). Players mirror unknown remote layers at `order: -1`
 * (PlayerBattleMapCanvas), and the SDK breaks (layerOrder, zIndex) ties by
 * element-arrival order — after a resync, a token can land beneath the map
 * background (zIndex 0). Elevating tokens above every map-background
 * element guarantees they always paint on top, regardless of arrival order.
 * Single source of truth: dm-vtt/combatantToken.ts re-exports this value as
 * COMBATANT_TOKEN_ZINDEX (location-map must not import from dm-vtt).
 */
export const TOKEN_ELEMENT_ZINDEX = 1000;

/** Templates paint above the map background, below tokens. */
export const TEMPLATE_ELEMENT_ZINDEX = 900;

/**
 * Markers paint above templates and below tokens.
 *
 * Same hazard as `TOKEN_ELEMENT_ZINDEX` above, for the same reason: a marker
 * left at the `createHtmlElement` default of `zIndex: 0` ties with every map
 * background element, and the SDK breaks `(layerOrder, zIndex)` ties by
 * arrival order — so after a resync a pin can land UNDERNEATH the map image
 * and become invisible and unclickable. Kept in this file so the whole band
 * table (`900` templates < `950` markers < `1000` tokens) is auditable in one
 * place rather than scattered across the modules that stamp it.
 */
export const MARKER_ELEMENT_ZINDEX = 950;
