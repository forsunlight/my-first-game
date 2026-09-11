import type { GameEngine } from './engine';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerGameTools(engine: GameEngine) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const life = new AbortController();
  const empty = (input: unknown) => {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length
    )
      throw new Error('Expected an empty object.');
  };
  const tools: Tool[] = [
    {
      name: 'get_game_state',
      description:
        'Read the current battle status, health, equipped weapon and remaining enemies.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        empty(input);
        return engine.snapshot();
      },
    },
    {
      name: 'start_new_game',
      description:
        'Start a fresh battle with a random rooftop spawn and AI teammate. Replaces any current battle.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        empty(input);
        engine.start();
        return engine.snapshot();
      },
    },
    {
      name: 'command_teammate',
      description:
        'Tell the AI teammate to follow the player or hold position and provide cover during a running battle.',
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['follow', 'cover'] } },
        required: ['mode'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
          throw new Error('Expected mode: follow or cover.');
        const value = input as Record<string, unknown>;
        if (
          Object.keys(value).length !== 1 ||
          (value.mode !== 'follow' && value.mode !== 'cover')
        )
          throw new Error('Expected mode: follow or cover.');
        if (engine.snapshot().status !== 'playing')
          throw new Error('Start or resume the battle first.');
        if (engine.snapshot().mode !== value.mode) engine.command();
        return engine.snapshot();
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: life.signal }),
      ).catch(() => {});
    } catch {
      /* Optional proposed API, unsupported browsers retain all game controls. */
    }
  }
  return () => life.abort();
}
