/**
 * Rendered while the first route's code loads. It draws nothing on purpose:
 * the static boot screen from index.html stays in place until the page is
 * ready, so there is never a flash of an empty shell.
 */
export function RouteFallback() {
  return null;
}
