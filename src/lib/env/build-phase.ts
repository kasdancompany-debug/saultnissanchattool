/** True while `next build` is collecting routes / compiling (not at request runtime). */
export function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}
