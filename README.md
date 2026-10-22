# dsh-ssh

English | [한국어](README.ko.md) | [中文](README.zh.md)

<p align="center">
  <img src="https://img.shields.io/npm/v/dsh-ssh" alt="npm version">
  <img src="https://img.shields.io/npm/l/dsh-ssh" alt="license">
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933" alt="node version">
  <img src="https://img.shields.io/github/stars/UynajGI/dsh-ssh" alt="GitHub stars">
</p>

**SSH remote-execution plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).** Runs Bash, file tools, PTY terminals and LSP on a remote host over one SSH connection — ProxyJump chains, SFTP, full auth. Built on [ssh2](https://github.com/mscdex/ssh2).

![Add a workspace over SSH](docs/images/add-workspace.png)

## Install

```sh
dsh plugin --profile web add dsh-ssh
```

Or use the Web UI: **Plugins → Add plugin → `dsh-ssh`**. The bundle mounts the SSH providers and takes over the **Add workspace** flow — create real connections there. Needs DeepSeek Harness 0.2.x and Node ≥ 22.

A plain `npm i dsh-ssh` does not select the bundle; add it to `dsh.profile.bundles` yourself.

## Configure

Only needed when composing providers by hand (`cordis.yml`):

```yaml
- id: ssh-remote
  name: dsh-ssh
  config:
    host: server.example.com        # or a ~/.ssh/config alias
    username: root
    privateKey: ~/.ssh/id_ed25519   # path or PEM
    cwd: /root/workspace
    # jump:
    #   - { host: bastion.example.com, privateKey: ~/.ssh/id_ed25519 }
```

| Field | Default | Notes |
|---|---|---|
| `host` `username` `cwd` | — | required (`cwd` is an absolute POSIX path) |
| `port` | 22 | |
| `password` `privateKey` `passphrase` `agent` | — | any auth mode; falls back to `~/.ssh` identities |
| `jump` | `[]` | ProxyJump chain, independent auth per hop |
| `readyTimeout` `keepaliveInterval` `keepaliveCountMax` | 45000 / 0 / 3 | milliseconds |
| `strictHostKeyChecking` `knownHosts` | false / `[]` | host-key verification |

> **Local + remote:** `subprocess` and `fs` are single-slot services, so this build keeps the mounted local providers and routes only SSH calls (an `ssh://` path, or a working directory that names a live connection) to the remote host. Local workspaces stay local; no profile patch is needed. On a Windows host, pick the `remote` agent preset (or run `/remote` before the first message) so the agent uses bash instead of PowerShell.

## Limitations

- Remote pid is always `-1`; `terminate` doesn't reap descendants (SSH can't).
- The SSH link doesn't auto-reconnect after a drop — recreate the connection.
- `streamText` is text-only; remote sessions aren't added to the local workspace registry.

## Development

```sh
npm i
npm run typecheck
npm run build   # emits lib/ — the payload the harness loader imports
```

## License

MIT
