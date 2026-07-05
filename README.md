# FireBoard Probes Card

A Home Assistant Lovelace card for FireBoard thermometers (works with the
original FireBoard, FireBoard 2, Spark, etc. — anything on the FireBoard
Cloud). Shows each probe as a circular gauge with a live temperature, an
editable target temp, and a per-channel notification toggle. Matches your
Home Assistant light/dark theme automatically.

This card is a companion to
[fireboard2mqtt](https://github.com/gordlea/fireboard2mqtt), which brings
your FireBoard's sensors into Home Assistant via MQTT discovery. Install
that first — this card just visualizes the sensors it creates.

## Features

- Circular gauge per channel with a blue → amber → red temperature ramp
- Tap a gauge's target pill to set a target temp inline, no dashboard editing
- Per-channel notification toggle (bell icon)
- Pick which channels appear via a visual editor — no YAML required
- "+ create new helper" button in the editor creates the `input_number` /
  `input_boolean` helpers for you if you haven't made them yet
- Follows Home Assistant's light/dark theme

## Installation

### Via HACS (recommended)

1. HACS → Frontend → ⋮ (top right) → Custom repositories
2. Add this repository's URL, category: Lovelace
3. Search "FireBoard Probes Card" in HACS Frontend and install
4. Add the resource if HACS doesn't do it automatically: Settings →
   Dashboards → ⋮ → Resources → confirm `/hacsfiles/fireboard-card/fireboard-card.js`
   is listed as a JavaScript Module

### Manual install

1. Copy `fireboard-card.js` to `/config/www/fireboard-card.js`
2. Settings → Dashboards → ⋮ → Resources → Add Resource
   - URL: `/local/fireboard-card.js`
   - Type: JavaScript Module
3. Refresh your browser

## Adding the card

Dashboard → Edit → Add Card → search "FireBoard Probes Card", or add this
YAML directly:

```yaml
type: custom:fireboard-card
title: FireBoard
columns: 3
channels:
  - sensor: sensor.fireboard1_smoker
    name: Smoker
    target: input_number.fireboard_smoker_target
    notify: input_boolean.fireboard_smoker_notify
    min: 32
    max: 500
  - sensor: sensor.fireboard1_channel2
    name: Brisket
    target: input_number.fireboard_channel2_target
    notify: input_boolean.fireboard_channel2_notify
    min: 32
    max: 250
```

Only listed channels render, and each accepts:

| Key | Required | Description |
|---|---|---|
| `sensor` | yes | The FireBoard temperature sensor entity |
| `name` | no | Display label — defaults to the sensor's name in Home Assistant (e.g. "Smoker", "Channel2") if left unset |
| `target` | no | `input_number` entity holding the target temp |
| `notify` | no | `input_boolean` entity controlling that channel's alert |
| `min` / `max` | no | Gauge range, defaults to 32–500°F |
| `enabled` | no | Set `false` to hide without deleting the config |

If you don't already have `target`/`notify` helpers, add the card via the
UI editor and use the "+ create new helper" links — they'll create and wire
up the helpers for you. Manual helper definitions are in
[`examples/fireboard_helpers.yaml`](examples/fireboard_helpers.yaml) if you'd
rather manage them in YAML.

## Notifications

[`examples/fireboard_notifications_automation.yaml`](examples/fireboard_notifications_automation.yaml)
has a single automation covering every channel — it checks each channel's
notify helper before sending, and reads the current target dynamically so
you never have to edit the automation itself when you change a target temp.

## Optional: only show the card during an active cook

FireBoard's Cloud API doesn't currently expose a reliable "is there an
active session right now" flag via `fireboard2mqtt` (see
[gordlea/fireboard2mqtt](https://github.com/gordlea/fireboard2mqtt) —
this may improve in the future). In the meantime, you can infer it from
your existing channel sensors: if any channel is reporting a real,
non-zero temperature, a cook is probably happening.

### 1. Create the "session active" helper

Settings → Devices & Services → **Helpers** → **+ Create Helper** →
**Template** → **Template a binary sensor**.

- **Name:** `FireBoard Session Active`
- **State** — paste this template, updating the entity list to match your
  own channel sensors:

  ```
  {% set channels = [
    'sensor.fireboard1_channel1',
    'sensor.fireboard1_channel2',
    'sensor.fireboard1_channel3',
    'sensor.fireboard1_channel4',
    'sensor.fireboard1_channel5',
    'sensor.fireboard1_channel6'
  ] %}
  {% set active = channels
      | map('states')
      | select('is_number')
      | map('float')
      | select('ne', 0)
      | list %}
  {{ active | count > 0 }}
  ```

- **Device class:** optional — try "running" for friendlier "Running" /
  "Not running" labels instead of raw on/off
- Leave "Select a device" and "Availability template" blank
- Click **Submit**

This creates `binary_sensor.fireboard_session_active`, live, no restart
needed.

Caveat: this is a heuristic, not a real session flag. A probe sitting at
exactly 0° (e.g. in a freezer) would read as inactive, and there's no way
to know which channels are actually part of "the session" versus just
plugged in and idle. Good enough for "is a cook probably happening," not
perfect ground truth.

### 2. Hide the card unless a session is active

On the FireBoard card itself: click the card's ⋮ menu → **Edit Card** →
**Visibility** tab → **Add condition** → **Entity state** → select
`FireBoard Session Active` → set it to **Running** (or **on**, depending
on whether you set a device class).

Equivalent YAML, if you'd rather edit the dashboard config directly:

```yaml
visibility:
  - condition: state
    entity: binary_sensor.fireboard_session_active
    state: "on"
```

The card will disappear from the dashboard when idle and reappear
automatically once a channel starts reading real temperatures again.

## License

MIT
