// Router test: local cwd -> local spawn; ssh:// or live placeholder cwd -> remote spawn (argv[0] remapped).
import { installSshSubprocessRouting } from '../lib/subprocess-router.js'

const calls = []
const local = {
  spawn(spec) { calls.push(['local-spawn', spec.cwd]); return { via: 'local' } },
  async spawnTerminal(spec) { calls.push(['local-term', spec.cwd]); return { via: 'local' } },
  async resolveExecutable(cmd) { if (cmd === 'bash') throw new Error('not found'); return cmd },
}
const orig = { ...local }
let dispose
const live = new Set(['c2'])
installSshSubprocessRouting({
  inject(names, cb) {
    cb({
      subprocess: local, ssh: {},
      get: (n) => n === 'sshRegistry' ? { get: (id) => (live.has(id) ? {} : undefined) } : undefined,
      effect(fn) { dispose = fn(); return dispose },
    })
  },
})
const base = { argv: ['x'], graceMs: 100 }
const show = (label, ok, extra = '') => console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} ${extra}`)

const WIN = (...parts) => parts.join(String.fromCharCode(92))
show('local cwd stays local', local.spawn({ ...base, cwd: WIN('D:', 'work') }).via === 'local')
show('undefined cwd stays local', local.spawn({ ...base }).via === 'local')
show('.git placeholder stays local', local.spawn({ ...base, cwd: WIN('C:', 'Users', 'u', '.dsh', 'dsh-ssh-routes', '.git') }).via === 'local')
for (const cwd of ['ssh://c2/home/u', 'ssh://ghost/home/u']) {
  try { local.spawn({ ...base, cwd, argv: [WIN('C:', 'Windows', 'bash.exe'), '-c', 'ls'] }); show('ssh cwd ' + cwd, false, 'resolved locally') }
  catch (e) { show('ssh cwd ' + cwd + ' routed remote', !calls.some(c => c[1] === cwd), '(' + e.message.slice(0, 70) + ')') }
}
show('resolveExecutable bare fallback', (await local.resolveExecutable('bash')) === 'bash')
let threw = false; try { await local.resolveExecutable('/nope/bash') ; } catch { threw = true }
show('resolveExecutable passes through found/absolute', !threw)
dispose?.()
show('originals restored', local.spawn === orig.spawn && local.resolveExecutable === orig.resolveExecutable)
