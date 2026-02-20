import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { app } from '../server.js';

test('Content Security Policy header is present', async (t) => {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(res.status, 200);

    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'Content-Security-Policy header should be present');

    // Check that it's not empty and contains some directives
    assert.ok(csp.length > 0, 'CSP header should not be empty');

    // Optional: Log the CSP for verification
    console.log('CSP Header:', csp);

  } finally {
    server.close();
  }
});
