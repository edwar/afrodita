/**
 * three r183+ deprecó THREE.Clock. @react-three/fiber@9 todavía lo crea
 * internamente y emite un warning en consola. No afecta funcionalidad;
 * solo filtramos ese mensaje para no ensuciar el log de desarrollo.
 */
let installed = false

export function silenceThreeClockDeprecation(): void {
  if (installed || typeof console === "undefined") return
  installed = true

  const originalWarn = console.warn
  console.warn = function patchedWarn(this: Console, ...args: unknown[]) {
    const first = args[0]
    if (
      typeof first === "string" &&
      /THREE\.Clock.*deprecated|deprecated.*THREE\.Clock/i.test(first)
    ) {
      return
    }
    originalWarn.apply(this, args)
  }
}
