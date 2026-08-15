import { Pool, type PoolConfig } from "pg";

export {
  isSerializationFailure,
  runTransaction,
  type IsolationLevel,
  type PostgreSqlError,
  type TransactionContext,
} from "./transaction.js";

export function createPersistencePool(config: PoolConfig): Pool {
  return new Pool(config);
}

export { coreD01Relations } from "./core-d01/index.js";
export { coreD02Relations } from "./core-d02/index.js";
export { coreD03Relations } from "./core-d03/index.js";
export { runtimeD04Relations } from "./runtime-d04/index.js";
export { exchangeRelations } from "./exchange/index.js";
export { diagnosticRelations } from "./diagnostics/index.js";
