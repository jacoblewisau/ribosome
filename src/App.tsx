import { TodoApp } from "./features/todos/TodoApp";

export function App() {
  return (
    <main>
      <h1>Ribosome substrate</h1>
      <p>
        Verifiable React substrate borrowed from{" "}
        <code>cwc-workshops/how-we-claude-code/phase-3-verify</code>. The
        components below emit <code>data-verify-*</code> attributes; the
        matrix at <code>src/verify/matrix.test.ts</code> runs every unit
        through schema, invariants, dom-contract, and a11y verifiers.
        Validator reads the matrix output, not the source.
      </p>
      <TodoApp />
    </main>
  );
}
