declare module "node:http" {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    setEncoding(encoding: "utf8"): void;
    on(event: "data", listener: (chunk: string) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (error: unknown) => void): this;
    destroy(): void;
  }

  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(data?: string): void;
  }

  export interface ServerAddress {
    address: string;
    port: number;
  }

  export interface Server {
    listen(port: number, host: string, callback?: () => void): this;
    close(callback?: () => void): this;
    once(event: "error", listener: (error: unknown) => void): this;
    off(event: "error", listener: (error: unknown) => void): this;
    address(): ServerAddress | string | null;
  }

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void,
  ): Server;
}

declare module "node:crypto" {
  export function randomUUID(): string;
}

declare module "node:process" {
  const process: {
    env: Record<string, string | undefined>;
    exitCode: number | undefined;
    on(signal: "SIGTERM" | "SIGINT", listener: () => void): void;
  };
  export default process;
}
