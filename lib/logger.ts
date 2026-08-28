type LogPayload = Record<string, string | number | boolean | null | undefined>;

type ErrorSink = (scope: string, code?: string | number | null) => void;

/**
 * Optional analytics sink for warn/error — registered by lib/analytics so this
 * module stays dependency-free (lib/supabase imports it). Only the message
 * CODE and an optional `code` payload field are forwarded, never free text.
 */
let errorSink: ErrorSink | null = null;
export function setLoggerErrorSink(sink: ErrorSink | null) {
  errorSink = sink;
}

function forward(message: string, payload?: LogPayload) {
  if (!errorSink) return;
  const code = payload?.code;
  errorSink(message, typeof code === "string" || typeof code === "number" ? code : undefined);
}

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
    forward(message, payload);
  },
  error(message: string, payload?: LogPayload) {
    if (__DEV__) {
      void message;
      void payload;
    }
    forward(message, payload);
  }
};
