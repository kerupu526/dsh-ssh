// Routing test: local calls stay local; ssh:// targets, placeholders, and ssh cwd values reach SshFileSystem.
import { installSshRouting } from '../lib/fs-router.js'

const local = {
  async resolve(path, opts) { return { via: 'local', path, cwd: opts?.cwd } },
  async readText(target) { return { via: 'local', target } },
  async writeText(target, content) { return { via: 'local', target, content } },
  processPath(target) { return `local:${target.targetKey ?? target}` },
}
const originalResolve = local.resolve

let disposer = null
const ctx = {
  inject(names, cb) {
    cb({
      fs: local,
      ssh: {},
      get: () => undefined,
      effect(fn) { disposer = fn(); return disposer },
    })
  },
}
installSshRouting(ctx)

const expectLocal = async (label, promise) => {
  const value = await promise
  console.log(`${value?.via === 'local' ? 'ok  ' : 'FAIL'} ${label} -> ${JSON.stringify(value)}`)
}
const expectSsh = async (label, promise) => {
  try {
    const value = await promise
    console.log(`FAIL ${label} resolved locally -> ${JSON.stringify(value)}`)
  } catch (error) {
    const ok = String(error.message).includes('unknown connection')
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} -> routed to ssh (${error.message})`)
  }
}

await expectLocal('resolve local path', local.resolve('/tmp/a'))
await expectLocal('readText local target', local.readText({ targetKey: '/home/u/file' }))
await expectLocal('writeText local target', local.writeText({ targetKey: '/home/u/file' }, 'x'))
await expectLocal('resolve relative with local cwd', local.resolve('a.txt', { cwd: '/home/u' }))
await expectSsh('resolve ssh path', local.resolve('ssh://abc/home/u/a.txt'))
await expectSsh('readText ssh target', local.readText({ targetKey: 'ssh://abc/home/u/a.txt' }))
await expectSsh('writeText ssh target', local.writeText({ targetKey: 'ssh://abc/home/u/a.txt' }, 'x'))
await expectSsh('resolve relative with ssh cwd', local.resolve('a.txt', { cwd: 'ssh://abc/home/u' }))

disposer?.()
console.log(local.resolve === originalResolve ? 'ok   originals restored after dispose' : 'FAIL originals not restored')
