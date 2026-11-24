/**
 * Pure helpers for direct-video posters. Convention: a poster for
 * `<folder>/<name>.mp4` lives beside it at `<folder>/<name>.poster.jpg`.
 * No React/Next imports so tests and scripts can use it.
 */
export const isDirectVideoUrl = (url: string): boolean =>
  /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);

export function posterUrlFor(url: string): string | null {
  if (!isDirectVideoUrl(url)) return null;
  const bare = url.split(/[?#]/)[0];
  return bare.replace(/\.[a-zA-Z0-9]+$/, '.poster.jpg');
}
