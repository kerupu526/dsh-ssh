// Smoke test: loads the built browser bundle with a mock loader, registers dictionaries, and checks translations.
import { readFileSync } from 'node:fs'

let loaded = null
globalThis.window = { __ModuleLoader__: { load(spec) { loaded = spec } } }
globalThis.document = undefined
new Function(readFileSync('lib/client.js', 'utf8'))()

const stub = new Proxy({}, { get: () => () => ({}) })
const mod = loaded.factory((name) => stub)
console.log('id:', loaded.id, 'inject:', mod.inject)

const registered = {}
const effects = []
const ctx = {
  effect(fn, label) { effects.push(label); fn() },
  on() { return () => {} },
  get() { return undefined },
  slots: { inject: () => () => {}, register: () => () => {} },
  locale: {
    register(ns, id, dict) { registered[`${ns}:${id}`] = dict; return () => {} },
    bind(ns) {
      const dict = registered[`${ns}:ko`] ?? {}
      return (key) => dict[key] ?? key
    },
  },
}
mod.apply(ctx)
console.log('registered:', Object.keys(registered).join(', '))
console.log('effects:', effects.join(' | '))
const ko = registered['dsh-ssh:ko']
console.log('ko keys:', Object.keys(ko).length)
console.log('sample ko:', ko['新建远程连接'], '|', ko['已识别 {0} → {1}{2}{3}'])
