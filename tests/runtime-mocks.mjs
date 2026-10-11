import { registerHooks } from 'node:module';
// Test-only adapters. All SDK data and secrets are in memory; no real accounts,
// credentials, Linux calls or production entity writes are used by these tests.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('npm:@base44/sdk')) return { url: 'mock:sdk', shortCircuit: true };
    if (specifier === 'base44:runtime') return { url: 'mock:runtime', shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:sdk') return { format: 'module', source: 'export const createClientFromRequest = () => globalThis.__testClient;', shortCircuit: true };
    if (url === 'mock:runtime') return { format: 'module', source: 'export const secrets = { get: key => globalThis.__testSecrets?.[key] };', shortCircuit: true };
    return nextLoad(url, context);
  }
});
