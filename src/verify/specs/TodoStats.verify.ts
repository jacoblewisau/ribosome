import { z } from "zod";
import React from "react";
import { TodoStats } from "../../features/todos/TodoStats";
import type { VerifiableUnit } from "../core/types";
import { registerUnit } from "../core/registry";

/**
 * TodoStats verify spec.
 *
 * The `inconsistent-counts` fixture is the canonical probe. It renders
 * TodoStats with total=5, done=3, active=1 (4 != 5). The dom-contract
 * verifier and the counts-add-up invariant both detect this. The
 * matrix runner marks the verdict PASS for probes, and the test asserts
 * the probe's checks failed as expected.
 */

export const TodoStatsUnit: VerifiableUnit = {
  name: "TodoStats",
  props: z.object({
    total: z.number().int().nonnegative(),
    done: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
  }).strict(),
  fixtures: [
    {
      name: "empty",
      props: { total: 0, done: 0, active: 0 },
      render: () => React.createElement(TodoStats, { total: 0, done: 0, active: 0 }),
      invariants: [
        countsAddUp,
        (dom) => {
          const root = dom.querySelector('[data-verify-unit="TodoStats"]');
          return root?.getAttribute("data-verify-total") === "0" || "expected total=0";
        },
      ],
    },
    {
      name: "all-active",
      props: { total: 3, done: 0, active: 3 },
      render: () => React.createElement(TodoStats, { total: 3, done: 0, active: 3 }),
      invariants: [countsAddUp],
    },
    {
      name: "all-done",
      props: { total: 3, done: 3, active: 0 },
      render: () => React.createElement(TodoStats, { total: 3, done: 3, active: 0 }),
      invariants: [countsAddUp],
    },
    {
      name: "inconsistent-counts",
      props: { total: 5, done: 3, active: 1 },
      render: () => React.createElement(TodoStats, { total: 5, done: 3, active: 1 }),
      invariants: [countsAddUp],
      probe: true,
    },
  ],
};

function countsAddUp(dom: HTMLElement): boolean | string {
  const root = dom.querySelector('[data-verify-unit="TodoStats"]');
  if (!root) return "TodoStats root not mounted";
  const total = Number(root.getAttribute("data-verify-total"));
  const done = Number(root.getAttribute("data-verify-done"));
  const active = Number(root.getAttribute("data-verify-active"));
  if (Number.isNaN(total) || Number.isNaN(done) || Number.isNaN(active)) {
    return "one of total/done/active is not a number";
  }
  if (total !== done + active) {
    return `counts-add-up failed: total=${total} done=${done} active=${active}`;
  }
  return true;
}

registerUnit(TodoStatsUnit);
