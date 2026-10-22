import { installPresetCommands } from '../lib/preset-command.js'
const registered = {}
const selected = []
let fail = false
installPresetCommands({
  inject(names, cb) {
    cb({
      commands: { register: (d) => { registered[d.name] = d.handler; return () => {} } },
      agentPresets: { select: async (agent, id) => { if (fail) throw new Error('session already started'); selected.push(id); return id } },
      effect(fn) { for (const dispose of fn()) void dispose },
    })
  },
})
const a = await registered.remote({ agent: {}, rawInput: '' })
const b = await registered.local({ agent: {}, rawInput: '' })
fail = true
const c = await registered.remote({ agent: {}, rawInput: '' })
const d = await registered.remote({ agent: {}, rawInput: ' x' })
console.log(a.kind === 'success' && selected[0] === 'remote' ? 'ok  ' : 'FAIL', '/remote ->', a.text)
console.log(b.kind === 'success' && selected[1] === 'standard' ? 'ok  ' : 'FAIL', '/local ->', b.text)
console.log(c.kind === 'error' ? 'ok  ' : 'FAIL', 'started session ->', c.text)
console.log(d.kind === 'error' ? 'ok  ' : 'FAIL', 'extra args ->', d.text)
