// NOTE: this is a deliberate copy of the same helper in Audience-Interface.
// The two repos share no code, and the presets MUST stay identical in both -
// the same talent avatar is rendered by both apps, and differing widths would
// generate a second derived asset on Cloudinary from the same source. Free
// plan, so derived storage and transformation counts are quota'd.
//
// Cloudinary serves the untouched original unless the delivery URL carries a
// transform segment. Nothing in either app added one, so avatars rendered at
// 32px were being sent full-resolution PNGs.

export type ImageSize = 'avatar' | 'card' | 'gallery' | 'hero';

const WIDTHS: Record<ImageSize, number> = {
  avatar: 160,   // small sidebar/list avatars at 2x DPI
  card: 600,     // artist listing cards, and the 128px profile photo editor
  gallery: 800,  // gallery grids and cover previews
  hero: 1600,    // ArtistDetail banner - the LCP element
};

const UPLOAD = '/image/upload/';

/**
 * Inserts f_auto,q_auto,w_<preset> into a Cloudinary delivery URL.
 *
 * Returns the input unchanged for anything that is not a plain Cloudinary
 * delivery URL - local assets, Google OAuth avatars, an already transformed
 * URL - so call sites never have to check first. Returns undefined for an
 * empty value, which omits the src attribute rather than emitting src=""
 * (that re-requests the page itself).
 */
export const cldImage = (
  url: string | null | undefined,
  size: ImageSize,
): string | undefined => {
  if (!url) return undefined;

  const at = url.indexOf(UPLOAD);
  if (at === -1) return url;

  const tail = url.slice(at + UPLOAD.length);

  // An untransformed delivery URL has the version next: /image/upload/v123/...
  // Anything else already carries a transform, so leave it rather than
  // stacking a second one on top.
  if (!/^v\d+\//.test(tail)) return url;

  return `${url.slice(0, at + UPLOAD.length)}f_auto,q_auto,w_${WIDTHS[size]}/${tail}`;
};