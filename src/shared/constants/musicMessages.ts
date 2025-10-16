import { getMessage } from "./messages";

export const MUSIC_MESSAGES = {
  SUCCESS: {
    ADDED: getMessage("SUCCESS_ADDED"),
  },
  ERROR: {
    ALREADY_EXISTS: (position: number) =>
      getMessage("ERROR_ALREADY_EXISTS", position),
    NOT_FOUND: getMessage("ERROR_NOT_FOUND"),
    FORBIDDEN: getMessage("ERROR_FORBIDDEN"),
    ADD_FAILED: getMessage("ERROR_ADD_FAILED"),
  },
} as const;
