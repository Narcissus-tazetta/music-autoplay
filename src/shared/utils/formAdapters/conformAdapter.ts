/* eslint-disable @typescript-eslint/no-unnecessary-condition */
export type ConformFields = Record<
  string,
  {
    name: string;
    value?: unknown;
    errors?: string[];
    [k: string]: unknown;
  }
>;

export function applyFieldErrorsToConform(
  fields: ConformFields | undefined,
  errors: Record<string, string> | undefined,
) {
  if (fields === undefined || errors === undefined) return;
  try {
    for (const [k, v] of Object.entries(errors)) {
      const target = fields[k];
      if (target) {
        try {
          target.errors = [v];
        } catch (err) {
          if (import.meta.env.DEV)
            console.debug("applyFieldErrorsToConform mutation failed", err);
        }
      }
    }
  } catch (err) {
    if (import.meta.env.DEV)
      console.debug("applyFieldErrorsToConform failed", err);
  }
}

export default { applyFieldErrorsToConform };
