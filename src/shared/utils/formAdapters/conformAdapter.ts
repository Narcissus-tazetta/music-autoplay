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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (target) {
        try {
          target.errors = [v];
        } catch (err: unknown) {
          if (import.meta.env.DEV)
            console.debug("applyFieldErrorsToConform mutation failed", err);
        }
      }
    }
  } catch (err: unknown) {
    if (import.meta.env.DEV)
      console.debug("applyFieldErrorsToConform failed", err);
  }
}
