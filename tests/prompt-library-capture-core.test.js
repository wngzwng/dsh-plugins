import test from 'node:test'
import assert from 'node:assert/strict'
import * as core from '../prompt-library/core.js'

const T = 1_700_000_000_000

let uidSeq = 0
const makeId = (prefix) => prefix + '-' + ++uidSeq

function fakePrompt(overrides = {}) {
  return {
    id: 'p-1',
    title: '标题',
    body: '正文',
    usage: '',
    tagIds: [],
    favorite: false,
    pinned: false,
    createdAt: T,
    updatedAt: T,
    bodyVersion: 1,
    score: { stars: null, note: '', ratedBodyVersion: null, ratedAt: null },
    lastUsedAt: null,
    useCount: 0,
    aiReview: null,
    ...overrides,
  }
}

function fakeData(overrides = {}) {
  return {
    version: 1,
    tags: [
      { id: 'tag-1', name: '写作', order: 0 },
      { id: 'tag-2', name: '翻译', order: 1 },
    ],
    prompts: [],
    ...overrides,
  }
}

function snapshot(value) {
  return JSON.parse(JSON.stringify(value))
}

/* ------------------------------------------------------------------------- */
/* constants                                                                 */
/* ------------------------------------------------------------------------- */

test('capture contract constants and new exports exist', () => {
  assert.deepEqual(core.ORGANIZE_STATES, ['inbox', 'organized'])
  assert.deepEqual(core.CAPTURE_KINDS, ['paste', 'composer', 'message'])
  assert.deepEqual(core.VIEWS, ['all', 'inbox', 'favorites', 'recent'])
  for (const name of [
    'ORGANIZE_STATES',
    'CAPTURE_KINDS',
    'normalizeCapture',
    'suggestCaptureTitle',
    'findCaptureDuplicates',
    'validateOrganize',
    'setOrganize',
  ]) {
    assert.equal(typeof core[name] !== 'undefined', true, name)
  }
})

test('validateOrganize accepts exactly the two organize states', () => {
  assert.equal(core.validateOrganize('inbox'), 'inbox')
  assert.equal(core.validateOrganize('organized'), 'organized')
  for (const value of ['INBOX', 'Inbox', 'triage', '', ' organized ', null, undefined, 0, true, {}, []]) {
    assert.equal(core.validateOrganize(value), undefined, String(value))
  }
})

/* ------------------------------------------------------------------------- */
/* normalizeCapture                                                          */
/* ------------------------------------------------------------------------- */

test('normalizeCapture rejects illegal structures with null', () => {
  for (const raw of [
    null,
    undefined,
    'paste',
    42,
    [],
    {},
    { kind: 'paste' },
    { kind: 'unknown', at: T },
    { kind: 'paste', at: '1700000000000' },
    { kind: 'paste', at: NaN },
    { kind: 'paste', at: Infinity },
    { at: T },
  ]) {
    assert.equal(core.normalizeCapture(raw), null, JSON.stringify(raw))
  }
})

test('normalizeCapture trims optional strings, drops empties and returns a copy', () => {
  const raw = { kind: 'message', at: T, sessionId: ' s-1 ', messageId: ' m-1 ', note: '  来源说明  ', extra: 'ignored' }
  const before = snapshot(raw)
  const capture = core.normalizeCapture(raw)
  assert.deepEqual(capture, { kind: 'message', at: T, sessionId: 's-1', messageId: 'm-1', note: '来源说明' })
  assert.notEqual(capture, raw)
  assert.deepEqual(raw, before, 'input must not be mutated')

  assert.deepEqual(core.normalizeCapture({ kind: 'paste', at: T, sessionId: '', messageId: '  ', note: '' }), {
    kind: 'paste',
    at: T,
  })
  assert.deepEqual(core.normalizeCapture({ kind: 'composer', at: T, sessionId: 42, note: null }), {
    kind: 'composer',
    at: T,
  })
})

/* ------------------------------------------------------------------------- */
/* suggestCaptureTitle                                                       */
/* ------------------------------------------------------------------------- */

test('suggestCaptureTitle uses the first non-empty line and never touches body', () => {
  const body = '\n\n   \t\n  第一行正文  \n第二行正文'
  assert.equal(core.suggestCaptureTitle(body), '第一行正文')
  assert.equal(body, '\n\n   \t\n  第一行正文  \n第二行正文', 'body is not modified')
  // Deterministic across calls.
  assert.equal(core.suggestCaptureTitle(body), core.suggestCaptureTitle(body))
})

test('suggestCaptureTitle strips leading Markdown block markers', () => {
  const cases = [
    ['# 一级标题', '一级标题'],
    ['###### 六级标题', '六级标题'],
    ['> 引用行', '引用行'],
    ['- 无序列表', '无序列表'],
    ['* 星号列表', '星号列表'],
    ['+ 加号列表', '加号列表'],
    ['1. 有序列表', '有序列表'],
    ['12) 有序列表', '有序列表'],
    ['> - 嵌套引用列表', '嵌套引用列表'],
    ['  ## 带缩进的标题', '带缩进的标题'],
  ]
  for (const [input, expected] of cases) {
    assert.equal(core.suggestCaptureTitle(input), expected, input)
  }
  // A marker without its required trailing space is ordinary text.
  assert.equal(core.suggestCaptureTitle('#标题'), '#标题')
  assert.equal(core.suggestCaptureTitle('>引用'), '>引用')
})

test('suggestCaptureTitle trims and collapses internal whitespace', () => {
  assert.equal(core.suggestCaptureTitle('#  每周   复盘\t计划\u3000安排 '), '每周 复盘 计划 安排')
  assert.equal(core.suggestCaptureTitle('   普通行   '), '普通行')
})

test('suggestCaptureTitle truncates at 40 visible characters with an ellipsis', () => {
  const exactly40 = 'a'.repeat(40)
  assert.equal(core.suggestCaptureTitle(exactly40), exactly40)
  assert.equal(core.suggestCaptureTitle(exactly40).includes('…'), false)

  // Over-long content keeps maxChars - 1 visible chars plus '…': the ellipsis
  // itself is punctuation and counts as a visible character, so the total
  // never exceeds 40.
  const long = core.suggestCaptureTitle('a'.repeat(41))
  assert.equal(long, 'a'.repeat(39) + '…')
  assert.equal(core.countVisibleChars(long), 40)
  assert.equal(long.endsWith('…'), true)
  assert.equal(long.startsWith('a'.repeat(39)), true)

  // A long no-space title (the capture UI case) stays within the 40 budget.
  const long72 = core.suggestCaptureTitle('x'.repeat(72))
  assert.equal(core.countVisibleChars(long72), 40)
  assert.equal(long72.endsWith('…'), true)

  // Punctuation counts as visible characters.
  assert.equal(core.suggestCaptureTitle('。'.repeat(41)), '。'.repeat(39) + '…')

  // Whitespace does not count: 41 visible characters across a space truncate
  // to 39 visible content chars + '…' (40 visible in total).
  const spaced = core.suggestCaptureTitle('字'.repeat(20) + ' ' + '字'.repeat(21))
  assert.equal(spaced, '字'.repeat(20) + ' ' + '字'.repeat(19) + '…')
  assert.equal(core.countVisibleChars(spaced), 40)

  // Code points (not UTF-16 units) are the truncation unit.
  assert.equal(core.suggestCaptureTitle('😀'.repeat(41)), '😀'.repeat(39) + '…')

  // Whitespace never sits immediately before the ellipsis.
  const spacedTail = core.suggestCaptureTitle('字'.repeat(39) + '   尾巴')
  assert.equal(spacedTail, '字'.repeat(39) + '…')
  assert.equal(core.countVisibleChars(spacedTail), 40)
})

test('suggestCaptureTitle supports a custom limit and safe fallbacks', () => {
  assert.equal(core.suggestCaptureTitle('一二三四五六', 5), '一二三四…')
  assert.equal(core.suggestCaptureTitle('一二三', 1), '…')
  assert.equal(core.countVisibleChars(core.suggestCaptureTitle('一二三四五六', 5)), 5)
  assert.equal(core.suggestCaptureTitle('abc', 10), 'abc')
  // Invalid limits fall back to 40.
  assert.equal(core.suggestCaptureTitle('a'.repeat(41), 0), 'a'.repeat(39) + '…')
  assert.equal(core.suggestCaptureTitle('a'.repeat(41), 'x'), 'a'.repeat(39) + '…')

  // All-empty body has no title; the UI requires a title afterwards.
  for (const empty of ['', '   ', '\n\n\t \r\n']) {
    assert.equal(core.suggestCaptureTitle(empty), '')
  }
  // Non-string bodies never throw.
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.equal(core.suggestCaptureTitle(bad), '')
  }

  // If stripping the marker leaves nothing, DESIGN §9.2 falls back to the
  // trimmed raw line.
  assert.equal(core.suggestCaptureTitle('- '), '-')
})

/* ------------------------------------------------------------------------- */
/* findCaptureDuplicates                                                     */
/* ------------------------------------------------------------------------- */

function duplicateFixture() {
  return fakeData({
    prompts: [
      fakePrompt({ id: 'p-exact', title: '精确', body: '第一行\n第二行' }),
      fakePrompt({ id: 'p-crlf', title: 'CRLF', body: '第一行\r\n第二行' }),
      fakePrompt({ id: 'p-lf-padded', title: '首尾空白', body: ' \n第一行\n第二行\n ' }),
      fakePrompt({ id: 'p-internal', title: '内部空格', body: '第一行 \n第二行' }),
      fakePrompt({ id: 'p-case', title: '大小写', body: '第一行\n第二行ABC' }),
      fakePrompt({ id: 'p-title-diff', title: '不同标题', body: '第一行\n第二行', tagIds: ['tag-1'] }),
    ],
  })
}

test('findCaptureDuplicates returns exact body matches without touching data', () => {
  const data = duplicateFixture()
  const before = snapshot(data)
  const result = core.findCaptureDuplicates(data, '第一行\n第二行')
  assert.deepEqual(result.exact.map((prompt) => prompt.id), ['p-exact', 'p-title-diff'])
  assert.deepEqual(result.near.map((prompt) => prompt.id), ['p-crlf', 'p-lf-padded'])
  assert.equal(result.exact[0], data.prompts[0], 'returns the stored prompt objects')
  assert.deepEqual(data, before, 'data must not be mutated')
})

test('findCaptureDuplicates near only ignores newlines and surrounding whitespace', () => {
  const data = duplicateFixture()
  // Trimmed candidate: the padded body becomes near, the exact one stays near.
  const trimmed = core.findCaptureDuplicates(data, '第一行\n第二行')
  assert.equal(trimmed.near.some((prompt) => prompt.id === 'p-exact'), false, 'exact is never near')

  // CRLF / lone CR / trailing-space variants are near.
  const crlf = core.findCaptureDuplicates(data, '第一行\n第二行\r\n')
  assert.deepEqual(crlf.near.map((prompt) => prompt.id), ['p-exact', 'p-crlf', 'p-lf-padded', 'p-title-diff'])
  assert.equal(core.findCaptureDuplicates(data, '第一行\r第二行').near.some((prompt) => prompt.id === 'p-crlf'), true)

  // Internal whitespace differences are not duplicates: only an identical
  // body is exact, and adding/removing internal spaces never matches.
  assert.deepEqual(core.findCaptureDuplicates(data, '第一行 \n第二行').exact.map((prompt) => prompt.id), ['p-internal'])
  for (const internalVariant of ['第一行  \n第二行', '第一行\n 第二行', '第一行\t\n第二行']) {
    assert.equal(
      core.findCaptureDuplicates(data, internalVariant).near.some((prompt) => prompt.id === 'p-internal'),
      false,
      internalVariant,
    )
  }

  // Case differences are not duplicates.
  assert.deepEqual(core.findCaptureDuplicates(data, '第一行\n第二行abc').near, [])

  // Candidate with surrounding whitespace: padded stored body is exact.
  const padded = core.findCaptureDuplicates(data, ' \n第一行\n第二行\n ')
  assert.deepEqual(padded.exact.map((prompt) => prompt.id), ['p-lf-padded'])
  assert.deepEqual(padded.near.map((prompt) => prompt.id), ['p-exact', 'p-crlf', 'p-title-diff'])
})

test('findCaptureDuplicates only compares bodies and is defensive', () => {
  const data = fakeData({
    prompts: [
      fakePrompt({ id: 'p-1', title: '完全不相关', body: '唯一正文' }),
      null,
      'garbage',
    ],
  })
  const result = core.findCaptureDuplicates(data, '唯一正文')
  assert.deepEqual(result.exact.map((prompt) => prompt.id), ['p-1'])
  assert.deepEqual(result.near, [])

  assert.deepEqual(core.findCaptureDuplicates(null, 'x'), { exact: [], near: [] })
  assert.deepEqual(core.findCaptureDuplicates(undefined, undefined), { exact: [], near: [] })
  assert.deepEqual(core.findCaptureDuplicates({ prompts: 'nope' }, null), { exact: [], near: [] })
})

/* ------------------------------------------------------------------------- */
/* Prompt field normalization / creation / editing                           */
/* ------------------------------------------------------------------------- */

test('normalizePrompt defaults legacy data to organized/null', () => {
  const legacy = fakePrompt()
  delete legacy.organize
  delete legacy.capture
  const prompt = core.normalizePrompt(legacy, { now: T })
  assert.equal(prompt.organize, 'organized')
  assert.equal(prompt.capture, null)
  // Missing fields are not an error for the rest of the shape.
  assert.equal(prompt.title, '标题')
  assert.equal(prompt.createdAt, T)
  assert.equal(prompt.updatedAt, T)
})

test('normalizePrompt preserves legal fields and cleans illegal ones', () => {
  const good = core.normalizePrompt(
    fakePrompt({
      organize: 'inbox',
      capture: { kind: 'message', at: T + 3, sessionId: 's', messageId: 'm', note: 'n' },
    }),
    { now: T },
  )
  assert.equal(good.organize, 'inbox')
  assert.deepEqual(good.capture, { kind: 'message', at: T + 3, sessionId: 's', messageId: 'm', note: 'n' })

  const bad = core.normalizePrompt(fakePrompt({ organize: 'archive', capture: { kind: 'ghost', at: T } }), { now: T })
  assert.equal(bad.organize, 'organized')
  assert.equal(bad.capture, null)
})

test('createPrompt defaults organized/null and accepts legal capture metadata', () => {
  const plain = core.createPrompt({ title: 'A', body: 'B', now: T })
  assert.equal(plain.organize, 'organized')
  assert.equal(plain.capture, null)

  const captured = core.createPrompt({
    title: 'A',
    body: 'B',
    organize: 'inbox',
    capture: { kind: 'paste', at: T + 1, note: ' 来源 ' },
    now: T,
  })
  assert.equal(captured.organize, 'inbox')
  assert.deepEqual(captured.capture, { kind: 'paste', at: T + 1, note: '来源' })
  assert.equal(captured.createdAt, T)
  assert.equal(captured.updatedAt, T)

  const cleaned = core.createPrompt({ title: 'A', body: 'B', organize: 'bogus', capture: { kind: 'bogus', at: T } })
  assert.equal(cleaned.organize, 'organized')
  assert.equal(cleaned.capture, null)
})

test('updatePrompt keeps organize/capture metadata and never edits capture.at', () => {
  const prompt = core.createPrompt({
    title: 'A',
    body: 'B',
    organize: 'inbox',
    capture: { kind: 'message', at: T, sessionId: 's-1', messageId: 'm-1', note: '来源' },
    now: T,
  })
  const captureBefore = snapshot(prompt.capture)
  const edited = core.updatePrompt(prompt, { title: 'A2', body: 'B2', usage: '客服' }, T + 10)
  assert.equal(edited.updatedAt, T + 10)
  assert.equal(edited.bodyVersion, 2)
  assert.equal(edited.organize, 'inbox')
  assert.deepEqual(edited.capture, captureBefore)
  assert.equal(edited.capture.at, T, 'capture.at stays the capture time, independent of updatedAt')
  assert.deepEqual(prompt.capture, captureBefore, 'input prompt not mutated')

  // Undefined patch fields keep the original metadata.
  const untouched = core.updatePrompt(prompt, { favorite: true }, T + 11)
  assert.equal(untouched.organize, 'inbox')
  assert.deepEqual(untouched.capture, captureBefore)
})

test('updatePrompt accepts explicit organize/capture patches as metadata', () => {
  const prompt = core.createPrompt({ title: 'A', body: 'B', now: T })
  const reorganized = core.updatePrompt(prompt, { organize: 'inbox' }, T + 5)
  assert.equal(reorganized.organize, 'inbox')
  assert.equal(reorganized.updatedAt, T, 'organize is metadata, not a content edit')

  const captured = core.updatePrompt(prompt, { capture: { kind: 'composer', at: T + 6, sessionId: 's' } }, T + 7)
  assert.deepEqual(captured.capture, { kind: 'composer', at: T + 6, sessionId: 's' })
  assert.equal(captured.updatedAt, T)

  // Illegal patch values fall back to the existing metadata.
  assert.equal(core.updatePrompt(reorganized, { organize: 'weird' }, T + 8).organize, 'inbox')
  assert.equal(core.updatePrompt(captured, { capture: { kind: 'weird', at: T } }, T + 9).capture.kind, 'composer')
})

test('setOrganize returns a new prompt without refreshing updatedAt', () => {
  const prompt = core.createPrompt({ title: 'A', body: 'B', now: T })
  const inbox = core.setOrganize(prompt, 'inbox')
  assert.notEqual(inbox, prompt)
  assert.equal(inbox.organize, 'inbox')
  assert.equal(prompt.organize, 'organized', 'input not mutated')
  assert.equal(inbox.updatedAt, T)
  assert.equal(inbox.createdAt, T)

  const organized = core.setOrganize(inbox, 'organized')
  assert.equal(organized.organize, 'organized')
  assert.equal(organized.updatedAt, T)

  // Illegal status is a no-op (no throw); legacy prompts normalize first.
  assert.equal(core.setOrganize(inbox, 'triage').organize, 'inbox')
  const legacy = fakePrompt()
  delete legacy.organize
  assert.equal(core.setOrganize(legacy, 'inbox').organize, 'inbox')
  assert.equal(core.setOrganize(legacy, 'inbox').updatedAt, T)
})

/* ------------------------------------------------------------------------- */
/* normalizeState migration                                                  */
/* ------------------------------------------------------------------------- */

test('normalizeState migrates legacy prompts to organized/null (no batch inbox)', () => {
  const result = core.normalizeState(
    {
      version: 1,
      tags: [],
      prompts: [
        { id: 'p-1', title: 'A', body: 'B', createdAt: T, updatedAt: T },
        { id: 'p-2', title: 'C', body: 'D', createdAt: T, updatedAt: T, organize: 'inbox' },
      ],
    },
    { now: T },
  )
  assert.equal(result.ok, true)
  assert.equal(result.migrated, true)
  assert.equal(result.data.prompts[0].organize, 'organized')
  assert.equal(result.data.prompts[0].capture, null)
  assert.equal(result.data.prompts[1].organize, 'inbox', 'existing organize is preserved')
  assert.equal(result.data.prompts[1].capture, null)
})

test('normalizeState preserves legal organize/capture and cleans illegal values', () => {
  const result = core.normalizeState(
    {
      version: 1,
      tags: [],
      prompts: [
        {
          id: 'p-ok',
          title: 'A',
          body: 'B',
          createdAt: T,
          updatedAt: T,
          organize: 'inbox',
          capture: { kind: 'message', at: T, sessionId: 's', note: '来源' },
        },
        { id: 'p-bad', title: 'C', body: 'D', createdAt: T, updatedAt: T, organize: 'archive', capture: { kind: 'ghost', at: T } },
      ],
    },
    { now: T },
  )
  assert.equal(result.ok, true)
  assert.equal(result.data.prompts[0].organize, 'inbox')
  assert.deepEqual(result.data.prompts[0].capture, { kind: 'message', at: T, sessionId: 's', note: '来源' })
  assert.equal(result.data.prompts[1].organize, 'organized')
  assert.equal(result.data.prompts[1].capture, null)

  // A fully valid v1 prompt row needs no migration.
  const clean = core.normalizeState(
    {
      version: 1,
      tags: [],
      prompts: [
        {
          id: 'p-clean',
          title: 'A',
          body: 'B',
          createdAt: T,
          updatedAt: T,
          organize: 'organized',
          capture: { kind: 'paste', at: T },
        },
      ],
    },
    { now: T },
  )
  assert.equal(clean.migrated, false)
})

/* ------------------------------------------------------------------------- */
/* Inbox view                                                                */
/* ------------------------------------------------------------------------- */

test('matchesView/filterPrompts support the inbox view', () => {
  assert.equal(core.matchesView({ organize: 'inbox' }, 'inbox'), true)
  assert.equal(core.matchesView({ organize: 'organized' }, 'inbox'), false)
  assert.equal(core.matchesView({}, 'inbox'), false, 'legacy prompts are organized')
  assert.equal(core.matchesView(null, 'inbox'), false)
  assert.equal(core.matchesView({ organize: 'inbox' }, 'all'), true)

  const data = fakeData({
    prompts: [
      fakePrompt({ id: 'p-inbox', organize: 'inbox' }),
      fakePrompt({ id: 'p-organized', organize: 'organized' }),
      fakePrompt({ id: 'p-inbox-2', organize: 'inbox', title: '第二个' }),
    ],
  })
  assert.deepEqual(core.filterPrompts(data, { view: 'inbox' }).map((prompt) => prompt.id), ['p-inbox', 'p-inbox-2'])
  assert.deepEqual(core.filterPrompts(data, { view: 'all' }).map((prompt) => prompt.id), ['p-inbox', 'p-organized', 'p-inbox-2'])
  // Other filters still compose with inbox.
  assert.deepEqual(core.filterPrompts(data, { view: 'inbox', search: '第二个' }).map((prompt) => prompt.id), ['p-inbox-2'])
})

/* ------------------------------------------------------------------------- */
/* CSV                                                                       */
/* ------------------------------------------------------------------------- */

test('CSV exports organize and source note but never sessionId/messageId', () => {
  const data = fakeData({
    tags: [{ id: 'tag-1', name: '写作', order: 0 }],
    prompts: [
      fakePrompt({
        id: 'p-1',
        title: 'CSV 标题',
        body: 'CSV 正文',
        tagIds: ['tag-1'],
        organize: 'inbox',
        capture: {
          kind: 'message',
          at: T,
          sessionId: 'secret-session-1',
          messageId: 'secret-message-1',
          note: '来自对话',
        },
      }),
    ],
  })
  const csv = core.toCsv(data)
  const lines = csv.split('\r\n').filter(Boolean)
  assert.equal(lines[0], 'title,body,tags,usage,rating,note,organize,sourceNote')
  assert.equal(csv.includes('secret-session-1'), false)
  assert.equal(csv.includes('secret-message-1'), false)
  assert.equal(lines[1].endsWith(',inbox,来自对话'), true)

  const parsed = core.parseCsv(csv)
  assert.equal(parsed.ok, true, JSON.stringify(parsed))
  assert.equal(parsed.rows[0].organize, 'inbox')
  assert.equal(parsed.rows[0].sourceNote, '来自对话')

  const preview = core.validateCsvRows(parsed.rows, fakeData(), T + 100, makeId)
  const created = preview.newPrompts[0]
  assert.equal(created.organize, 'inbox')
  assert.deepEqual(created.capture, { kind: 'paste', at: T + 100, note: '来自对话' })
  assert.equal('sessionId' in created.capture, false)
  assert.equal('messageId' in created.capture, false)
  assert.equal(created.createdAt, T + 100, 'CSV capture.at and createdAt share the import timestamp')

  const applied = core.applyCsvImport(fakeData(), preview, T + 101)
  assert.equal(applied.data.prompts[0].organize, 'inbox')
  assert.deepEqual(applied.data.prompts[0].capture, { kind: 'paste', at: T + 100, note: '来自对话' })
})

test('CSV parses Chinese aliases and case-insensitive canonical headers', () => {
  const withAliases = core.parseCsv('标题,正文,整理状态,来源说明\nA,B,inbox,来自粘贴')
  assert.equal(withAliases.ok, true)
  assert.equal(withAliases.rows[0].organize, 'inbox')
  assert.equal(withAliases.rows[0].sourceNote, '来自粘贴')

  const shortAlias = core.parseCsv('标题,正文,来源\nA,B,来源备注')
  assert.equal(shortAlias.rows[0].sourceNote, '来源备注')

  for (const header of ['sourceNote', 'sourcenote', 'SOURCENOTE']) {
    const canonical = core.parseCsv('title,body,organize,' + header + '\nA,B,organized,备注')
    assert.equal(canonical.ok, true, header)
    assert.equal(canonical.rows[0].organize, 'organized')
    assert.equal(canonical.rows[0].sourceNote, '备注')
  }
})

test('CSV files without the new columns still import as organized with no capture', () => {
  const parsed = core.parseCsv('title,body,usage\n旧标题,旧正文,旧场景')
  assert.equal(parsed.ok, true)
  assert.equal(parsed.rows[0].organize, '')
  assert.equal(parsed.rows[0].sourceNote, '')

  const preview = core.validateCsvRows(parsed.rows, fakeData(), T, makeId)
  const created = preview.newPrompts[0]
  assert.equal(created.organize, 'organized')
  assert.equal(created.capture, null)
  assert.equal(created.usage, '旧场景')
})

test('CSV invalid organize defaults to organized and blank source note means no capture', () => {
  const rows = [
    { line: 2, title: 'A', body: 'B', organize: '收件箱', sourceNote: '' },
    { line: 3, title: 'C', body: 'D', organize: ' inbox ', sourceNote: '   ' },
    { line: 4, title: 'E', body: 'F', organize: 'organized', sourceNote: ' 来源说明 ' },
    { line: 5, title: 'G', body: 'H' },
  ]
  const preview = core.validateCsvRows(rows, fakeData(), T, makeId)
  assert.equal(preview.newPrompts.length, 4)
  assert.equal(preview.newPrompts[0].organize, 'organized')
  assert.equal(preview.newPrompts[0].capture, null)
  assert.equal(preview.newPrompts[1].organize, 'inbox', 'surrounding whitespace is tolerated')
  assert.equal(preview.newPrompts[1].capture, null)
  assert.equal(preview.newPrompts[2].organize, 'organized')
  assert.deepEqual(preview.newPrompts[2].capture, { kind: 'paste', at: T, note: '来源说明' })
  assert.equal(preview.newPrompts[3].organize, 'organized')
  assert.equal(preview.newPrompts[3].capture, null)
})

test('CSV duplicate detection is still title+body and ignores organize', () => {
  const data = fakeData({ prompts: [fakePrompt({ id: 'p-1', title: '重复', body: '正文' })] })
  const rows = [
    { line: 2, title: '重复', body: '正文', organize: 'inbox' },
    { line: 3, title: '新', body: 'N', organize: 'inbox' },
    { line: 4, title: '新', body: 'N', organize: 'organized' },
  ]
  const preview = core.validateCsvRows(rows, data, T, makeId)
  assert.deepEqual(preview.counts, { total: 3, newPrompts: 1, duplicates: 2, invalid: 0, newTags: 0 })
  assert.deepEqual(preview.duplicates.map((item) => [item.line, item.reason]), [
    [2, 'DUPLICATE_EXISTING'],
    [4, 'DUPLICATE_IN_CSV'],
  ])
  assert.equal(preview.newPrompts[0].organize, 'inbox')
})

/* ------------------------------------------------------------------------- */
/* JSON backup                                                               */
/* ------------------------------------------------------------------------- */

test('buildBackup/validateBackup round-trip preserves organize and capture metadata', () => {
  const capture = { kind: 'composer', at: T, sessionId: 'session-1', messageId: 'message-1', note: '来源备注' }
  const data = fakeData({
    tags: [{ id: 'tag-1', name: '写作', order: 0 }],
    prompts: [fakePrompt({ id: 'p-1', title: 'A', body: 'B', organize: 'inbox', capture })],
  })
  const before = snapshot(data)
  const backup = core.buildBackup(data, { now: T + 10 })
  assert.deepEqual(data, before, 'buildBackup must not mutate data')
  assert.equal(backup.data.prompts[0].organize, 'inbox')
  assert.deepEqual(backup.data.prompts[0].capture, capture)

  const file = JSON.parse(JSON.stringify(backup))
  const validated = core.validateBackup(file)
  assert.equal(validated.ok, true, JSON.stringify(validated))
  const restored = validated.data.prompts[0]
  assert.equal(restored.organize, 'inbox')
  assert.deepEqual(restored.capture, capture)
  assert.equal(restored.capture.at, T)
  assert.equal(restored.updatedAt, T)
})

test('validateBackup accepts legacy backups without organize/capture as organized/null', () => {
  const legacyPrompt = fakePrompt()
  delete legacyPrompt.organize
  delete legacyPrompt.capture
  const validated = core.validateBackup({ version: 1, tags: [], prompts: [legacyPrompt] })
  assert.equal(validated.ok, true, JSON.stringify(validated))
  assert.equal(validated.data.prompts[0].organize, 'organized')
  assert.equal(validated.data.prompts[0].capture, null)

  // A bare data root with the new fields is also accepted.
  const bare = core.validateBackup({
    version: 1,
    tags: [],
    prompts: [fakePrompt({ organize: 'inbox', capture: { kind: 'paste', at: T, note: '来自备份' } })],
  })
  assert.equal(bare.ok, true)
  assert.equal(bare.format, 'raw')
  assert.equal(bare.data.prompts[0].organize, 'inbox')
  assert.deepEqual(bare.data.prompts[0].capture, { kind: 'paste', at: T, note: '来自备份' })
})

test('validateBackup rejects illegal organize/capture values strictly', () => {
  const cases = [
    { organize: 'archive' },
    { organize: null },
    { capture: 'paste' },
    { capture: { kind: 'paste' } },
    { capture: { kind: 'ghost', at: T } },
    { capture: { kind: 'paste', at: 'yesterday' } },
    { capture: { kind: 'paste', at: T, note: 42 } },
    { capture: { kind: 'paste', at: T, sessionId: 5 } },
    { capture: { kind: 'paste', at: T, messageId: {} } },
  ]
  for (const overrides of cases) {
    const result = core.validateBackup({ version: 1, tags: [], prompts: [fakePrompt(overrides)] })
    assert.equal(result.ok, false, JSON.stringify(overrides))
    assert.equal(result.error.code, 'INVALID_DATA', JSON.stringify(overrides))
  }
  // capture:null is legal.
  const empty = core.validateBackup({ version: 1, tags: [], prompts: [fakePrompt({ organize: 'inbox', capture: null })] })
  assert.equal(empty.ok, true)
  assert.equal(empty.data.prompts[0].capture, null)
})

/* ------------------------------------------------------------------------- */
/* Robustness                                                                */
/* ------------------------------------------------------------------------- */

test('capture helpers never throw on garbage input', () => {
  const calls = [
    () => core.validateOrganize(undefined),
    () => core.normalizeCapture(undefined),
    () => core.normalizeCapture(Symbol('x')),
    () => core.suggestCaptureTitle(undefined, undefined),
    () => core.suggestCaptureTitle(null, 'x'),
    () => core.findCaptureDuplicates(undefined, undefined),
    () => core.findCaptureDuplicates('nope', 42),
    () => core.setOrganize(null, 'inbox'),
    () => core.matchesView(undefined, 'inbox'),
    () => core.normalizeState(undefined),
  ]
  for (const call of calls) assert.doesNotThrow(call)
})
