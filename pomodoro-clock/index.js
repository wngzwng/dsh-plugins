/**
 * Host half of the Pomodoro Clock bundle.
 *
 * The timer, its rendering and its settings all live in the browser half
 * (`client.js`), which registers an ambient entry in the composer dock. This
 * row exists so the bundle is a normal Loader plugin with an inventory entry,
 * display metadata and an icon; it registers no Host service.
 */
export function apply() {}
