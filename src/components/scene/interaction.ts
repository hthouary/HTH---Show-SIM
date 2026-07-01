/**
 * A `raycast` override that makes an object invisible to pointer picking, so
 * clicks pass straight through it to whatever is behind. Used on light beams,
 * laser beams, lens flares and FX particles — only the fixture body should be
 * selectable, not the light it throws.
 */
export const ignoreRaycast = () => null;
