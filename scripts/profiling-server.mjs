import { createServer } from 'vite';

export async function startProfilingServer({ root = process.cwd() } = {}) {
  const server = await createServer({
    root, logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, strictPort: true, open: false }
  });
  try {
    await server.listen();
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw Error('Profiling server has no TCP listening address');
    return { url: `http://127.0.0.1:${address.port}`, close: () => server.close() };
  } catch (error) {
    await server.close();
    throw error;
  }
}
