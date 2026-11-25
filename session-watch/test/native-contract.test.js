import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots';
import { createDefaultState } from '../core.js';

// Use the official registration validator, not a Map that accepts any shape.
// React/native Factory presentation is exercised separately by UI fixtures.
test('official SlotCore accepts native pane declaration and unload cascades only plugin-owned slots', async () => {
  const core = new SlotCore(); const disposers = [];
  const rootOff = core.register({ name: 'root', children: {
    main: { kind: 'keyed', scope: 'root' },
    'sidebar.panellist': { kind: 'list', scope: 'root' },
    'conversation.session.header.actions': { kind: 'list', scope: 'session' },
    'sidebar.workspaces.session.menu.item': { kind: 'list', scope: 'root' },
  } }, () => null);
  const dom = new JSDOM('<!doctype html><head></head><body></body>', { url: 'http://localhost/', runScripts: 'outside-only' });
  dom.window.fetch = async () => ({ status: 200, json: async () => ({ state: createDefaultState() }) });
  const services = {
    sessions: {}, layout: {}, uiWorkspace: {},
    slots: {
      inject(name, callback) { assert.ok(core.specDynamic(name), 'undeclared dependency: ' + name); const off = callback(); disposers.push(off); return off; },
      register(options, component) { return core.register(options, component); },
    },
  };
  dom.window.__ModuleLoader__ = { load({ factory }) {
    const plugin = factory(id => { assert.equal(id, 'react'); return React; });
    plugin.apply({ get: key => services[key], effect(callback) { disposers.push(callback()); } });
  } };
  try {
    dom.window.eval(await readFile(new URL('../client.js', import.meta.url), 'utf8'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(core.specDynamic('session-watch.native').scope, 'session');
    assert.equal(core.entriesOfSlot('session-watch.native').length, 1);
    const entry = core.entriesOfSlot('main').find(item => item.options.key === 'session-watch');
    assert.ok(entry);
    assert.equal(entry.children['session-watch.native'].scope, 'session');
    assert.equal(core.entriesOfSlot('conversation.composer.bar').length, 0);
    assert.equal(core.entriesOfSlot('conversation.view').length, 0);
    // No global native Composer/View contribution has been overridden.
  } finally {
    for (const off of disposers.reverse()) if (typeof off === 'function') off();
    assert.equal(core.specDynamic('session-watch.native'), undefined);
    assert.ok(core.specDynamic('main')); // owned by the host fixture, not us
    rootOff(); dom.window.close();
  }
});
