// Minimal Mirat client-side error reporter for React / Vite Browser
'use strict';

let dsn = '';
let environment = 'production';
let release = '1.0.0';

export function sendEvent(type, message, stack, culprit, extra = {}) {
  if (!dsn) return;
  const event = {
    type: String(type || 'Error').slice(0, 120),
    message: String(message || 'Unknown error').slice(0, 1000),
    stacktrace: String(stack || '').slice(0, 12000),
    culprit: String(culprit || (typeof location !== 'undefined' ? location.pathname : '')).slice(0, 500),
    url: typeof location !== 'undefined' ? location.href.slice(0, 1500) : '',
    environment,
    release,
    timestamp: new Date().toISOString(),
    level: 'error',
    extra
  };

  try {
    const payload = JSON.stringify(event);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(dsn, new Blob([payload], { type: 'text/plain;charset=UTF-8' }));
    } else if (typeof fetch !== 'undefined') {
      fetch(dsn, {
        method: 'POST',
        mode: 'cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain' },
        body: payload
      }).catch(() => {});
    }
  } catch (_err) {
    /* ignore telemetry send errors */
  }
}

export function captureException(error, extra = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  sendEvent(err.name || 'Error', err.message || String(err), err.stack || '', '', extra);
}

export function init(endpoint, options = {}) {
  dsn = String(endpoint || '');
  environment = String(options.environment || 'production');
  release = String(options.release || '1.0.0');
  if (!dsn || typeof window === 'undefined') return;

  window.addEventListener('error', (e) => {
    const x = e.error;
    const culprit = e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : (location.pathname || '');
    sendEvent(x?.name || 'Error', e.message || String(x || 'Script error'), x?.stack || '', culprit);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const x = e.reason;
    sendEvent(x?.name || 'UnhandledRejection', x?.message || String(x), x?.stack || '', location.pathname || '');
  });
}

const mirat = { init, captureException, sendEvent };
export default mirat;
