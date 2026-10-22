/**
 * `/remote` and `/local`: switch the current session between the `remote`
 * agent preset (bash tool, for SSH workspaces) and the `standard` one. DSH only
 * lets a preset change before a session's first turn, so on a started session
 * the registry's refusal is shown as the command's error text.
 */

import type { Context } from '@deepseek-ai/cordis'

interface Invocation {
  readonly agent: unknown
  readonly rawInput: string
}

type Outcome = { kind: 'success' | 'error'; text: string }

interface CommandRegistry {
  register(definition: {
    name: string
    description: string
    handler: (invocation: Invocation) => Promise<Outcome>
  }): () => void
}

interface PresetRegistry {
  select(agent: unknown, preset: string): Promise<string>
}

/** The presets the commands switch between. */
const REMOTE_PRESET = 'remote'
const LOCAL_PRESET = 'standard'

/**
 * Plugin body: register the two commands once the command registry and the
 * preset registry are both available.
 * @param ctx - the mounting Cordis context.
 */
export function installPresetCommands(ctx: Context): void {
  ctx.inject(['commands', 'agentPresets'], (injected) => {
    const bag = injected as unknown as { commands: CommandRegistry; agentPresets: PresetRegistry }

    const switchTo = (preset: string, label: string) => async (invocation: Invocation): Promise<Outcome> => {
      if (invocation.rawInput.trim().length > 0) return { kind: 'error', text: `Usage: /${label} (no arguments)` }
      try {
        const committed = await bag.agentPresets.select(invocation.agent, preset)
        return { kind: 'success', text: `Agent preset: ${committed}` }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return {
          kind: 'error',
          text: `Could not switch to the "${preset}" preset (it can only change before the first message): ${reason}`,
        }
      }
    }

    injected.effect(function* () {
      yield bag.commands.register({
        name: 'remote',
        description: 'Use the remote (bash) agent preset for SSH workspaces',
        handler: switchTo(REMOTE_PRESET, 'remote'),
      })
      yield bag.commands.register({
        name: 'local',
        description: 'Use the standard agent preset for local workspaces',
        handler: switchTo(LOCAL_PRESET, 'local'),
      })
    }, 'dsh-ssh: preset commands')
  })
}
