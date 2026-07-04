// FireBoard Probes Card — v3
// Circular gauge per channel, editable target temps, per-channel notify
// toggles, automatic light/dark theme matching, and a visual editor for
// picking which channels show on the card.
//
// Install: copy to /config/www/fireboard-card.js, then add as a Lovelace
// resource (Settings > Dashboards > ... > Resources > Add Resource,
// URL: /local/fireboard-card.js, type: JavaScript Module).
//
// You can hand-write YAML as before, or add the card via the UI ("+ Add
// Card" > FireBoard Probes Card) and use the visual editor to check which
// channels appear and fill in each channel's sensor/target/notify entities.

const FONT_IMPORT_ID = 'fireboard-card-fonts';
const RADIUS = 65;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PALETTES = {
  dark: {
    bg: '#14161b',
    panel: '#1c1f26',
    track: '#2a2e37',
    text: '#f2efe9',
    textDim: '#8a91a0',
    fieldBg: 'rgba(255,255,255,0.06)',
    divider: 'rgba(255,255,255,0.06)',
  },
  light: {
    bg: '#f7f5f0',
    panel: '#ffffff',
    track: '#e4e0d6',
    text: '#2b2a27',
    textDim: '#6f6b62',
    fieldBg: 'rgba(0,0,0,0.05)',
    divider: 'rgba(0,0,0,0.08)',
  },
};
const COLD = '#3e8ede';
const WARM = '#ffb020';
const HOT = '#ff4d2e';

function ensureFonts() {
  if (document.getElementById(FONT_IMPORT_ID)) return;
  const link = document.createElement('link');
  link.id = FONT_IMPORT_ID;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Roboto+Mono:wght@500;700&display=swap';
  document.head.appendChild(link);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function resolveChannelName(ch, hass) {
  if (ch.name) return ch.name;
  const state = hass?.states?.[ch.sensor];
  return state?.attributes?.friendly_name || ch.sensor || 'Channel';
}

function isDarkMode(hass) {
  if (typeof hass?.themes?.darkMode === 'boolean') return hass.themes.darkMode;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

class FireboardCard extends HTMLElement {
  setConfig(config) {
    if (!config.channels || !Array.isArray(config.channels) || !config.channels.length) {
      throw new Error('fireboard-card: you must define at least one channel in "channels"');
    }
    this.config = config;
    this._uid = Math.random().toString(36).slice(2, 9);
    this._editing = new Set();
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    const dark = isDarkMode(hass);
    const themeChanged = this._isDark !== dark;
    this._isDark = dark;

    if (!this._built) {
      ensureFonts();
      this._buildCard();
      this._built = true;
    } else if (themeChanged) {
      this._applyPalette();
    }
    this._updateValues();
  }

  get _visibleChannels() {
    return this.config.channels.filter((ch) => ch.enabled !== false);
  }

  _applyPalette() {
    const p = PALETTES[this._isDark ? 'dark' : 'light'];
    this._card.style.setProperty('--fb-bg', p.bg);
    this._card.style.setProperty('--fb-panel', p.panel);
    this._card.style.setProperty('--fb-track', p.track);
    this._card.style.setProperty('--fb-text', p.text);
    this._card.style.setProperty('--fb-text-dim', p.textDim);
    this._card.style.setProperty('--fb-field-bg', p.fieldBg);
    this._card.style.setProperty('--fb-divider', p.divider);
  }

  _buildCard() {
    const card = document.createElement('ha-card');
    card.style.cssText = `
      --fb-cold: ${COLD};
      --fb-warm: ${WARM};
      --fb-hot: ${HOT};
      background: var(--fb-bg);
      border-radius: 16px;
      overflow: hidden;
      padding: 0;
      font-family: 'Chakra Petch', 'Segoe UI', sans-serif;
      transition: background 0.2s ease;
    `;
    this._card = card;
    this._applyPalette();

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px 10px;
      border-bottom: 1px solid var(--fb-divider);
    `;
    const title = document.createElement('div');
    title.textContent = this.config.title || 'FireBoard';
    title.style.cssText = `
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-size: 0.95em;
      color: var(--fb-text);
    `;
    const flameBar = document.createElement('div');
    flameBar.style.cssText = `
      width: 44px; height: 4px; border-radius: 2px;
      background: linear-gradient(90deg, var(--fb-cold), var(--fb-warm), var(--fb-hot));
    `;
    header.appendChild(title);
    header.appendChild(flameBar);

    const grid = document.createElement('div');
    const columns = this.config.columns || 'auto-fill';
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${columns === 'auto-fill' ? 'auto-fill, minmax(140px, 1fr)' : columns});
      gap: 14px;
      padding: 16px 18px 18px;
    `;

    this._visibleChannels.forEach((ch, i) => {
      const tile = document.createElement('div');
      tile.dataset.channel = i;
      tile.style.cssText = `
        background: var(--fb-panel);
        border-radius: 14px;
        padding: 12px 10px 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        box-shadow: inset 0 0 0 1px var(--fb-divider);
      `;

      const gaugeWrap = document.createElement('div');
      gaugeWrap.style.cssText = 'position: relative; width: 130px; height: 130px;';

      const gradId = `fb-grad-${this._uid}-${i}`;
      gaugeWrap.innerHTML = `
        <svg viewBox="0 0 160 160" width="130" height="130">
          <defs>
            <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${COLD}"/>
              <stop offset="55%" stop-color="${WARM}"/>
              <stop offset="100%" stop-color="${HOT}"/>
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r="${RADIUS}" fill="none" stroke="var(--fb-track)" stroke-width="10"/>
          <circle data-role="value-arc" cx="80" cy="80" r="${RADIUS}" fill="none"
            stroke="url(#${gradId})" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${CIRCUMFERENCE}"
            style="transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 0.6s ease;"/>
          <line data-role="target-tick" x1="80" y1="80" x2="80" y2="80"
            stroke="var(--fb-text)" stroke-width="3" stroke-linecap="round"/>
        </svg>
      `;

      const center = document.createElement('div');
      center.style.cssText = `
        position: absolute; inset: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
      `;
      const tempEl = document.createElement('div');
      tempEl.dataset.role = 'temp';
      tempEl.style.cssText = `
        font-family: 'Roboto Mono', monospace;
        font-weight: 700;
        font-size: 1.55em;
        color: var(--fb-text);
        line-height: 1;
      `;
      const nameEl = document.createElement('div');
      nameEl.dataset.role = 'name';
      nameEl.textContent = resolveChannelName(ch, this._hass);
      nameEl.style.cssText = `
        margin-top: 4px;
        font-size: 0.72em;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        color: var(--fb-text-dim);
        text-align: center;
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
      center.appendChild(tempEl);
      center.appendChild(nameEl);
      gaugeWrap.appendChild(center);

      const controls = document.createElement('div');
      controls.style.cssText = 'display:flex; align-items:center; gap:8px; width:100%; justify-content:center;';

      const targetBtn = document.createElement('button');
      targetBtn.dataset.role = 'target-btn';
      targetBtn.type = 'button';
      targetBtn.style.cssText = `
        background: var(--fb-field-bg);
        border: none; border-radius: 8px;
        color: var(--fb-text-dim);
        font-family: 'Roboto Mono', monospace;
        font-size: 0.75em;
        padding: 5px 8px;
        cursor: pointer;
      `;
      targetBtn.addEventListener('click', () => {
        if (!ch.target) {
          alert('No target helper is set for this channel yet. Edit the card and use "+ create new helper" or pick an existing input_number entity.');
          return;
        }
        this._openTargetEditor(i, targetBtn, ch);
      });

      const notifyBtn = document.createElement('button');
      notifyBtn.dataset.role = 'notify-btn';
      notifyBtn.type = 'button';
      notifyBtn.title = 'Toggle notifications';
      notifyBtn.style.cssText = `
        background: var(--fb-field-bg);
        border: none; border-radius: 8px;
        width: 26px; height: 26px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-size: 0.9em;
        color: var(--fb-text-dim);
      `;
      notifyBtn.textContent = '🔔';
      notifyBtn.addEventListener('click', () => {
        if (!ch.notify) {
          alert('No notify helper is set for this channel yet. Edit the card and use "+ create new helper" or pick an existing input_boolean entity.');
          return;
        }
        const isOn = this._hass.states[ch.notify]?.state === 'on';
        this._hass.callService('input_boolean', isOn ? 'turn_off' : 'turn_on', {
          entity_id: ch.notify,
        });
      });

      controls.appendChild(targetBtn);
      controls.appendChild(notifyBtn);

      tile.appendChild(gaugeWrap);
      tile.appendChild(controls);
      grid.appendChild(tile);
    });

    card.appendChild(header);
    card.appendChild(grid);
    this.innerHTML = '';
    this.appendChild(card);
    this._tiles = grid.querySelectorAll('[data-channel]');
  }

  _openTargetEditor(i, btn, ch) {
    if (this._editing.has(i)) return;
    this._editing.add(i);
    const current = this._hass.states[ch.target]?.state ?? '';
    btn.innerHTML = '';
    const input = document.createElement('input');
    input.type = 'number';
    input.value = current;
    input.style.cssText = `
      width: 52px; text-align: center;
      background: transparent; border: none; border-bottom: 1px solid var(--fb-text-dim);
      color: var(--fb-text); font-family: 'Roboto Mono', monospace; font-size: 1em;
      outline: none;
    `;
    const commit = () => {
      const value = parseFloat(input.value);
      if (!Number.isNaN(value)) {
        this._hass.callService('input_number', 'set_value', { entity_id: ch.target, value });
      }
      this._editing.delete(i);
      this._updateValues();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
    btn.appendChild(input);
    input.focus();
    input.select();
  }

  _updateValues() {
    if (!this._tiles) return;

    this._visibleChannels.forEach((ch, i) => {
      const tile = this._tiles[i];
      if (!tile) return;

      const min = ch.min ?? 32;
      const max = ch.max ?? 500;

      const sensorState = this._hass.states[ch.sensor];
      const rawVal = sensorState ? parseFloat(sensorState.state) : NaN;
      const hasVal = !Number.isNaN(rawVal);
      const unit = sensorState?.attributes?.unit_of_measurement || '°F';

      const nameEl = tile.querySelector('[data-role="name"]');
      if (nameEl) nameEl.textContent = resolveChannelName(ch, this._hass);

      const tempEl = tile.querySelector('[data-role="temp"]');
      tempEl.textContent = hasVal ? `${Math.round(rawVal)}°` : '—';

      const arc = tile.querySelector('[data-role="value-arc"]');
      const fraction = hasVal ? clamp((rawVal - min) / (max - min), 0, 1) : 0;
      arc.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - fraction)));

      const targetState = ch.target ? this._hass.states[ch.target] : undefined;
      const targetVal = targetState ? parseFloat(targetState.state) : NaN;
      const tick = tile.querySelector('[data-role="target-tick"]');
      if (!Number.isNaN(targetVal)) {
        const tFraction = clamp((targetVal - min) / (max - min), 0, 1);
        const angle = -90 + tFraction * 360;
        const rad = (angle * Math.PI) / 180;
        const x1 = 80 + 57 * Math.cos(rad);
        const y1 = 80 + 57 * Math.sin(rad);
        const x2 = 80 + 74 * Math.cos(rad);
        const y2 = 80 + 74 * Math.sin(rad);
        tick.setAttribute('x1', x1);
        tick.setAttribute('y1', y1);
        tick.setAttribute('x2', x2);
        tick.setAttribute('y2', y2);
        tick.style.opacity = '1';
      } else {
        tick.style.opacity = '0';
      }

      const targetBtn = tile.querySelector('[data-role="target-btn"]');
      if (!this._editing.has(i)) {
        if (!ch.target) {
          targetBtn.textContent = 'no helper set';
        } else {
          targetBtn.textContent = Number.isNaN(targetVal) ? 'set target' : `🎯 ${targetVal}${unit}`;
        }
      }

      const notifyBtn = tile.querySelector('[data-role="notify-btn"]');
      const notifyOn = ch.notify && this._hass.states[ch.notify]?.state === 'on';
      notifyBtn.style.opacity = ch.notify ? '1' : '0.4';
      notifyBtn.style.background = notifyOn ? 'rgba(255,80,40,0.18)' : 'var(--fb-field-bg)';
      notifyBtn.style.color = notifyOn ? HOT : 'var(--fb-text-dim)';
    });
  }

  getCardSize() {
    return Math.ceil((this._visibleChannels.length || 1) / 3) * 3 + 1;
  }

  static getStubConfig() {
    return {
      title: 'FireBoard',
      channels: [
        {
          sensor: 'sensor.fireboard1_smoker',
          name: 'Smoker',
          target: 'input_number.fireboard_smoker_target',
          notify: 'input_boolean.fireboard_smoker_notify',
          min: 32,
          max: 500,
          enabled: true,
        },
        {
          sensor: 'sensor.fireboard1_channel2',
          name: 'Brisket',
          target: 'input_number.fireboard_channel2_target',
          notify: 'input_boolean.fireboard_channel2_notify',
          min: 32,
          max: 250,
          enabled: true,
        },
      ],
    };
  }

  static getConfigElement() {
    return document.createElement('fireboard-card-editor');
  }
}

// -------------------- Visual editor --------------------
// Lets you check which channels show on the card, edit each channel's
// entities inline, and add/remove channels — no YAML required.

class FireboardCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config || {}));
    if (!this._config.channels) this._config.channels = [];
    this._built = false;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    if (this._built) this._refreshPickers();
    else this._render();
  }

  _fireChanged() {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _entityPicker(value, includeDomain, onChange) {
    const picker = document.createElement('ha-entity-picker');
    picker.hass = this._hass;
    picker.value = value || '';
    picker.includeDomains = includeDomain ? [includeDomain] : undefined;
    picker.allowCustomEntity = true;
    picker.style.cssText = 'display:block; margin-bottom:4px;';
    picker.addEventListener('value-changed', (e) => {
      e.stopPropagation();
      onChange(e.detail.value);
    });
    return picker;
  }

  async _createInputNumberHelper(ch) {
    try {
      const name = `${ch.name || 'FireBoard channel'} target`;
      const result = await this._hass.callWS({
        type: 'input_number/create',
        name,
        min: ch.min ?? 32,
        max: ch.max ?? 500,
        step: 1,
        unit_of_measurement: '°F',
        icon: 'mdi:thermometer',
      });
      ch.target = `input_number.${result.id}`;
      this._fireChanged();
      this._render();
    } catch (err) {
      alert(`Couldn't create helper: ${err.message || err}. You can create one manually under Settings > Devices & Services > Helpers instead.`);
    }
  }

  async _createInputBooleanHelper(ch) {
    try {
      const name = `${ch.name || 'FireBoard channel'} notify`;
      const result = await this._hass.callWS({
        type: 'input_boolean/create',
        name,
        icon: 'mdi:bell',
      });
      ch.notify = `input_boolean.${result.id}`;
      this._fireChanged();
      this._render();
    } catch (err) {
      alert(`Couldn't create helper: ${err.message || err}. You can create one manually under Settings > Devices & Services > Helpers instead.`);
    }
  }

  _createHelperButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = `
      border: none; background: transparent; color: var(--primary-color);
      font-size: 11px; cursor: pointer; padding: 0; text-decoration: underline;
    `;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _render() {
    this.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding: 8px 4px; display:flex; flex-direction:column; gap:16px;';

    // Title + columns
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex; gap:12px;';

    const titleField = document.createElement('div');
    titleField.style.flex = '1';
    titleField.innerHTML = `<label style="font-size:12px; color:var(--secondary-text-color);">Title</label>`;
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = this._config.title || '';
    titleInput.placeholder = 'FireBoard';
    titleInput.style.cssText = 'width:100%; box-sizing:border-box; padding:6px; border-radius:4px; border:1px solid var(--divider-color); background:var(--card-background-color); color:var(--primary-text-color);';
    titleInput.addEventListener('change', (e) => {
      this._config.title = e.target.value;
      this._fireChanged();
    });
    titleField.appendChild(titleInput);

    const colField = document.createElement('div');
    colField.style.width = '90px';
    colField.innerHTML = `<label style="font-size:12px; color:var(--secondary-text-color);">Columns</label>`;
    const colInput = document.createElement('input');
    colInput.type = 'number';
    colInput.min = '1';
    colInput.value = Number.isFinite(this._config.columns) ? this._config.columns : '';
    colInput.placeholder = 'auto';
    colInput.style.cssText = 'width:100%; box-sizing:border-box; padding:6px; border-radius:4px; border:1px solid var(--divider-color); background:var(--card-background-color); color:var(--primary-text-color);';
    colInput.addEventListener('change', (e) => {
      const v = parseInt(e.target.value, 10);
      this._config.columns = Number.isFinite(v) && v > 0 ? v : undefined;
      this._fireChanged();
    });
    colField.appendChild(colInput);

    topRow.appendChild(titleField);
    topRow.appendChild(colField);
    wrap.appendChild(topRow);

    // Channels
    const channelsHeader = document.createElement('div');
    channelsHeader.textContent = 'Channels';
    channelsHeader.style.cssText = 'font-size:13px; font-weight:500; color:var(--primary-text-color); margin-top:4px;';
    wrap.appendChild(channelsHeader);

    const list = document.createElement('div');
    list.style.cssText = 'display:flex; flex-direction:column; gap:10px;';

    this._config.channels.forEach((ch, i) => {
      const row = document.createElement('div');
      row.style.cssText = `
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: var(--card-background-color);
      `;

      const topLine = document.createElement('div');
      topLine.style.cssText = 'display:flex; align-items:center; gap:8px;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = ch.enabled !== false;
      checkbox.title = 'Show this channel on the card';
      checkbox.addEventListener('change', (e) => {
        ch.enabled = e.target.checked;
        this._fireChanged();
      });

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = ch.name || '';
      const deviceName = this._hass?.states?.[ch.sensor]?.attributes?.friendly_name;
      nameInput.placeholder = deviceName ? `Default: ${deviceName}` : 'Display name (optional)';
      nameInput.title = 'Leave blank to use the sensor\'s name from Home Assistant';
      nameInput.style.cssText = 'flex:1; padding:6px; border-radius:4px; border:1px solid var(--divider-color); background:var(--secondary-background-color); color:var(--primary-text-color);';
      nameInput.addEventListener('change', (e) => {
        ch.name = e.target.value || undefined;
        this._fireChanged();
      });

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.title = 'Remove channel';
      removeBtn.style.cssText = 'border:none; background:transparent; color:var(--secondary-text-color); cursor:pointer; font-size:14px; padding:4px 8px;';
      removeBtn.addEventListener('click', () => {
        this._config.channels.splice(i, 1);
        this._fireChanged();
        this._render();
      });

      topLine.appendChild(checkbox);
      topLine.appendChild(nameInput);
      topLine.appendChild(removeBtn);
      row.appendChild(topLine);

      const pickerGrid = document.createElement('div');
      pickerGrid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr 1fr; gap:6px;';

      const sensorWrap = document.createElement('div');
      sensorWrap.innerHTML = `<label style="font-size:11px; color:var(--secondary-text-color);">Temperature sensor</label>`;
      sensorWrap.appendChild(this._entityPicker(ch.sensor, 'sensor', (v) => { ch.sensor = v; this._fireChanged(); }));

      const targetWrap = document.createElement('div');
      targetWrap.innerHTML = `<label style="font-size:11px; color:var(--secondary-text-color);">Target helper</label>`;
      targetWrap.appendChild(this._entityPicker(ch.target, 'input_number', (v) => { ch.target = v; this._fireChanged(); }));
      if (!ch.target) {
        targetWrap.appendChild(this._createHelperButton('+ create new helper', () => this._createInputNumberHelper(ch)));
      }

      const notifyWrap = document.createElement('div');
      notifyWrap.innerHTML = `<label style="font-size:11px; color:var(--secondary-text-color);">Notify helper</label>`;
      notifyWrap.appendChild(this._entityPicker(ch.notify, 'input_boolean', (v) => { ch.notify = v; this._fireChanged(); }));
      if (!ch.notify) {
        notifyWrap.appendChild(this._createHelperButton('+ create new helper', () => this._createInputBooleanHelper(ch)));
      }

      pickerGrid.appendChild(sensorWrap);
      pickerGrid.appendChild(targetWrap);
      pickerGrid.appendChild(notifyWrap);
      row.appendChild(pickerGrid);

      const rangeRow = document.createElement('div');
      rangeRow.style.cssText = 'display:flex; gap:12px; align-items:center;';
      rangeRow.innerHTML = `<label style="font-size:11px; color:var(--secondary-text-color);">Gauge range</label>`;

      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.value = ch.min ?? 32;
      minInput.style.cssText = 'width:70px; padding:4px; border-radius:4px; border:1px solid var(--divider-color); background:var(--secondary-background-color); color:var(--primary-text-color);';
      minInput.addEventListener('change', (e) => {
        ch.min = parseFloat(e.target.value);
        this._fireChanged();
      });

      const dash = document.createElement('span');
      dash.textContent = '–';
      dash.style.color = 'var(--secondary-text-color)';

      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.value = ch.max ?? 500;
      maxInput.style.cssText = 'width:70px; padding:4px; border-radius:4px; border:1px solid var(--divider-color); background:var(--secondary-background-color); color:var(--primary-text-color);';
      maxInput.addEventListener('change', (e) => {
        ch.max = parseFloat(e.target.value);
        this._fireChanged();
      });

      rangeRow.appendChild(minInput);
      rangeRow.appendChild(dash);
      rangeRow.appendChild(maxInput);
      row.appendChild(rangeRow);

      list.appendChild(row);
    });

    wrap.appendChild(list);

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add channel';
    addBtn.style.cssText = `
      align-self: flex-start;
      border: 1px solid var(--divider-color);
      background: var(--card-background-color);
      color: var(--primary-text-color);
      border-radius: 6px;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 13px;
    `;
    addBtn.addEventListener('click', () => {
      this._config.channels.push({
        sensor: '',
        name: 'New channel',
        target: '',
        notify: '',
        min: 32,
        max: 500,
        enabled: true,
      });
      this._fireChanged();
      this._render();
    });
    wrap.appendChild(addBtn);

    this.appendChild(wrap);
    this._built = true;
  }

  _refreshPickers() {
    this.querySelectorAll('ha-entity-picker').forEach((picker) => {
      picker.hass = this._hass;
    });
  }
}

customElements.define('fireboard-card', FireboardCard);
customElements.define('fireboard-card-editor', FireboardCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'fireboard-card',
  name: 'FireBoard Probes Card',
  description:
    'FireBoard-style circular gauges per channel, with editable target temps, notify toggles, light/dark theme support, and a visual channel picker.',
  preview: true,
});
