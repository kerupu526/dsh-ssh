import { remoteArgv } from '../lib/subprocess-router.js'
import { readFileSync } from 'node:fs'
const B = String.fromCharCode(92)
const w = (...p) => p.join(B)
const runner = w('C:', 'Users', 'GMIN', 'AppData', 'Local', 'Programs', 'DeepSeek Harness', 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-sandbox-windows-acl', 'lib', 'runner.js')
const pre = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false); '
const wrapped = [w('C:', 'Users', 'GMIN', 'DeepSeek Harness.exe'), runner, '--workspace', 'x', '--mode', 'workspace-write', '--', w('C:', 'Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', pre + 'hostname; uname -a']
const out = remoteArgv({ argv: wrapped }).argv
console.log(JSON.stringify(out) === JSON.stringify(['bash', '-c', 'hostname; uname -a']) ? 'ok  ' : 'FAIL', 'sandbox+powershell ->', JSON.stringify(out))
console.log(JSON.stringify(remoteArgv({ argv: [w('C:', 'Program Files', 'Git', 'cmd', 'git.EXE'), 'status'] }).argv) === '["git","status"]' ? 'ok  git.EXE -> git' : 'FAIL git')
console.log(JSON.stringify(remoteArgv({ argv: ['/usr/bin/ls', '-l'] }).argv) === '["/usr/bin/ls","-l"]' ? 'ok  posix path untouched' : 'FAIL posix')
