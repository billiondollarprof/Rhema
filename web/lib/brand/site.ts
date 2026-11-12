/*
 * lib/brand/site.ts: is this the testing site?
 *
 * Why: Anthony, 2026-11-12: "the testing site should not force anybody to
 * install, and it should not force you to turn on the alert. I don't want to
 * install the testing site into my tablet." So on the testing address the
 * install and alerts cards stay away. The live site is untouched.
 *
 * The address decides, not a build setting, so a testing build moved to
 * another address would still behave as the live one.
 *
 * Never: treat the live address as testing.
 */
export function onTestingSite(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host.startsWith('testing.') || /^rhema-hospital-testing\./.test(host)
}
