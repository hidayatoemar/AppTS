import type { Pool, PoolClient, QueryResult } from "pg";

export type IsolationLevel = "READ COMMITTED" | "SERIALIZABLE";

export interface TransactionContext {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface PostgreSqlError extends Error {
  readonly code?: string;
}

export function isSerializationFailure(error: unknown): error is PostgreSqlError {
  return error instanceof Error && (error as PostgreSqlError).code === "40001";
}

export async function runTransaction<Result>(
  pool: Pool,
  isolationLevel: IsolationLevel,
  operation: (transaction: TransactionContext) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect();
  let releasedWithError = false;
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
    const result = await operation(asTransactionContext(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      releasedWithError = true;
      client.release(asError(rollbackError));
    }
    throw error;
  } finally {
    if (!releasedWithError) client.release();
  }
}

function asTransactionContext(client: PoolClient): TransactionContext {
  return {
    query: <Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]) => {
      if (values === undefined) {
        return client.query<Row>(text);
      }
      const mutableValues: unknown[] = [...values];
      return client.query<Row, unknown[]>(text, mutableValues);
    },
  };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
