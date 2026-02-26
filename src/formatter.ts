let worker: Worker | null = null;
let workerReady: Promise<void> | null = null;
let messageId = 1;

function makeId(): number {
  return messageId++;
}

function ensureWorker(): { worker: Worker; ready: Promise<void> } {
  if (!worker) {
    const base = import.meta.env.BASE_URL;
    const w = new Worker(`${base}lsp-server.js`);

    // Set up a MessageChannel: port2 goes to LSP worker (for Comlink),
    // port1 stays here to handle file-system proxy calls from the server.
    // The LSP server tries to read stdlib files via Comlink during initialization.
    // Since we only need formatting (a purely syntactic operation), we respond
    // to every Comlink call with an error so the server can proceed quickly.
    const channel = new MessageChannel();
    channel.port1.start();
    channel.port1.addEventListener('message', (event: MessageEvent) => {
      const msg = event.data;
      if (msg && msg.type === 'APPLY') {
        channel.port1.postMessage({
          id: msg.id,
          type: 'HANDLER',
          name: 'throw',
          value: { isError: true, value: { message: 'Not available', name: 'Error', stack: '' } }
        });
      }
    });

    // Send the startup message with moonbitEnv and transfer port2 to the worker.
    w.postMessage(
      { moonbitEnv: {}, _lsp_port: channel.port2 },
      [channel.port2]
    );

    // Initialize the LSP protocol connection
    const ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('LSP init timeout')), 15000);

      const handler = (event: MessageEvent) => {
        const msg = event.data;
        if (!msg || msg.jsonrpc !== '2.0') return;
        // Accept both successful and error responses to 'initialize'
        if (msg.id === 1 && (msg.result !== undefined || msg.error !== undefined)) {
          w.removeEventListener('message', handler);
          clearTimeout(timeout);
          // Send 'initialized' notification
          w.postMessage({ jsonrpc: '2.0', method: 'initialized', params: {} });
          resolve();
        }
      };
      w.addEventListener('message', handler);

      // Send initialize request
      w.postMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          processId: null,
          rootUri: 'file:///',
          workspaceFolders: [{ uri: 'file:///', name: 'workspace' }],
          capabilities: {}
        }
      });
    });

    worker = w;
    workerReady = ready;
  }

  return { worker, ready: workerReady! };
}

// The MoonBit LSP formatter prepends a `///|` cursor-position marker to the
// formatted output.  Strip it when it was not present in the original source.
function stripFormatterMarker(original: string, formatted: string): string {
  const MARKER = '///|\n';
  if (formatted.startsWith(MARKER) && !original.startsWith(MARKER)) {
    return formatted.slice(MARKER.length);
  }
  return formatted;
}

/**
 * Format a single MoonBit source file using the LSP formatter.
 * Returns the formatted source, or the original source if formatting fails.
 */
async function formatFile(source: string, filename: string): Promise<string> {
  const { worker: w, ready } = ensureWorker();
  await ready;

  const uri = `file:///${filename}`;
  const id = makeId();

  // Open the document
  w.postMessage({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: { uri, languageId: 'moonbit', version: 1, text: source }
    }
  });

  // Request formatting
  return new Promise<string>((resolve) => {
    const timeout = setTimeout(() => resolve(source), 10000);

    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.jsonrpc !== '2.0') return;
      if (msg.id !== id) return;

      w.removeEventListener('message', handler);
      clearTimeout(timeout);

      // Close the document
      w.postMessage({
        jsonrpc: '2.0',
        method: 'textDocument/didClose',
        params: { textDocument: { uri } }
      });

      if (msg.result && Array.isArray(msg.result) && msg.result.length > 0) {
        const formatted = msg.result[0].newText as string;
        resolve(stripFormatterMarker(source, formatted));
      } else {
        resolve(source);
      }
    };
    w.addEventListener('message', handler);

    w.postMessage({
      jsonrpc: '2.0',
      id,
      method: 'textDocument/formatting',
      params: {
        textDocument: { uri },
        options: { tabSize: 2, insertSpaces: true }
      }
    });
  });
}

/**
 * Format MoonBit source code.
 * Supports multi-file format with `-- filename --` separators.
 * Returns the formatted source code.
 */
export async function formatCode(source: string): Promise<string> {
  const files = parseMultiFileSource(source);

  const formatted = await Promise.all(
    files.map(async ([filename, content]) => {
      const formattedContent = await formatFile(content, filename);
      return [filename, formattedContent] as [string, string];
    })
  );

  return assembleMultiFileSource(formatted);
}

function parseMultiFileSource(source: string): Array<[string, string]> {
  const files: Array<[string, string]> = [];
  const lines = source.split('\n');

  let currentFile = 'main.mbt';
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^--\s+(.+?)\s+--$/);
    if (match) {
      if (currentContent.length > 0 || files.length === 0) {
        files.push([currentFile, currentContent.join('\n')]);
      }
      currentFile = match[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0 || files.length === 0) {
    files.push([currentFile, currentContent.join('\n')]);
  }

  return files;
}

function assembleMultiFileSource(files: Array<[string, string]>): string {
  const parts: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const [filename, content] = files[i];
    if (i === 0) {
      parts.push(content);
    } else {
      parts.push(`-- ${filename} --\n${content}`);
    }
  }
  return parts.join('\n');
}
