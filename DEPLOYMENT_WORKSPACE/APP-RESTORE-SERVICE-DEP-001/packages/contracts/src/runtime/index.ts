export * from "./int-run-td-01.ts";
export * from "./int-run-td-02.ts";
export * from "./int-run-td-03.ts";
export * from "./int-run-td-04.ts";
export * from "./int-run-td-05.ts";
export * from "./int-run-td-06.ts";

import { INT_RUN_TD_01_DIRECTION, INT_RUN_TD_01_IDENTITY } from "./int-run-td-01.ts";
import { INT_RUN_TD_02_DIRECTION, INT_RUN_TD_02_IDENTITY } from "./int-run-td-02.ts";
import { INT_RUN_TD_03_DIRECTION, INT_RUN_TD_03_IDENTITY } from "./int-run-td-03.ts";
import { INT_RUN_TD_04_DIRECTION, INT_RUN_TD_04_IDENTITY } from "./int-run-td-04.ts";
import { INT_RUN_TD_05_DIRECTION, INT_RUN_TD_05_IDENTITY } from "./int-run-td-05.ts";
import { INT_RUN_TD_06_DIRECTION, INT_RUN_TD_06_IDENTITY } from "./int-run-td-06.ts";

export const INT_RUN_TD_TRACE = [
  { identity: INT_RUN_TD_01_IDENTITY, source: "CF-02 Section 8.1", representation: "packages/contracts/src/runtime/int-run-td-01.ts", direction: INT_RUN_TD_01_DIRECTION },
  { identity: INT_RUN_TD_02_IDENTITY, source: "CF-02 Section 8.2", representation: "packages/contracts/src/runtime/int-run-td-02.ts", direction: INT_RUN_TD_02_DIRECTION },
  { identity: INT_RUN_TD_03_IDENTITY, source: "CF-02 Section 8.3", representation: "packages/contracts/src/runtime/int-run-td-03.ts", direction: INT_RUN_TD_03_DIRECTION },
  { identity: INT_RUN_TD_04_IDENTITY, source: "CF-02 Section 8.4", representation: "packages/contracts/src/runtime/int-run-td-04.ts", direction: INT_RUN_TD_04_DIRECTION },
  { identity: INT_RUN_TD_05_IDENTITY, source: "CF-02 Section 8.5", representation: "packages/contracts/src/runtime/int-run-td-05.ts", direction: INT_RUN_TD_05_DIRECTION },
  { identity: INT_RUN_TD_06_IDENTITY, source: "CF-02 Section 8.6", representation: "packages/contracts/src/runtime/int-run-td-06.ts", direction: INT_RUN_TD_06_DIRECTION },
] as const;
