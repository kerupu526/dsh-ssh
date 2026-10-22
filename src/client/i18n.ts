/**
 * Translation seam for the client UI. Visible strings are written as their
 * original Chinese text and passed through `t`; the locale service supplies the
 * active language's dictionary (`ctx.locale.bind`). Without a locale service,
 * or for a language with no entry, the original text is shown.
 */

/** The dictionary namespace this plugin registers with the locale service. */
export const NS = 'dsh-ssh'

/** Resolves a key in the active language; returns the key when no entry exists. */
export type Translate = (key: string) => string

let translate: Translate = (key) => key

/** Installed by the plugin's apply once the locale service is available. */
export function setTranslate(next: Translate): void {
  translate = next
}

/**
 * Translates a Chinese source string and fills its numbered placeholders
 * (`{0}`, `{1}`, ...) with the given values.
 * @param key - the original Chinese text.
 * @param args - values for the placeholders, in order.
 * @returns the localized string.
 */
export function t(key: string, ...args: unknown[]): string {
  return translate(key).replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = args[Number(index)]
    return value === undefined ? match : String(value)
  })
}
