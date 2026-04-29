type LogPayload = Record<string, string | number | boolean | null | undefined>;

export const logger = {
  info(message: string, payload?: LogPayload) {
    if (__DEV__) {
      void message;
      void payload;
    }
  },
  warn(message: string, payload?: LogPayload) {
    if (__DEV__) {
      void message;
      void payload;
    }
  },
  error(message: string, payload?: LogPayload) {
    if (__DEV__) {
      void message;
      void payload;
    }
  }
};
