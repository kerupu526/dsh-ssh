// Lists every user-visible Chinese literal in dsh-ssh client sources (strings, JSX text, templates).
import ts from 'typescript'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'src/client'
const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts')).map((f) => join(dir, f))
const CJK = /[　-鿿＀-￯]/
const rows = []

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const visit = (node) => {
    const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    const where = `${file}:${pos.line + 1}`
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (CJK.test(node.text)) {
        const parent = node.parent
        const kind = ts.isJsxAttribute(parent) ? 'attr' : ts.isImportDeclaration(parent.parent ?? parent) ? 'import' : 'js'
        rows.push({ where, kind, text: node.text, raw: node.getText(sf) })
      }
    } else if (ts.isTemplateExpression(node)) {
      const all = node.head.text + node.templateSpans.map((s) => '{}' + s.literal.text).join('')
      if (CJK.test(all)) rows.push({ where, kind: 'template', text: all, raw: node.getText(sf).slice(0, 160) })
    } else if (ts.isJsxText(node)) {
      const t = node.getText(sf).trim()
      if (CJK.test(t)) rows.push({ where, kind: 'jsx', text: t, raw: t })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

const unique = new Set(rows.map((r) => r.text))
console.log(JSON.stringify({ total: rows.length, unique: unique.size }))
for (const r of rows) console.log(`${r.where}\t${r.kind}\t${r.text}`)
