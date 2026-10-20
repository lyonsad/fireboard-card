const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class Element {
  constructor(tag = '') {
    this.localName = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.listeners = {};
  }
  set innerHTML(value) {
    this.html = value;
    this.children = [];
  }
  get innerHTML() { return this.html || ''; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  dispatchEvent(event) {
    this.lastEvent = event;
    this.listeners[event.type]?.(event);
  }
  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find(predicate);
      if (found) return found;
    }
  }
  querySelectorAll(selector) {
    const found = [];
    const matches = (node) => selector === '[data-channel]'
      ? node.dataset.channel !== undefined
      : node.localName === selector;
    const visit = (node) => {
      if (matches(node)) found.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return found;
  }
}

const registry = new Map();
const context = vm.createContext({
  HTMLElement: Element,
  document: { createElement: (tag) => {
    const Class = registry.get(tag);
    const element = Class ? new Class() : new Element(tag);
    element.localName = tag;
    return element;
  } },
  customElements: {
    define: (tag, Class) => registry.set(tag, Class),
    get: (tag) => registry.get(tag),
  },
  window: {},
  CustomEvent: class { constructor(type, options) { Object.assign(this, { type }, options); } },
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'fireboard-card.js'), 'utf8'), context);

const Card = registry.get('fireboard-card');
const Editor = registry.get('fireboard-card-editor');
const plain = (value) => JSON.parse(JSON.stringify(value));
const hass = { states: {
  'sensor.fireboard1_smoker': { state: '225', attributes: { friendly_name: 'FireBoard Smoker', unit_of_measurement: '°F' } },
  'sensor.fireboard2_probe': { state: '96', attributes: { friendly_name: 'FireBoard Probe', device_class: 'temperature', unit_of_measurement: '°C' } },
  'sensor.fireboard_battery': { state: '90', attributes: { friendly_name: 'FireBoard Battery', unit_of_measurement: '%' } },
  'sensor.fireboard3_drive_setpoint': { state: '225', attributes: { friendly_name: 'Controller', device_class: 'temperature', unit_of_measurement: '°F' } },
  'sensor.fireboard4_dial': { state: '225', attributes: { friendly_name: 'FireBoard Drive Setpoint', device_class: 'temperature', unit_of_measurement: '°F' } },
  'sensor.room': { state: '21', attributes: { friendly_name: 'Room', device_class: 'temperature', unit_of_measurement: '°C' } },
  'input_number.smoker_target': { state: '250', attributes: {} },
  'input_boolean.smoker_notify': { state: 'off', attributes: {} },
} };

test('picker registration and starter select only real FireBoard temperature sensors', () => {
  const metadata = context.window.customCards.find((card) => card.type === 'fireboard-card');
  assert.equal(metadata.preview, true);
  assert.match(metadata.documentationURL, /github.com\/lyonsad\/fireboard-card/);
  assert.equal(Card.getConfigElement().localName, 'fireboard-card-editor');
  const ids = Object.keys(hass.states);
  assert.deepEqual(plain(Card.getStubConfig(hass, ids, []).channels), [
    { sensor: 'sensor.fireboard1_smoker' },
    { sensor: 'sensor.fireboard2_probe' },
  ]);
  assert.deepEqual(plain(Card.getStubConfig(hass, [], ids).channels), [
    { sensor: 'sensor.fireboard1_smoker' },
    { sensor: 'sensor.fireboard2_probe' },
  ]);
  assert.deepEqual(plain(Card.getStubConfig(hass, [], []).channels), [{ sensor: '' }]);
});

test('setpoint-only discovery stays an editable blank starter', () => {
  const ids = ['sensor.fireboard3_drive_setpoint', 'sensor.fireboard4_dial'];
  assert.deepEqual(plain(Card.getStubConfig(hass, ids, []).channels), [{ sensor: '' }]);
  assert.deepEqual(plain(Card.getStubConfig(hass, [], ids).channels), [{ sensor: '' }]);
});

test('cold editor offers local entity choices and preserves YAML options', () => {
  const editor = new Editor();
  const config = { title: false, columns: 3, custom_option: 'keep', channels: [
    { sensor: 'sensor.fireboard1_smoker', min: 32, max: 500, enabled: false, extra: 42 },
  ] };
  editor.setConfig(config);
  editor.hass = hass;
  const choices = editor.querySelectorAll('option').map((option) => option.value);
  assert(choices.includes('sensor.fireboard1_smoker'));
  assert(choices.includes('input_number.smoker_target'));
  const targetList = editor.querySelectorAll('datalist')[1];
  const targetInput = editor.find((node) => node.localName === 'input' &&
    node.list === targetList.id);
  assert(targetInput);
  targetInput.value = 'input_number.smoker_target';
  targetInput.dispatchEvent({ type: 'change' });
  assert.equal(editor.lastEvent.type, 'config-changed');
  assert.equal(editor.lastEvent.detail.config.channels[0].target, 'input_number.smoker_target');
  assert.equal(editor.lastEvent.detail.config.channels[0].extra, 42);
  assert.equal(editor.lastEvent.detail.config.custom_option, 'keep');
  assert.equal(editor.lastEvent.detail.config.title, false);
  assert.equal(config.channels[0].target, undefined);
  assert.equal(editor.find((node) => node.title === 'Remove channel').disabled, true);
});

test('explicit columns produce valid repeat tracks and empty sensor is renderable', () => {
  const card = new Card();
  card.setConfig({ columns: 3, channels: [{ sensor: '' }] });
  card._hass = hass;
  card._buildCard();
  const grid = card.find((node) => node.style.cssText?.includes('grid-template-columns'));
  assert.match(grid.style.cssText, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.equal(card.querySelectorAll('[data-channel]').length, 1);
});
