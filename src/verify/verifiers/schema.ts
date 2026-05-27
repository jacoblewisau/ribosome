import type { Check, Verifier } from "../core/types";

/**
 * Schema verifier. Validates that the unit's declared Zod schema
 * accepts the fixture's props. This is structural: if the fixture
 * provides no props (the unit takes none, or constructs state
 * internally), the verifier records ok.
 */
export const schemaVerifier: Verifier = {
  name: "schema",
  run: (_container, unit, fixture): Check[] => {
    const props = fixture.props;
    if (props === undefined) {
      return [
        {
          verifier: "schema",
          status: "ok",
          reason: "no props provided for fixture (treated as valid)",
        },
      ];
    }
    const result = unit.props.safeParse(props);
    if (result.success) {
      return [{ verifier: "schema", status: "ok" }];
    }
    return [
      {
        verifier: "schema",
        status: "fail",
        reason: "props failed Zod schema",
        detail: result.error.issues,
      },
    ];
  },
};
