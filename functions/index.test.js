import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';

process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

const { generateClaudeContent, generateGeminiContent } = await import('./index.js');

function successfulClaudeResponse() {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      content: [{ type: 'text', text: '{"books":[]}' }],
      usage: { input_tokens: 11, output_tokens: 7 },
    }),
  };
}

async function verifyClaudeOnly(callable) {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return successfulClaudeResponse();
  };

  try {
    const result = await callable.run({
      data: {
        contents: [{ role: 'user', parts: [{ text: 'Recommend a book' }] }],
        callType: 'Chat',
        generationConfig: { maxOutputTokens: 320 },
      },
      rawRequest: { headers: {} },
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://api.anthropic.com/v1/messages');
    assert.equal(requests[0].options.headers['x-api-key'], 'test-anthropic-key');
    const requestBody = JSON.parse(requests[0].options.body);
    assert.equal(requestBody.model, 'claude-haiku-4-5');
    assert.equal(result.provider, 'claude');
    assert.equal(result.model, 'claude-haiku-4-5');
    assert.equal(result.text, '{"books":[]}');
    assert.equal(result.usageMetadata.totalTokenCount, 18);
    assert.equal(requests.some(({ url }) => /gemini|generativelanguage/i.test(url)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('new callable uses only Claude 4.5 Haiku', async () => {
  await verifyClaudeOnly(generateClaudeContent);
});

test('legacy callable is also Claude-only for older app versions', async () => {
  await verifyClaudeOnly(generateGeminiContent);
});
