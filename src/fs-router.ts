/**
 * Routes filesystem calls between the local `fs` provider (the sandboxed one
 * DSH already mounts) and the SSH backend. DSH has one `fs` service, so this
 * module keeps that service as-is and wraps its public methods: a call whose
 * path, target, or working directory names an `ssh://<connection>/…` route (or
 * its local placeholder) goes to `SshFileSystem`; every other call stays local.
 */

import type { Context } from '@deepseek-ai/cordis'
import { SshFileSystem } from './filesystem-final.ts'
import { parseSshTargetKey } from './transport.ts'

/** The public `FileSystem` methods the router intercepts. */
const ROUTED_METHODS = [
  'contains',
  'editText',
  'fileUrl',
  'listDir',
  'lstat',
  'processPath',
  'processPathFromHostPath',
  'readByteRange',
  'readBytes',
  'readText',
  'resolve',
  'stat',
  'streamText',
  'watch',
  'writeText',
] as const

/** True for an `ssh://` route, a local route placeholder, or a target key carrying either. */
function isSshRef(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.startsWith('ssh://') || parseSshTargetKey(value).connectionId !== undefined
  }
  if (value !== null && typeof value === 'object' && 'targetKey' in value) {
    return isSshRef((value as { targetKey: unknown }).targetKey)
  }
  return false
}

/**
 * A call routes over SSH when its first argument names an SSH route, or when its
 * options carry an SSH `cwd` (relative paths resolve against that cwd).
 */
function routesToSsh(args: unknown[]): boolean {
  const [first, second] = args
  if (isSshRef(first)) return true
  if (second !== null && typeof second === 'object' && 'cwd' in second) {
    return isSshRef((second as { cwd: unknown }).cwd)
  }
  return false
}

/**
 * Plugin body: wrap the existing `fs` provider so SSH routes are served by
 * `SshFileSystem`. Originals are restored when this plugin unloads.
 * @param ctx - the mounting Cordis context.
 */
export function installSshRouting(ctx: Context): void {
  ctx.inject(['fs', 'ssh'], (routed) => {
    const local = routed.fs as unknown as Record<string, unknown>
    const remote = new SshFileSystem(routed) as unknown as Record<string, unknown>
    const originals = new Map<string, unknown>()

    for (const name of ROUTED_METHODS) {
      const localFn = local[name]
      const remoteFn = remote[name]
      if (typeof localFn !== 'function' || typeof remoteFn !== 'function') continue
      originals.set(name, localFn)
      local[name] = (...args: unknown[]) => (
        routesToSsh(args)
          ? (remoteFn as (...a: unknown[]) => unknown).apply(remote, args)
          : (localFn as (...a: unknown[]) => unknown).apply(local, args)
      )
    }

    routed.effect(() => () => {
      for (const [name, fn] of originals) local[name] = fn
    }, 'dsh-ssh: fs routing')
  })
}
