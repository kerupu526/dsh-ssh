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

/** Answers whether a registry connection with this id exists. */
export type KnowsConnection = (id: string) => boolean

/** Builds the registry lookup used to decide whether a placeholder names a live connection. */
export function connectionLookup(ctx: Context): KnowsConnection {
  return (id) => {
    const registry = ctx.get('sshRegistry') as { get(id: string): unknown } | undefined
    return registry?.get(id) !== undefined
  }
}

/**
 * True for an explicit `ssh://` route, or for a local route placeholder whose
 * connection exists. A path under the placeholder root that names no live
 * connection (for example `<root>/.git`) is an ordinary local path.
 */
export function isSshRef(value: unknown, knows: KnowsConnection): boolean {
  if (typeof value === 'string') {
    if (value.startsWith('ssh://')) return true
    const { connectionId } = parseSshTargetKey(value)
    return connectionId !== undefined && knows(connectionId)
  }
  if (value !== null && typeof value === 'object' && 'targetKey' in value) {
    return isSshRef((value as { targetKey: unknown }).targetKey, knows)
  }
  return false
}

/**
 * A call routes over SSH when its first argument names an SSH route, or when its
 * options carry an SSH `cwd` (relative paths resolve against that cwd).
 */
function routesToSsh(args: unknown[], knows: KnowsConnection): boolean {
  const [first, second] = args
  if (isSshRef(first, knows)) return true
  if (second !== null && typeof second === 'object' && 'cwd' in second) {
    return isSshRef((second as { cwd: unknown }).cwd, knows)
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
    const knows = connectionLookup(routed)

    for (const name of ROUTED_METHODS) {
      const localFn = local[name]
      const remoteFn = remote[name]
      if (typeof localFn !== 'function' || typeof remoteFn !== 'function') continue
      originals.set(name, localFn)
      local[name] = (...args: unknown[]) => (
        routesToSsh(args, knows)
          ? (remoteFn as (...a: unknown[]) => unknown).apply(remote, args)
          : (localFn as (...a: unknown[]) => unknown).apply(local, args)
      )
    }

    routed.effect(() => () => {
      for (const [name, fn] of originals) local[name] = fn
    }, 'dsh-ssh: fs routing')
  })
}
