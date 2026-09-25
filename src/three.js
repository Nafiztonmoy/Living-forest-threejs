/** Pinned engine, with mirrors. The local option is useful after offline setup. */
export async function loadThree() {
  if (globalThis.__FOREST_EMBEDDED_THREE__) {
    const e = globalThis.__FOREST_EMBEDDED_THREE__;
    const coreURL = URL.createObjectURL(new Blob([e.core], { type: 'text/javascript' }));
    const moduleURL = URL.createObjectURL(new Blob([
      e.module.replaceAll('./three.core.js', coreURL)
    ], { type: 'text/javascript' }));
    try { return await import(moduleURL); }
    finally { URL.revokeObjectURL(coreURL); URL.revokeObjectURL(moduleURL); }
  }
  const base = new URL('.', document.baseURI);
  const urls = [];
  if (location.protocol !== 'file:' && globalThis.__FOREST_HAS_VENDOR__) urls.push(new URL('vendor/three.module.js', base).href);
  urls.push(
    'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
    'https://unpkg.com/three@0.180.0/build/three.module.js'
  );
  const failures = [];
  for (const url of urls) {
    let timer;
    try {
      return await Promise.race([
        import(url),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Connection timed out')), 10000); })
      ]);
    } catch (error) { failures.push(`${url}: ${error.message}`); }
    finally { clearTimeout(timer); }
  }
  console.warn(failures.join('\n'));
  throw new Error('Three.js could not load. Connect to the internet and reload, or run python tools/make_offline.py on an internet-connected computer.');
}
const THREE = await loadThree();
export default THREE;
