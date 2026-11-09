/**
 * Prompt Library — Host half.
 *
 * Exposes exactly two Node HTTP routes to the Web GUI:
 *
 *   GET  /dsh-prompt-library/ai/status   which model would an AI review use?
 *   POST /dsh-prompt-library/ai/review   request one <=200-character review
 *
 * The routes are optional: when the `webServer` service is absent the plugin
 * still loads and the browser just sees a 404 ("AI review unavailable"). Model
 * calls go through `ctx.llm.stream` with no tools, no session id and no session
 * writes — the request carries only the prompt snapshot as *data*. Prompt text
 * is never logged, no credential ever reaches a response, and every response is
 * `Cache-Control: no-store`.
 */
import {
  buildAiReviewRequest,
  buildCompressionRequest,
  validateAiReviewText,
} from './core.js'

const NAME = 'prompt-library'
const STATUS_PATH = '/dsh-prompt-library/ai/status'
const REVIEW_PATH = '/dsh-prompt-library/ai/review'
const MAX_BODY_BYTES = 256 * 1024
const MAX_CONCURRENT_REVIEWS = 2
const DEFAULT_TIMEOUT_MS = 90_000
const MAX_TIMEOUT_MS = 300_000
const MIN_TIMEOUT_MS = 50
const MAX_INPUT_CHARS = 24_000
const REVIEW_MAX_TOKENS = 2048

/** Plugin name exposed to the loader (package name is also used). */
export const name = NAME

/* ------------------------------------------------------------------------- */
/* Small host helpers                                                        */
/* ------------------------------------------------------------------------- */

/** Best-effort logger: the DSH logger when present, console otherwise. */
function log(ctx, level, message) {
  const line = '[' + NAME + '] ' + message
  try {
    const logger = ctx && ctx.logger
    if (logger && typeof logger[level] === 'function') {
      logger[level](line)
      return
    }
  } catch (error) {
    /* fall through to console */
  }
  try {
    if (level === 'error') console.error(line)
    else if (level === 'debug') console.debug(line)
    else console.warn(line)
  } catch (error) {
    /* logging is never fatal */
  }
}

/** Unwrap schema cells that expose `.get()`. */
function unwrapCell(value) {
  if (value && typeof value.get === 'function') {
    try {
      return value.get()
    } catch (error) {
      return undefined
    }
  }
  return value
}

/** Plugin config: optional pinned model plus an internal timeout override. */
function normalizeConfig(config) {
  const source = config && typeof config === 'object' ? config : {}
  const provider = unwrapCell(source.provider)
  const model = unwrapCell(source.model)
  const timeout = Number(unwrapCell(source.timeoutMs))
  return {
    provider: typeof provider === 'string' && provider.trim() ? provider.trim() : '',
    model: typeof model === 'string' && model.trim() ? model.trim() : '',
    timeoutMs:
      Number.isFinite(timeout) && timeout >= MIN_TIMEOUT_MS
        ? Math.min(Math.round(timeout), MAX_TIMEOUT_MS)
        : DEFAULT_TIMEOUT_MS,
  }
}

/** Read an optional service without declaring it as a hard dependency. */
function getService(ctx, serviceName) {
  if (!ctx) return undefined
  try {
    if (typeof ctx.get === 'function') return ctx.get(serviceName)
  } catch (error) {
    return undefined
  }
  try {
    return ctx[serviceName]
  } catch (error) {
    return undefined
  }
}

function errorDetail(error) {
  if (!error) return 'unknown error'
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message) return error.message
  return String(error)
}

/** JSON response; never throws, always adds `Cache-Control: no-store`. */
function writeJson(res, status, body) {
  if (!res || res.headersSent || res.writableEnded) return
  let payload
  try {
    payload = JSON.stringify(body)
  } catch (error) {
    payload = JSON.stringify({ ok: false, code: 'INTERNAL_ERROR', message: 'response serialization failed' })
    status = 500
  }
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  }
  try {
    res.writeHead(status, headers)
    res.end(payload)
  } catch (error) {
    try {
      res.end()
    } catch (ignored) {
      /* socket already gone */
    }
  }
}

/** Error response helper. */
function fail(res, status, code, message, detail) {
  const body = { ok: false, code }
  if (message) body.message = message
  if (detail !== undefined) body.detail = detail
  writeJson(res, status, body)
}

/** Split a `Host` header value into a lowercase hostname and port text. */
function splitHost(host) {
  const text = typeof host === 'string' ? host.trim() : ''
  if (!text) return { hostname: '', port: '' }
  if (text[0] === '[') {
    const end = text.indexOf(']')
    if (end !== -1) {
      return { hostname: text.slice(1, end).toLowerCase(), port: text.slice(end + 1).replace(/^:/, '') }
    }
  }
  const index = text.lastIndexOf(':')
  if (index > -1) return { hostname: text.slice(0, index).toLowerCase(), port: text.slice(index + 1) }
  return { hostname: text.toLowerCase(), port: '' }
}

/** True for loopback literals that never need the socket-address check. */
function isLoopbackHostname(hostname) {
  if (!hostname) return false
  if (hostname === 'localhost' || hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') return true
  return /^127\./.test(hostname)
}

/**
 * Same-origin policy for the two plugin routes. Requests without an `Origin`
 * header are allowed (same-document navigations / curl); when an Origin is
 * present it must match the Host header, and a non-loopback Host must also
 * match the socket's local address (DNS-rebinding protection).
 */
function assertTrustedOrigin(req, res) {
  const headers = req && req.headers ? req.headers : {}
  const origin = typeof headers.origin === 'string' ? headers.origin : ''
  if (!origin) return true
  const host = typeof headers.host === 'string' ? headers.host : ''
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch (error) {
    originHost = ''
  }
  if (!originHost || !host || originHost !== host) {
    fail(res, 403, 'FORBIDDEN_ORIGIN', 'Origin 与 Host 不一致，已拒绝跨站请求')
    return false
  }
  const parsed = splitHost(host)
  if (!isLoopbackHostname(parsed.hostname)) {
    const socket = req && req.socket ? req.socket : {}
    const localAddress = typeof socket.localAddress === 'string' ? socket.localAddress.toLowerCase() : ''
    const localPort = socket.localPort === undefined || socket.localPort === null ? '' : String(socket.localPort)
    if (!localAddress || parsed.hostname !== localAddress || (localPort && parsed.port !== localPort)) {
      fail(res, 403, 'FORBIDDEN_HOST', 'Host 与本机服务地址不一致，已拒绝可能的 DNS rebinding')
      return false
    }
  }
  return true
}

/* ------------------------------------------------------------------------- */
/* Model resolution                                                          */
/* ------------------------------------------------------------------------- */

/** `listModels` that never throws. */
async function listModelsSafe(llm, provider) {
  try {
    const models = await llm.listModels(provider)
    return Array.isArray(models) ? models : []
  } catch (error) {
    return []
  }
}

/** Display name for one provider/model pair (`model` id as fallback). */
async function displayNameFor(llm, provider, model) {
  const models = await listModelsSafe(llm, provider)
  for (const entry of models) {
    if (entry && entry.id === model) {
      if (typeof entry.name === 'string' && entry.name.trim()) return entry.name.trim()
      break
    }
  }
  return model
}

/**
 * Reasoning-effort selection for the review call.
 *
 * A review is a short, simple judgement task, but DSH's DeepSeek adapter defaults
 * a thinking-capable model to `high` effort. Thinking output counts against the
 * request's `max_tokens`, so the default effort can consume the whole budget and
 * finish with `max-tokens` before any review text is produced (observed in the
 * real DSH GUI as "模型输出被截断 (TRUNCATED)"). Selecting the model's lowest
 * advertised effort keeps the output budget for the review itself.
 */
const MAX_EFFORT_CACHE = 64
const EFFORT_CACHE_TTL_MS = 10 * 60 * 1000
const effortCache = new Map()

const EFFORT_RANKS = [
  { rank: 4, re: /(?:^|[^a-z])(?:x[\s_-]?high|very[\s_-]?high|maximum|max|highest)(?:$|[^a-z])|最高/i },
  { rank: 3, re: /(?:^|[^a-z])high(?:$|[^a-z])|高/i },
  { rank: 2, re: /(?:^|[^a-z])(?:medium|mid(?:dle)?|standard|default)(?:$|[^a-z])|中/i },
  { rank: 1, re: /(?:^|[^a-z])(?:minimal|minimum|lowest|low)(?:$|[^a-z])|最少|最低|低/i },
  { rank: 0, re: /(?:^|[^a-z])(?:none|off|disabled|no[\s_-]?reasoning)(?:$|[^a-z])|^(?:0)$/i },
]

function effortRank(id, name) {
  for (const entry of EFFORT_RANKS) {
    if (entry.re.test(id) || (name && entry.re.test(name))) return entry.rank
  }
  return undefined
}

/** Lowest advertised reasoning effort of a model, or undefined when none is known. */
function pickLowestEffort(info) {
  const efforts = info && info.reasoning && Array.isArray(info.reasoning.efforts) ? info.reasoning.efforts : []
  let best
  for (const effort of efforts) {
    if (!effort || effort.id === undefined || effort.id === null) continue
    const id = String(effort.id)
    if (!id) continue
    const name = effort.name === undefined || effort.name === null ? '' : String(effort.name)
    const rank = effortRank(id, name)
    if (rank === undefined) continue
    if (!best || rank < best.rank) best = { id, rank }
  }
  return best ? best.id : undefined
}

/**
 * Resolve (and briefly cache) the lowest reasoning effort for a route. Any
 * discovery failure leaves the effort unset so the call keeps working on
 * adapters without reasoning metadata.
 */
async function resolveLowestEffort(llm, provider, model, signal) {
  const key = String(provider) + '/' + String(model)
  const cached = effortCache.get(key)
  if (cached && Date.now() - cached.at < EFFORT_CACHE_TTL_MS) {
    effortCache.delete(key)
    effortCache.set(key, cached)
    return cached.effort
  }
  let effort
  try {
    if (typeof llm.resolveModelInfo === 'function') {
      effort = pickLowestEffort(await llm.resolveModelInfo(provider, model, signal))
    }
  } catch (error) {
    effort = undefined
  }
  effortCache.set(key, { at: Date.now(), effort })
  while (effortCache.size > MAX_EFFORT_CACHE) {
    const oldest = effortCache.keys().next().value
    effortCache.delete(oldest)
  }
  return effort
}

/** Resolve a pinned config provider+model (both, only provider, or only model). */
async function resolvePinned(llm, provider, model) {
  if (provider && model) {
    return { provider, model, displayName: await displayNameFor(llm, provider, model), source: 'pinned' }
  }
  let providers = []
  try {
    providers = llm.listProviders()
  } catch (error) {
    providers = []
  }
  if (!Array.isArray(providers)) providers = []
  if (provider) {
    const models = await listModelsSafe(llm, provider)
    const first = models.find((entry) => entry && typeof entry.id === 'string' && entry.id)
    if (first) return { provider, model: first.id, displayName: first.name || first.id, source: 'pinned' }
    return undefined
  }
  for (const entry of providers) {
    const providerId = entry && typeof entry.id === 'string' ? entry.id : ''
    if (!providerId) continue
    const models = await listModelsSafe(llm, providerId)
    const match = models.find((candidate) => candidate && candidate.id === model)
    if (match) return { provider: providerId, model, displayName: match.name || match.id, source: 'pinned' }
  }
  return undefined
}

/**
 * Resolve the model for one request, fresh each time:
 * config pin -> agent default selection -> first catalog model.
 */
async function resolveRoute(ctx, config) {
  const llm = getService(ctx, 'llm')
  if (!llm || typeof llm.stream !== 'function') {
    return { ok: false, code: 'NO_LLM', message: 'LLM 服务不可用' }
  }
  if (config.provider || config.model) {
    const pinned = await resolvePinned(llm, config.provider, config.model)
    if (pinned) return { ok: true, ...pinned }
  }
  const defaultModel = getService(ctx, 'agentDefaultModel')
  if (defaultModel && typeof defaultModel.currentSelection === 'function') {
    let selection
    try {
      selection = defaultModel.currentSelection()
    } catch (error) {
      selection = undefined
    }
    if (
      selection &&
      typeof selection.provider === 'string' &&
      selection.provider.trim() &&
      typeof selection.model === 'string' &&
      selection.model.trim()
    ) {
      const provider = selection.provider.trim()
      const model = selection.model.trim()
      return { ok: true, provider, model, displayName: await displayNameFor(llm, provider, model), source: 'default' }
    }
  }
  let providers = []
  try {
    providers = llm.listProviders()
  } catch (error) {
    providers = []
  }
  if (Array.isArray(providers)) {
    for (const entry of providers) {
      const providerId = entry && typeof entry.id === 'string' ? entry.id : ''
      if (!providerId) continue
      const models = await listModelsSafe(llm, providerId)
      const first = models.find((candidate) => candidate && typeof candidate.id === 'string' && candidate.id)
      if (first) return { ok: true, provider: providerId, model: first.id, displayName: first.name || first.id, source: 'catalog' }
    }
  }
  return { ok: false, code: 'NO_MODEL', message: '未找到可用模型，请先在设置中配置默认模型' }
}

/* ------------------------------------------------------------------------- */
/* HTTP plumbing                                                             */
/* ------------------------------------------------------------------------- */

/**
 * Read a JSON object body with a hard byte cap. Resolves to
 * `{ok:true, body}` or `{ok:false, status, code, message}`.
 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  const iterator = req && typeof req[Symbol.asyncIterator] === 'function' ? req[Symbol.asyncIterator]() : null
  if (iterator) {
    for (;;) {
      const step = await iterator.next()
      if (step.done) break
      const chunk = step.value
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      if (!buffer || typeof buffer.length !== 'number') continue
      size += buffer.length
      if (size > MAX_BODY_BYTES) {
        if (typeof iterator.return === 'function') {
          try {
            await iterator.return()
          } catch (error) {
            /* ignore */
          }
        }
        return { ok: false, status: 413, code: 'INPUT_TOO_LARGE', message: '请求体超过 256KB 上限' }
      }
      chunks.push(buffer)
    }
  } else if (req && Buffer.isBuffer(req.body)) {
    chunks.push(req.body)
    size = req.body.length
    if (size > MAX_BODY_BYTES) return { ok: false, status: 413, code: 'INPUT_TOO_LARGE', message: '请求体超过 256KB 上限' }
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return { ok: false, status: 400, code: 'INVALID_JSON', message: '请求体不能为空' }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { ok: false, status: 400, code: 'INVALID_JSON', message: '请求体不是合法 JSON' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 400, code: 'INVALID_JSON', message: '请求体必须是 JSON 对象' }
  }
  return { ok: true, body: parsed }
}

/** Validate review input types and the 24000-character budget. */
function validateReviewInput(body) {
  if (!body || typeof body !== 'object') return { ok: false, status: 400, code: 'INVALID_INPUT', message: '请求体必须是 JSON 对象' }
  if (typeof body.title !== 'string' || !body.title.trim()) return { ok: false, status: 400, code: 'TITLE_REQUIRED', message: '标题不能为空' }
  if (typeof body.body !== 'string' || !body.body.trim()) return { ok: false, status: 400, code: 'BODY_REQUIRED', message: '正文不能为空' }
  let usage = ''
  if (body.usage !== undefined && body.usage !== null) {
    if (typeof body.usage !== 'string') return { ok: false, status: 400, code: 'INVALID_INPUT', message: 'usage 必须是字符串' }
    usage = body.usage
  }
  const titleLength = Array.from(body.title).length
  const bodyLength = Array.from(body.body).length
  const usageLength = Array.from(usage).length
  if (titleLength + bodyLength + usageLength > MAX_INPUT_CHARS) {
    return { ok: false, status: 413, code: 'INPUT_TOO_LARGE', message: '标题、正文与使用场景合计不能超过 24000 字符' }
  }
  return {
    ok: true,
    input: {
      title: body.title,
      body: body.body,
      usage,
      language: body.language === 'en' ? 'en' : 'zh',
    },
  }
}

/**
 * Consume one `ctx.llm.stream` call: assemble text, surface the terminal reason.
 * Returns `{ok:true,text}` or `{ok:false,kind,failure,thrown}`.
 */
async function collectModelText(llm, config, controller, request) {
  const chunks = []
  const blocks = new Map()
  let finished = null
  try {
    const options = {
      provider: config.provider,
      model: config.model,
      system: request.system,
      messages: [{ role: 'user', content: [{ type: 'text', text: request.user }] }],
      maxTokens: REVIEW_MAX_TOKENS,
      signal: controller.signal,
    }
    if (config.reasoningEffort !== undefined) options.reasoningEffort = config.reasoningEffort
    const stream = llm.stream(options)
    for await (const chunk of stream) {
      if (!chunk || typeof chunk !== 'object') continue
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') chunks.push(chunk.text)
      else if (chunk.type === 'block-end' && chunk.block && chunk.block.type === 'text' && typeof chunk.block.text === 'string') {
        blocks.set(typeof chunk.index === 'number' ? chunk.index : blocks.size, chunk.block.text)
      } else if (chunk.type === 'finish') {
        finished = chunk.reason || {}
      }
    }
  } catch (error) {
    return { ok: false, kind: 'thrown', thrown: error }
  }
  const text = chunks.length
    ? chunks.join('')
    : [...blocks.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, value]) => value)
        .join('')
  if (finished && (finished.kind === 'error' || finished.kind === 'aborted')) {
    return { ok: false, kind: finished.kind, failure: finished.failure || {} }
  }
  if (finished && finished.kind === 'max-tokens') return { ok: false, kind: 'max-tokens' }
  if (finished && finished.kind === 'tool-calls') return { ok: false, kind: 'tool-calls' }
  return { ok: true, text }
}

/** Map a failed model call (or an abort) to an HTTP response. */
function respondToModelFailure(res, failure, state, config) {
  if (state.timedOut) {
    fail(res, 504, 'TIMEOUT', '模型生成超时（' + Math.round(config.timeoutMs / 1000) + ' 秒内未完成）')
    return
  }
  if (state.clientGone) {
    fail(res, 499, 'ABORTED', '请求已断开，AI 评价已取消')
    return
  }
  const kind = failure && failure.kind
  if (kind === 'max-tokens') {
    fail(res, 502, 'TRUNCATED', '模型输出被 max-tokens 截断，未返回评价')
    return
  }
  if (kind === 'thrown') {
    fail(res, 502, 'MODEL_ERROR', '模型调用失败', errorDetail(failure.thrown))
    return
  }
  const failureInfo = failure && failure.failure ? failure.failure : {}
  const code = typeof failureInfo.code === 'string' && failureInfo.code ? failureInfo.code : kind || 'MODEL_ERROR'
  const message = typeof failureInfo.message === 'string' && failureInfo.message ? failureInfo.message : '模型调用失败'
  fail(res, 502, 'MODEL_ERROR', '模型调用失败', code + ': ' + message)
}

/**
 * One review request: validate input, resolve a model, stream once, and (only
 * when the text exceeds 200 visible characters) compress once. Failures never
 * return the oversized text.
 */
async function runReview(ctx, config, state, req, res) {
  const abort = new AbortController()
  const local = { timedOut: false, clientGone: false }
  if (res && typeof res.on === 'function') {
    res.on('close', () => {
      if (!res.writableEnded) {
        local.clientGone = true
        try {
          abort.abort()
        } catch (error) {
          /* ignore */
        }
      }
    })
  }
  if (req && typeof req.on === 'function') {
    req.on('aborted', () => {
      local.clientGone = true
      try {
        abort.abort()
      } catch (error) {
        /* ignore */
      }
    })
  }
  const timer = setTimeout(() => {
    local.timedOut = true
    try {
      abort.abort()
    } catch (error) {
      /* ignore */
    }
  }, config.timeoutMs)
  if (timer && typeof timer.unref === 'function') timer.unref()

  try {
    const parsed = await readJsonBody(req)
    if (!parsed.ok) {
      fail(res, parsed.status, parsed.code, parsed.message)
      return
    }
    const validated = validateReviewInput(parsed.body)
    if (!validated.ok) {
      fail(res, validated.status, validated.code, validated.message)
      return
    }
    if (local.clientGone) {
      respondToModelFailure(res, { kind: 'aborted' }, local, config)
      return
    }
    const route = await resolveRoute(ctx, config)
    if (!route.ok) {
      fail(res, 409, 'NO_MODEL', route.message || '未找到可用模型')
      return
    }
    const llm = getService(ctx, 'llm')
    const reasoningEffort = await resolveLowestEffort(llm, route.provider, route.model, abort.signal)
    if (local.timedOut || local.clientGone) {
      respondToModelFailure(res, { kind: 'aborted' }, local, config)
      return
    }
    const callRoute = reasoningEffort === undefined ? route : { ...route, reasoningEffort }
    const input = validated.input
    const request = buildAiReviewRequest(input)
    const first = await collectModelText(llm, callRoute, abort, request)
    if (!first.ok) {
      respondToModelFailure(res, first, local, config)
      return
    }
    if (local.timedOut || local.clientGone) {
      respondToModelFailure(res, { kind: 'aborted' }, local, config)
      return
    }
    let checked = validateAiReviewText(first.text)
    if (!checked.ok && checked.code === 'EMPTY') {
      fail(res, 502, 'EMPTY_RESPONSE', '模型返回了空评价')
      return
    }
    if (!checked.ok && checked.code === 'TOO_LONG') {
      // Exactly one compression attempt; a still-oversized result is never returned.
      const compression = buildCompressionRequest({ previousText: first.text, language: input.language })
      const second = await collectModelText(llm, callRoute, abort, compression)
      if (!second.ok) {
        respondToModelFailure(res, second, local, config)
        return
      }
      if (local.timedOut || local.clientGone) {
        respondToModelFailure(res, { kind: 'aborted' }, local, config)
        return
      }
      checked = validateAiReviewText(second.text)
      if (!checked.ok && checked.code === 'EMPTY') {
        fail(res, 502, 'EMPTY_RESPONSE', '压缩后的评价为空')
        return
      }
      if (!checked.ok && checked.code === 'TOO_LONG') {
        fail(res, 502, 'TOO_LONG', 'AI 评价仍超过 200 个可见字符，已拒绝返回', 'count=' + checked.count)
        return
      }
    }
    writeJson(res, 200, {
      ok: true,
      review: {
        text: checked.text,
        provider: route.provider,
        model: route.model,
        generatedAt: Date.now(),
        count: checked.count,
      },
    })
  } catch (error) {
    if (local.timedOut) {
      fail(res, 504, 'TIMEOUT', '模型生成超时')
    } else if (local.clientGone) {
      fail(res, 499, 'ABORTED', '请求已断开，AI 评价已取消')
    } else {
      log(ctx, 'warn', 'review failed: ' + errorDetail(error))
      fail(res, 502, 'MODEL_ERROR', 'AI 评价失败', errorDetail(error))
    }
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------------- */
/* Route handlers                                                            */
/* ------------------------------------------------------------------------- */

/** GET /dsh-prompt-library/ai/status */
async function handleStatus(ctx, config, req, res) {
  const method = req && req.method ? req.method : 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    fail(res, 405, 'METHOD_NOT_ALLOWED', '该路由仅接受 GET')
    return
  }
  if (!assertTrustedOrigin(req, res)) return
  let route
  try {
    route = await resolveRoute(ctx, config)
  } catch (error) {
    log(ctx, 'warn', 'model resolution failed: ' + errorDetail(error))
    route = { ok: false, code: 'NO_MODEL', message: '模型解析失败' }
  }
  if (!route.ok) {
    writeJson(res, 200, { ok: true, available: false, code: route.code, message: route.message })
    return
  }
  writeJson(res, 200, {
    ok: true,
    available: true,
    provider: route.provider,
    model: route.model,
    displayName: route.displayName || route.model,
    source: route.source,
  })
}

/** POST /dsh-prompt-library/ai/review */
async function handleReview(ctx, config, state, req, res) {
  const method = req && req.method ? req.method : 'POST'
  if (method !== 'POST') {
    fail(res, 405, 'METHOD_NOT_ALLOWED', '该路由仅接受 POST')
    return
  }
  if (!assertTrustedOrigin(req, res)) return
  if (state.inFlight >= MAX_CONCURRENT_REVIEWS) {
    fail(res, 429, 'BUSY', '同时进行的 AI 评价已达上限（2 个），请稍后再试')
    return
  }
  state.inFlight += 1
  try {
    await runReview(ctx, config, state, req, res)
  } finally {
    state.inFlight -= 1
  }
}

/* ------------------------------------------------------------------------- */
/* Plugin entry                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Register the two optional routes. Without a `webServer` service the plugin
 * still activates; the callback simply never runs.
 */
export function apply(ctx, config) {
  if (!ctx || typeof ctx.inject !== 'function') return
  const options = normalizeConfig(config)
  const state = { inFlight: 0 }
  ctx.inject(['webServer'], (sctx) => {
    const server = getService(sctx, 'webServer')
    if (!server || typeof server.register !== 'function') return
    const disposers = []
    const register = (path, handler) => {
      try {
        const dispose = server.register({ kind: 'exact', path, handler })
        if (typeof dispose === 'function') disposers.push(dispose)
      } catch (error) {
        // A duplicate path is a composition error, not a plugin crash.
        log(ctx, 'warn', 'route registration failed for ' + path + ': ' + errorDetail(error))
      }
    }
    register(STATUS_PATH, (req, res) => handleStatus(ctx, options, req, res))
    register(REVIEW_PATH, (req, res) => handleReview(ctx, options, state, req, res))
    if (typeof ctx.effect === 'function') {
      ctx.effect(() => () => {
        while (disposers.length) {
          const dispose = disposers.pop()
          try {
            dispose()
          } catch (error) {
            /* disposal is best effort */
          }
        }
      })
    }
  })
}
