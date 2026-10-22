/**
 * Routes subprocess calls between the local `subprocess` provider DSH already
 * mounts and the SSH backend. `subprocess` is a single-slot service, so this
 * module keeps it and wraps `spawn` / `spawnTerminal`: a call whose `cwd` names
 * an `ssh://<connection>/…` route (or the placeholder of a live connection)
 * runs remotely; every other call stays local.
 *
 * Any failure while choosing or starting the remote route is reported to the
 * caller; local calls are never touched, so a routing bug cannot take down the
 * local workspace.
 */

import { appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { connectionLookup, isSshRef } from './fs-router.ts'
import { SshSubprocessRuntime } from './subprocess.ts'

/**
 * A local absolute program path (`C:\...\bash.exe`, `/usr/bin/bash`) has no
 * meaning on the remote host, so keep only the bare program name for the
 * remote PATH lookup.
 */
export function remoteProgram(program: string): string {
  const name = program.split(/[\\/]/).pop() ?? program
  return name.replace(/\.(exe|cmd|bat|com)$/i, '')
}

/** The encoding preamble DSH prepends to every PowerShell command. */
const POWERSHELL_PREAMBLE = /^\s*\[Console\]::OutputEncoding\s*=[^;]*;\s*\$OutputEncoding\s*=[^;]*;\s*/

/**
 * DSH's Windows host runs commands as
 * `<DSH>.exe <dsh-sandbox runner.js> <sandbox flags> -- powershell -Command "<script>"`.
 * Neither the sandbox runner nor PowerShell exists on the remote host, so peel
 * both layers and run the inner script with the remote POSIX shell.
 */
function unwrapHostShell(argv: readonly string[]): readonly string[] {
  let inner = argv
  if (/dsh-sandbox[^\\/]*[\\/]/.test(argv[1] ?? '')) {
    const separator = argv.indexOf('--')
    if (separator === -1) return argv
    inner = argv.slice(separator + 1)
  }
  const [program, ...args] = inner
  if (program === undefined) return argv
  const shell = remoteProgram(program).toLowerCase()
  if (shell === 'powershell' || shell === 'pwsh') {
    const at = args.findIndex(arg => /^-c(ommand)?$/i.test(arg))
    const script = at === -1 ? undefined : args[at + 1]
    if (script !== undefined) return ['bash', '-c', script.replace(POWERSHELL_PREAMBLE, '')]
  }
  if (shell === 'cmd') {
    const at = args.findIndex(arg => /^\/c$/i.test(arg))
    const script = at === -1 ? undefined : args.slice(at + 1).join(' ')
    if (script !== undefined) return ['bash', '-c', script]
  }
  return inner
}

export function remoteArgv<T extends { argv: readonly string[] }>(spec: T): T {
  const unwrapped = unwrapHostShell(spec.argv)
  if (unwrapped !== spec.argv) spec = { ...spec, argv: unwrapped }
  const [program, ...rest] = spec.argv
  if (program === undefined) return spec
  const isLocalAbsolute = /^[A-Za-z]:[\\/]/.test(program) || program.startsWith('\\\\')
  return isLocalAbsolute ? { ...spec, argv: [remoteProgram(program), ...rest] } : spec
}

/** Temporary diagnostics: DSH_SSH_DEBUG=1 appends routed spawn specs to a log in the temp dir. */
function debugLog(kind: string, spec: { cwd?: unknown; argv: readonly string[]; env?: Record<string, string> }): void {
  if (process.env.DSH_SSH_DEBUG !== '1') return
  try {
    const line = JSON.stringify({ t: new Date().toISOString(), kind, cwd: spec.cwd, argv: spec.argv, envKeys: Object.keys(spec.env ?? {}) })
    appendFileSync(join(tmpdir(), 'dsh-ssh-debug.log'), `${line}\n`)
  } catch {
    // diagnostics must never break routing
  }
}

/**
 * Plugin body: wrap the mounted `subprocess` provider. Originals are restored
 * when this plugin unloads.
 * @param ctx - the mounting Cordis context.
 */
export function installSshSubprocessRouting(ctx: Context): void {
  ctx.inject(['subprocess', 'ssh'], (routed) => {
    const local = routed.subprocess as unknown as Record<string, unknown>
    const remote = new SshSubprocessRuntime(routed) as unknown as Record<string, unknown>
    const knows = connectionLookup(routed)
    const originals = new Map<string, unknown>()

    const wrap = (name: 'spawn' | 'spawnTerminal'): void => {
      const localFn = local[name] as (spec: unknown) => unknown
      const remoteFn = remote[name] as (spec: unknown) => unknown
      if (typeof localFn !== 'function' || typeof remoteFn !== 'function') return
      originals.set(name, localFn)
      local[name] = (spec: { cwd?: unknown; argv: readonly string[] }) => {
        if (!isSshRef(spec?.cwd, knows)) return localFn.call(local, spec)
        debugLog(name, spec)
        return remoteFn.call(remote, remoteArgv(spec))
      }
    }
    wrap('spawn')
    wrap('spawnTerminal')

    // `resolveExecutable` carries no cwd, so it cannot be routed. A bare name that
    // is missing on this host may still exist on the remote one: hand it back
    // unresolved and let the (routed) spawn do the PATH lookup there.
    const localResolve = local.resolveExecutable as (...args: unknown[]) => Promise<string>
    if (typeof localResolve === 'function') {
      originals.set('resolveExecutable', localResolve)
      local.resolveExecutable = async (command: string, ...rest: unknown[]) => {
        try {
          return await localResolve.call(local, command, ...rest)
        } catch (error) {
          if (/[\\/]/.test(command) || command.length === 0) throw error
          return command
        }
      }
    }

    routed.effect(() => () => {
      for (const [name, fn] of originals) local[name] = fn
    }, 'dsh-ssh: subprocess routing')
  })
}
