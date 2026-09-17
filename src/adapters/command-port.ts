import type { ActionCommandEnvelope } from "../contracts/ce-di.js";

export type CommandBoundaryResult = unknown;
export type CommandHandler = (
  envelope: ActionCommandEnvelope,
) => Promise<CommandBoundaryResult>;

export interface CommandPort {
  execute(envelope: ActionCommandEnvelope): Promise<CommandBoundaryResult>;
}

export const createInProcessCommandPort = (
  handler: CommandHandler,
): CommandPort => ({
  execute: (envelope) => handler(envelope),
});
