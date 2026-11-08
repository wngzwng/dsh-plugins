import { createHostService, registerHostRoutes } from './host-service.js';

export const inject = ['connection'];

/** Authenticated owner-only bridge; no GitHub requests happen until a user action. */
export function apply(ctx) {
  const service = createHostService();
  ctx.effect(() => () => service.dispose(), 'knowledge-tree: discard session credential');
  registerHostRoutes(ctx, service);
}
