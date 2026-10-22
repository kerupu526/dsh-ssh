# dsh-ssh (한국어 포크)

[English](README.md) | 한국어 | [中文](README.zh.md)

[UynajGI/dsh-ssh](https://github.com/UynajGI/dsh-ssh)의 포크입니다. **[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)에서 SSH로 원격 서버에 접속해 작업하는 플러그인**이며, 원본의 기능에 아래 변경을 더했습니다.

## 이 포크가 바꾼 것

- **한국어 UI**: 연결 폼, 사이드바, 오류 문구를 DSH 로케일 서비스로 번역했습니다. 한국어(`ko`)와 영어(`en`)를 제공하고, 원문(중국어)은 기본값입니다. 언어 선택은 DSH의 언어 설정을 따릅니다. 한국어 화면을 쓰려면 DSH 한국어 언어팩 플러그인도 설치해야 합니다.
- **로컬과 원격을 한 프로필에서 혼용**: 원본은 `fs`와 `subprocess`를 대체하는 방식이라 로컬 제공자를 꺼야 했습니다. 이 포크는 로컬 서비스를 그대로 두고, 작업 폴더가 SSH 연결일 때만 원격으로 보냅니다.
  - 파일 읽기/쓰기(`fs`): `ssh://<연결>/경로` 또는 등록된 연결의 자리표시자 경로일 때 원격으로 보냅니다. 그 외 경로는 로컬입니다.
  - 명령 실행과 터미널(`subprocess`): 작업 폴더(`cwd`)가 원격 연결이면 원격으로 보냅니다. Windows 호스트가 명령을 감싸는 샌드박스 실행기와 PowerShell 껍데기는 벗겨 내고 원격 `bash -c`로 실행합니다.
- **`remote` 에이전트 프리셋**: PowerShell 도구 대신 bash 도구를 쓰는 프리셋입니다. Windows 호스트에서 원격 Linux 작업공간을 쓸 때 선택합니다.
- **`/remote`, `/local` 명령**: 세션의 첫 메시지를 보내기 전에 프리셋을 `remote`/`standard`로 바꿉니다.
- **안정성**: 연결이 끊길 때(`ECONNRESET` 등) 호스트가 종료되던 문제를 막았습니다.

## 설치

`dsh-ssh`와 같은 방식으로 프로필에 추가합니다. 이 포크는 아직 npm에 올라가 있지 않으므로 저장소를 내려받아 로컬 링크로 설치합니다.

```sh
git clone -b feat/i18n-ko https://github.com/kerupu526/dsh-ssh.git
cd dsh-ssh
npm i
npm run build
```

그다음 프로필의 `package.json` 의존성에 `"dsh-ssh": "link:<경로>/dsh-ssh"`를 넣고, `dsh.profile.bundles`에 `dsh-ssh`를 추가합니다. DSH 데스크톱 앱은 완전히 종료한 뒤 다시 실행해야 반영됩니다.

## 사용법

1. **작업공간 추가**에서 새 원격 연결을 만듭니다. 호스트는 서버의 IP나 호스트 이름(Tailscale 주소도 가능)입니다.
2. Windows 호스트에서 원격 작업공간을 쓸 때는 새 세션에서 첫 메시지 전에 `/remote`를 입력하거나 에이전트 프리셋을 `remote`로 선택합니다. 로컬 작업공간에서는 `/local`(또는 `standard`)을 씁니다.
3. 인증은 비밀번호, 키, 에이전트를 지원합니다. 비밀번호 방식의 연결은 `~/.dsh/dsh-ssh-connections.json`에 저장됩니다.

## 제한 사항

- **원격은 POSIX(Linux, macOS)만 지원합니다.** 원격이 Windows(OpenSSH)이면 `cd`, 경로, 명령어 처리가 맞지 않습니다.
- 로컬 호스트가 Windows이면 터미널 종류 판별(`terminalEnvironment`)을 원격으로 보낼 수 없어서, PowerShell 문법으로 된 명령은 원격에서 실패합니다. `remote` 프리셋을 쓰면 피할 수 있습니다.
- 로컬에서 찾지 못한 실행 파일 이름(`resolveExecutable`)은 오류 대신 이름 그대로 돌려주고, 실제 탐색은 원격에서 합니다.
- 원본의 제한도 그대로입니다: 원격 pid는 항상 `-1`이고, 연결이 끊기면 자동 재연결하지 않으며, `streamText`는 텍스트 전용입니다.
- 서버가 공개키를 모르면 비밀번호 인증이 필요합니다. `All configured authentication methods failed`는 인증 방식이 서버와 맞지 않을 때 나옵니다.

## 개발

```sh
npm i
npm run typecheck
npm run build
```

`tools-i18n/`에 번역 사전 생성 스크립트와 라우팅 테스트(`test-*.mjs`)가 있습니다. 라우팅 테스트는 `npm run build` 후 `node tools-i18n/test-router.mjs`처럼 실행합니다.

## 라이선스

MIT. 원본 저작권은 원 저작자에게 있습니다.
