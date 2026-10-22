// Reproduction: an ssh2 server accepts a login, then resets the TCP socket after ready.
// Without a persistent 'error' listener on the client this is an uncaught exception.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { Server } = require('ssh2')
const { SshConnection } = await import('../lib/connection.js')

const hostKey = readFileSync(join(process.env.TEMP, 'sshtest', 'hostkey'))
const server = new Server({ hostKeys: [hostKey] }, (client) => {
  client.on('authentication', (ctx) => ctx.accept())
  client.on('ready', () => {
    setTimeout(() => { client._sock.resetAndDestroy() }, 300)
  })
  client.on('error', () => {})
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()

process.on('uncaughtException', (error) => {
  console.log('CRASH uncaughtException:', error.code, error.message, '| level:', error.level)
  process.exit(2)
})

const connection = new SshConnection({
  id: 'reset-test', label: 'reset-test', host: '127.0.0.1', port, username: 'u', password: 'p',
})
const client = await connection.getClient()
console.log('connected; waiting for the server to reset the socket…')
await new Promise((resolve) => setTimeout(resolve, 1500))
console.log('SURVIVED: no uncaught exception after socket reset')
server.close()
process.exit(0)
