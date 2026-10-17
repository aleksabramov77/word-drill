export {
  allowedTypos,
  type CheckResult,
  checkAnswer,
  letterCount,
  type Verdict,
} from "./checkAnswer.ts";
export { areAdjacentKeys, typoDistance } from "./distance.ts";
export { canonicalSpelling, normalize, stripOptional } from "./normalize.ts";
