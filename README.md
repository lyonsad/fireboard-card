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
| `name` | no | Display label (defaults to the sensor's entity ID) |
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

## License

MIT
