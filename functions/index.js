import admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

admin.initializeApp();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const googleBooksApiKey = defineSecret('GOOGLE_BOOKS_API_KEY');
const CLAUDE_MODEL = 'claude-haiku-4-5';
const API_USAGE_COLLECTION = 'developerApiUsage';
const API_USAGE_EVENTS_COLLECTION = 'developerApiUsageEvents';

function getTodayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getTokenCount(result, key) {
  return Number(result?.usageMetadata?.[key] || 0);
}

function getInputCharCount(contents = []) {
  return (contents || []).reduce((total, content) => {
    return total + (content?.parts || []).reduce((partTotal, part) => {
      return partTotal + String(part?.text || '').length;
    }, 0);
  }, 0);
}

function hasInlineImages(contents = []) {
  return (contents || []).some((content) =>
    (content?.parts || []).some((part) => Boolean(part?.inlineData?.data))
  );
}

function normalizeRoutingHints(rawRouting = {}) {
  return {
    modelTier: String(rawRouting?.modelTier || '').toLowerCase(),
    complexityHint: String(rawRouting?.complexityHint || '').toLowerCase(),
    budgetPriority: String(rawRouting?.budgetPriority || '').toLowerCase(),
    requiresVision: Boolean(rawRouting?.requiresVision),
    requiresJson: Boolean(rawRouting?.requiresJson),
  };
}

function selectModelRoute({ contents, generationConfig = {}, callType = 'AI call', routing = {} }) {
  const normalizedRouting = normalizeRoutingHints(routing);
  const inputCharCount = getInputCharCount(contents);
  const includesImage = hasInlineImages(contents) || normalizedRouting.requiresVision;
  const maxOutputTokens = Number(generationConfig?.maxOutputTokens || 0);
  const normalizedCallType = String(callType || '').toLowerCase();

  if (['cheap', 'balanced', 'strong'].includes(normalizedRouting.modelTier)) {
    return {
      modelTier: normalizedRouting.modelTier,
      routeReason: 'explicit-tier-override',
      inputCharCount,
      includesImage,
      maxOutputTokens,
    };
  }

  if (includesImage || normalizedCallType.includes('scan')) {
    return {
      modelTier: 'strong',
      routeReason: includesImage ? 'vision-input' : 'scan-call-type',
      inputCharCount,
      includesImage,
      maxOutputTokens,
    };
  }

  if (
    normalizedCallType === 'chat' &&
    normalizedRouting.budgetPriority === 'low_cost' &&
    inputCharCount <= 2500 &&
    maxOutputTokens <= 512
  ) {
    return {
      modelTier: 'cheap',
      routeReason: 'low-cost-chat',
      inputCharCount,
      includesImage,
      maxOutputTokens,
    };
  }

  if (
    normalizedRouting.complexityHint === 'complex' ||
    maxOutputTokens > 1800 ||
    inputCharCount > 6000
  ) {
    return {
      modelTier: 'strong',
      routeReason:
        normalizedRouting.complexityHint === 'complex'
          ? 'complexity-hint'
          : maxOutputTokens > 1800
            ? 'large-output-request'
            : 'large-input-request',
      inputCharCount,
      includesImage,
      maxOutputTokens,
    };
  }

  return {
    modelTier: 'balanced',
    routeReason: normalizedRouting.requiresJson ? 'structured-json-request' : 'default-balanced',
    inputCharCount,
    includesImage,
    maxOutputTokens,
  };
}

function getProviderErrorMessage(provider, response) {
  const message =
    response?.result?.error?.message ||
    response?.result?.error?.error?.message ||
    response?.result?.message ||
    '';

  return message || `${provider} could not process the request.`;
}

function getProviderErrorCode(status) {
  if (status === 400) return 'invalid-argument';
  if (status === 401 || status === 403) return 'failed-precondition';
  if (status === 429) return 'resource-exhausted';
  if (status >= 500) return 'unavailable';
  return 'unknown';
}

async function recordUsageSafely(payload) {
  try {
    await saveGlobalUsage(payload);
  } catch (error) {
    console.error('Developer API usage write failed', {
      provider: payload.provider,
      status: payload.status,
      callType: payload.callType,
      error: error?.message || String(error),
    });
  }
}

function getRequestIp(request) {
  const forwardedFor = String(
    request?.rawRequest?.headers?.['x-forwarded-for'] || ''
  )
    .split(',')[0]
    .trim();

  return (
    forwardedFor ||
    request?.rawRequest?.ip ||
    request?.rawRequest?.socket?.remoteAddress ||
    'Unknown IP'
  );
}

function toAnthropicContent(contents, callType) {
  const contentBlocks = [];

  for (const content of contents || []) {
    for (const part of content?.parts || []) {
      if (part.text) {
        contentBlocks.push({ type: 'text', text: part.text });
      }
      if (part.inlineData?.data) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: part.inlineData.mimeType || 'image/jpeg',
            data: part.inlineData.data,
          },
        });
      }
    }
  }

  if (contentBlocks.some((block) => block.type === 'text') && callType !== 'Chat') {
    contentBlocks.push({
      type: 'text',
      text: 'Return raw JSON only. Do not wrap the response in Markdown or code fences.',
    });
  }

  return contentBlocks;
}

function getMaxTokens(generationConfig = {}) {
  const configuredMax = Number(generationConfig.maxOutputTokens || 0);
  return Number.isFinite(configuredMax) && configuredMax > 0
    ? Math.min(configuredMax, 8192)
    : 4096;
}

function normalizeClaudeResult(result, model) {
  const text = (result?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text || '')
    .join('\n')
    .trim();
  const inputTokens = Number(result?.usage?.input_tokens || 0);
  const outputTokens = Number(result?.usage?.output_tokens || 0);

  return {
    provider: 'claude',
    model,
    text,
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
    usageMetadata: {
      promptTokenCount: inputTokens,
      candidatesTokenCount: outputTokens,
      totalTokenCount: inputTokens + outputTokens,
    },
  };
}

async function saveGlobalUsage({
  auth,
  callType,
  status,
  result,
  provider,
  model,
  modelTier = '',
  routeReason = '',
  ipAddress,
  durationMs,
  inputCharCount = 0,
  includesImage = false,
}) {
  if (!auth?.uid) return;

  const db = admin.firestore();
  const dateKey = getTodayKey();
  const promptTokens = getTokenCount(result, 'promptTokenCount');
  const outputTokens = getTokenCount(result, 'candidatesTokenCount');
  const totalTokens = getTokenCount(result, 'totalTokenCount') || promptTokens + outputTokens;
  const isSuccess = status === 'Success';
  const userEmail = auth.token?.email || 'unknown';
  const eventPayload = {
    date: dateKey,
    callType,
    status,
    provider,
    model,
    modelTier,
    routeReason,
    promptTokens,
    outputTokens,
    totalTokens,
    durationMs: durationMs || 0,
    inputCharCount: Number(inputCharCount || 0),
    includesImage: Boolean(includesImage),
    userId: auth.uid,
    userEmail,
    ipAddress: ipAddress || 'Unknown IP',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await Promise.all([
    db.collection(API_USAGE_EVENTS_COLLECTION).add(eventPayload),
    db.collection(API_USAGE_COLLECTION).doc(dateKey).set(
      {
        date: dateKey,
        apiCalls: admin.firestore.FieldValue.increment(1),
        promptTokens: admin.firestore.FieldValue.increment(promptTokens),
        outputTokens: admin.firestore.FieldValue.increment(outputTokens),
        totalTokens: admin.firestore.FieldValue.increment(totalTokens),
        successCalls: admin.firestore.FieldValue.increment(isSuccess ? 1 : 0),
        failedCalls: admin.firestore.FieldValue.increment(isSuccess ? 0 : 1),
        lastCallType: callType,
        lastStatus: status,
        lastProvider: provider,
        lastModel: model,
        lastModelTier: modelTier,
        lastRouteReason: routeReason,
        lastUserEmail: userEmail,
        lastIpAddress: ipAddress || 'Unknown IP',
        lastDurationMs: durationMs || 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}

async function callClaude({ contents, generationConfig, model }) {
  const apiKey = anthropicApiKey.value();
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Claude API key is not configured.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: getMaxTokens(generationConfig),
      messages: [
        {
          role: 'user',
          content: toAnthropicContent(contents, generationConfig?._callType),
        },
      ],
    }),
  });
  const responseText = await response.text();
  let result;

  try {
    result = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    result = undefined;
  }

  return {
    ok: response.ok,
    status: response.status,
    result: response.ok ? normalizeClaudeResult(result, model) : result,
    model,
  };
}

function createClaudeCallable() {
  return onCall(
    {
      region: 'us-central1',
      invoker: 'public',
      secrets: [anthropicApiKey],
      timeoutSeconds: 120,
      memory: '512MiB',
      minInstances: 0,
    },
    async (request) => {
    const { contents, generationConfig = {}, callType = 'AI call', routing = {} } = request.data || {};

    if (!request.auth?.uid && callType !== 'Chat') {
      throw new HttpsError('unauthenticated', 'Sign in to use AI scanning.');
    }


    const ipAddress = getRequestIp(request);
    const route = selectModelRoute({ contents, generationConfig, callType, routing });

    if (!Array.isArray(contents) || contents.length === 0) {
      throw new HttpsError('invalid-argument', 'AI contents are required.');
    }

    const claudeStartTime = Date.now();
    const claude = await callClaude({
      contents,
      generationConfig: { ...generationConfig, _callType: callType },
      model: CLAUDE_MODEL,
    });
    const claudeDurationMs = Date.now() - claudeStartTime;

    if (!claude.ok) {
      await recordUsageSafely({
        auth: request.auth,
        callType,
        status: 'Failed',
        result: claude.result,
        provider: 'claude',
        model: claude.model || CLAUDE_MODEL,
        modelTier: route.modelTier,
        routeReason: route.routeReason,
        ipAddress,
        durationMs: claudeDurationMs,
        inputCharCount: route.inputCharCount,
        includesImage: route.includesImage,
      });
      throw new HttpsError(
        getProviderErrorCode(claude.status),
        getProviderErrorMessage('Claude', claude)
      );
    }

    await recordUsageSafely({
      auth: request.auth,
      callType,
      status: 'Success',
      result: claude.result,
      provider: 'claude',
      model: claude.model,
      modelTier: route.modelTier,
      routeReason: route.routeReason,
      ipAddress,
      durationMs: claudeDurationMs,
      inputCharCount: route.inputCharCount,
      includesImage: route.includesImage,
    });

    return {
      ...claude.result,
      modelTier: route.modelTier,
      routeReason: route.routeReason,
      provider: 'claude',
      model: claude.model,
    };
    }
  );
}

export const generateClaudeContent = createClaudeCallable();

// Compatibility endpoint for older app versions. It is intentionally Claude-only.
export const generateGeminiContent = createClaudeCallable();

export const searchGoogleBooks = onCall(
  {
    region: 'us-central1',
    invoker: 'public',
    secrets: [googleBooksApiKey],
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    const { params } = request.data || {};
    if (!params) {
      throw new HttpsError('invalid-argument', 'Search parameters are required.');
    }

    const apiKey = googleBooksApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Google Books API key is not configured.');
    }

    const searchParams = new URLSearchParams(params);
    searchParams.set('key', apiKey); // Inject secret key

    const url = `https://www.googleapis.com/books/v1/volumes?${searchParams.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new HttpsError('internal', `Google Books API error: ${response.status}`);
    }
    
    return await response.json();
  }
);
