// Web Worker API polyfill for Node.js worker_threads.
// Wraps parentPort to look like the Web Worker global API
// that lsp-server.js (LSP server) expects.
'use strict';
const { parentPort } = require('worker_threads');
const path = require('path');

const port = parentPort;
const listenerMap = new Map();

// The lsp-server.js uses self.addEventListener('message', handler) where the
// MessageEvent has { data, ports } properties. The 'ports' array contains any
// transferred MessagePort objects (for Comlink). In Node.js worker_threads,
// transferred ports are included in the message data under a special key '_lsp_port'.
function makeWrapper(handler) {
  return (msg) => {
    // Extract transferred port from our custom key
    let data = msg;
    let ports = [];
    if (msg && msg._lsp_port) {
      const { _lsp_port, ...rest } = msg;
      data = rest;
      ports = [_lsp_port];
    }
    handler({ data, ports, origin: '*' });
  };
}

globalThis.addEventListener = function (type, handler) {
  if (type === 'message') {
    const wrapper = makeWrapper(handler);
    listenerMap.set(handler, wrapper);
    port.on('message', wrapper);
  }
};

globalThis.removeEventListener = function (type, handler) {
  if (type === 'message') {
    const wrapper = listenerMap.get(handler);
    if (wrapper) {
      port.removeListener('message', wrapper);
      listenerMap.delete(handler);
    }
  }
};

// The lsp-server.js BrowserMessageReader uses `self.onmessage = handler` (not
// addEventListener). We intercept writes to globalThis.onmessage and forward
// them to parentPort.
let _onmessageWrapper = null;
Object.defineProperty(globalThis, 'onmessage', {
  set: function (handler) {
    if (_onmessageWrapper) {
      port.removeListener('message', _onmessageWrapper);
      _onmessageWrapper = null;
    }
    if (handler) {
      _onmessageWrapper = makeWrapper(handler);
      port.on('message', _onmessageWrapper);
    }
  },
  get: function () {
    return _onmessageWrapper;
  },
  configurable: true,
});

globalThis.postMessage = function (data, transfer) {
  port.postMessage(data, transfer || undefined);
};

globalThis.self = globalThis;

require(path.join(__dirname, '../public/lsp-server.js'));
