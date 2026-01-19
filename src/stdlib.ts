// Load standard library .mi files
export async function loadStdMiFiles(): Promise<[string, Uint8Array][]> {
  const corePackages = [
    'abort', 'array', 'bench', 'bigint', 'bool', 'buffer', 'builtin',
    'byte', 'bytes', 'char', 'cmp', 'coverage', 'debug', 'deque',
    'double', 'fixedarray', 'float', 'hashmap', 'hashset', 'immut/hashmap',
    'immut/hashset', 'immut/list', 'immut/priority_queue', 'immut/sorted_map',
    'immut/sorted_set', 'int', 'int64', 'intrinsics/wasm', 'iter', 'js',
    'json', 'list', 'map', 'math', 'option', 'priority_queue', 'prelude',
    'queue', 'random', 'ref', 'result', 'sorted_map', 'sorted_set',
    'string', 'string/regex', 'strconv', 'test', 'tuple', 'uint', 'uint64',
    'unit', 'vec'
  ];

  const miFiles: [string, Uint8Array][] = [];

  for (const pkg of corePackages) {
    const pkgName = pkg.split('/').pop()!;
    const path = `/lib/core/${pkg}/${pkgName}.mi`;
    
    try {
      const response = await fetch(path);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        // Format: "pkgPath:pkgImportPath"
        const pkgPath = `/lib/core/${pkg}`;
        const importPath = `moonbitlang/core/${pkg}`;
        miFiles.push([
          `${pkgPath}:${importPath}`,
          new Uint8Array(buffer)
        ]);
      } else {
        console.warn(`Failed to load ${path}: ${response.status}`);
      }
    } catch (e) {
      console.warn(`Failed to load ${path}:`, e);
    }
  }

  return miFiles;
}

