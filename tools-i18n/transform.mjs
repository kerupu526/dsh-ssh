// Rewrites dsh-ssh client sources: every user-visible Chinese literal becomes t("<zh text>", ...args).
// Keys are the original Chinese text; placeholders {} become {0}, {1}, ... in order.
import ts from 'typescript'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'src/client'
const translations = JSON.parse(readFileSync('tools-i18n/translations.json', 'utf8'))
const CJK = /[　-鿿＀-￯]/
const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') && f !== 'i18n.ts' && f !== 'locales.ts')
const missing = new Set()
const used = new Set()

const keyOf = (s) => { let i = 0; return s.replace(/\{\}/g, () => `{${i++}}`) }

for (const name of files) {
  const file = join(dir, name)
  const text = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const edits = []
  const record = (key) => { used.add(key); if (!(key in translations)) missing.add(key); }

  const visit = (node) => {
    if (ts.isStringLiteral(node) && CJK.test(node.text)) {
      const key = node.text
      record(key)
      const call = `t(${JSON.stringify(key)})`
      const isAttr = ts.isJsxAttribute(node.parent)
      edits.push({ start: node.getStart(sf), end: node.getEnd(), text: isAttr ? `{${call}}` : call })
      return
    }
    if (ts.isNoSubstitutionTemplateLiteral(node) && CJK.test(node.text)) {
      record(node.text)
      edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `t(${JSON.stringify(node.text)})` })
      return
    }
    if (ts.isTemplateExpression(node)) {
      const all = node.head.text + node.templateSpans.map((s) => '{}' + s.literal.text).join('')
      if (CJK.test(all)) {
        const key = keyOf(all)
        record(key)
        const args = node.templateSpans.map((s) => s.expression.getText(sf))
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `t(${[JSON.stringify(key), ...args].join(', ')})` })
        return
      }
    }
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf)
      const trimmed = raw.trim()
      if (CJK.test(trimmed)) {
        record(trimmed)
        const lead = raw.match(/^\s*/)[0]
        const trail = raw.match(/\s*$/)[0]
        const start = node.getStart(sf)
        edits.push({ start, end: node.getEnd(), text: `${lead}{t(${JSON.stringify(trimmed)})}${trail}` })
        return
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)

  if (edits.length === 0) continue
  // Apply from the end so earlier offsets stay valid.
  let out = text
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  // Add the import after the last import statement.
  const lastImport = [...out.matchAll(/^import .*$/gm)].pop()
  const importLine = "import { t } from './i18n.ts'"
  if (lastImport) {
    const at = lastImport.index + lastImport[0].length
    out = out.slice(0, at) + '\n' + importLine + out.slice(at)
  } else {
    out = importLine + '\n' + out
  }
  writeFileSync(file, out, 'utf8')
  console.log(name, 'edits:', edits.length)
}

console.log('distinct keys used:', used.size)
console.log('keys missing a translation:', missing.size)
for (const k of missing) console.log('  MISSING', JSON.stringify(k))
