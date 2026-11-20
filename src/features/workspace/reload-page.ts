/**
 * Reloads the document, one tick late.
 *
 * The delay is not superstition: a reload issued the instant `controllerchange` fires
 * can still be served by the outgoing worker's cache, which shows the version the user
 * was trying to leave. Letting the current task finish first avoids that race.
 */
export function reloadPage(): void {
  window.setTimeout(() => window.location.reload(), 0)
}
