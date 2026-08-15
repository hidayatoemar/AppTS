export type ConfigErrorCode = "CONFIG_MISSING_REQUIRED" | "CONFIG_INVALID_VALUE";

export class ConfigError extends Error {
  readonly code: ConfigErrorCode;
  readonly field: string;

  constructor(code: ConfigErrorCode, field: string, message: string) {
    super(message);
    this.name = "ConfigError";
    this.code = code;
    this.field = field;
  }
}

export function missingRequiredError(field: string): ConfigError {
  return new ConfigError("CONFIG_MISSING_REQUIRED", field, `required configuration value "${field}" is missing`);
}

export function invalidValueError(field: string, reason: string): ConfigError {
  return new ConfigError("CONFIG_INVALID_VALUE", field, `configuration value "${field}" is invalid: ${reason}`);
}
