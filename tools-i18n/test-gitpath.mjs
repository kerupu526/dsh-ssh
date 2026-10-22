// Regression: a placeholder-root path naming no live connection (e.g. <root>/.git) must stay local.
import { installSshRouting } from '../lib/fs-router.js'
import { parseSshTargetKey } from '../lib/transport.js'
import { homedir } from 'node:os'
import { join } from 'node:path'

const local = {
  async resolve(path) { return { via: 'local', path } },
  async readText(target) { return { via: 'local', target } },
}
let live = new Set()
installSshRouting({
  inject(names, cb) {
    cb({
      fs: local, ssh: {},
      get: (name) => name === 'sshRegistry' ? { get: (id) => (live.has(id) ? {} : undefined) } : undefined,
      effect(fn) { return fn() },
    })
  },
})

const root = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'dsh-ssh-routes')
const candidates = [
  join(root, '.git'),
  join(root, '.git', 'HEAD'),
  join(root, 'ghost', 'repo'),
  'D:\work\proj\.git',
  '.git',
  '/home/u/proj/.git',
]
for (const c of candidates) {
  const r = await local.readText({ targetKey: c }).catch((e) => ({ via: 'ssh', error: e.message }))
  console.log(r.via === 'local' ? 'ok  ' : 'FAIL', 'unknown id stays local:', c, '| parsed id:', parseSshTargetKey(c).connectionId)
}
live = new Set(['live1'])
const placeholder = join(root, 'live1', 'home')
const r = await local.readText({ targetKey: placeholder }).catch((e) => ({ via: 'ssh', error: e.message }))
console.log(r.via === 'ssh' ? 'ok  ' : 'FAIL', 'registered id routes to ssh:', placeholder, '|', r.error ?? JSON.stringify(r))
