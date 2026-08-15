export type Currentness="CURRENT"|"STALE"|"CONTRADICTORY"|"MIXED_SOURCE"|"MISSING_BINDING"|"UNCERTAIN";
export function CurrentnessBanner({currentness}:{currentness:Currentness}){if(currentness==="CURRENT")return null;return <aside role="alert" data-currentness={currentness}>{currentness}: actions fail closed until authoritative refresh.</aside>}
