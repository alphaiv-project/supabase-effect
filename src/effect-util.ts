import { pipe } from "effect";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

/**
 * Transposer.
 *
 * NOTE: This must be included in effect@v4, but have no idea where it's gone.
 * When supported, replace the function with the built-in one.
 *
 * @internal
 */
export function transpose<A, I, R>(
  o: Option.Option<Effect.Effect<A, I, R>>
): Effect.Effect<Option.Option<A>, I, R> {
  return Option.match(o, {
    onNone: () => Effect.succeedNone,
    onSome: (effect) => pipe(effect, Effect.map(Option.some)),
  });
}
