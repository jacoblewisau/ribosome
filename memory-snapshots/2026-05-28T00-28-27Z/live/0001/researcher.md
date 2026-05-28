# Researcher findings: feature 0001 (add reset button)

## Files involved

- `src/components/Counter.tsx` — the component this feature modifies. Currently exports `Counter({initial, step, label})` and renders four `data-contract` nodes: `counter`, `counter.label`, `counter.value`, `counter.increment`. Uses `useState` for the counter value.
- `src/components/Counter.contract.test.ts` — the contract harness for Counter. Declares fixtures (defaults, custom-initial, custom-step, custom-label) and invariants. Any new behaviour requires extending both `DOM_CONTRACT` and the invariants.
- `src/App.tsx` — composes Counter with default props. No change anticipated.

## Existing patterns to follow

- `data-contract` attributes are the observability surface. The validator reads the contract test output, not the source. Any new visible element gets a `data-contract` attribute (`Counter.tsx:22-27`).
- State lives in `useState` calls on the component itself. No external state library in use.
- Tests use `@testing-library/react` `render` + `fireEvent.click`. No user-event library imported (`Counter.contract.test.ts:1-2`).
- Fixtures are a typed `ReadonlyArray<Fixture>` with `Partial<CounterProps>` (`Counter.contract.test.ts:19-29`). Add new fixtures here when behaviour depends on a new prop or initial state.

## Similar features already built

- The increment button is the closest analogue (`Counter.tsx:25-31`). A reset button has the same shape: a button element with a `data-contract` attribute and an `onClick` that calls `setValue`. The difference is that reset returns to a known anchor rather than transforming current state.

## Risks

- Security: none. Pure UI, no data, no auth, no network.
- Multi-tenant: not applicable (no backend).
- Timezone: not applicable.
- Performance: not applicable at this scale.
- Accessibility: the increment button has no `aria-label`; if the reset button also has none, screen reader users hear "Add 1" and "Reset" which is acceptable but worth checking. Out of scope of this feature unless surfaced.
- Behaviour ambiguity: it is not stated in the issue whether reset returns to the `initial` prop value or hard zero. The component has an explicit `initial` prop so the intended anchor is non-obvious. Surfacing as an open question.

## Tests that will likely need updating

- `src/components/Counter.contract.test.ts`: extend `DOM_CONTRACT` with a `counter.reset` selector and add invariants covering reset behaviour across all fixtures.

## Memory citations

`.claude/memory/live/` and `.claude/memory/distilled/` are empty (Phase 2.5 not yet wired). No prior citations available.

## Open questions

1. When the reset button is clicked, should the value return to the `initial` prop value or hard zero? The component already accepts a configurable `initial`; reading the prop name suggests the intent is "this is where the counter starts" which would mean reset returns to `initial`. But the issue does not say. The operator should answer.
2. Should the reset button be visible at all times, or only when the value differs from the reset target (`initial`)? Both are defensible. Always-visible is simpler and matches the increment button's behaviour (which is also always visible).
3. Should reset have a confirmation step? At this trivial level, no, but stating it for completeness.
