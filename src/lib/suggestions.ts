import type { DoctlContext } from "./args.js";

/**
 * Build one contextual next-step suggestion (AXI principle 9): a complete
 * `doctl-axi` command that carries the invocation's `--context` forward so
 * follow-ups stay scoped to the same account. Non-CLI hints (env setup,
 * `kubectl`, usage notes) bypass this helper.
 *
 * @param ctx    resolved CLI context (undefined outside a command invocation)
 * @param command subcommand path. Pass it WITHOUT the `doctl-axi` prefix —
 *                the prefix is added here (an existing one is preserved, not
 *                doubled) so callers never hand-maintain the binary name.
 * @param why    optional trailing rationale, e.g. "for detail"
 */
export function suggest(ctx: DoctlContext | undefined, command: string, why?: string): string {
  const scoped = ctx?.context ? `${command} --context ${ctx.context}` : command;
  const prefixed = scoped.startsWith("doctl-axi ") ? scoped : `doctl-axi ${scoped}`;
  return why ? `${prefixed} ${why}` : prefixed;
}
