// Web Worker API polyfill for Node.js worker_threads.
// Wraps parentPort to look like the Web Worker global API
// that moonc-worker.js (comlink server side) expects.
'use strict';
const { parentPort } = require('worker_threads');
const path = require('path');

const port = parentPort;
const listenerMap = new Map(); // handler -> port listener wrapper

globalThis.addEventListener = function (type, handler) {
  if (type === 'message') {
    const wrapper = (data) => handler({ data, origin: '*' });
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

globalThis.postMessage = function (data, transfer) {
  port.postMessage(data, transfer || undefined);
};

globalThis.self = globalThis;

require(path.join(__dirname, '../public/moonc-worker.js'));
