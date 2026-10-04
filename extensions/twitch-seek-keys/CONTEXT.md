# Twitch Seek Keys

Lets the viewer replace Twitch's fixed 10-second arrow-key seek on twitch.tv with their own Seek Bindings while watching a Seekable Video.

## Language

**Seek Binding**:
A Key Combination mapped to a Seek Offset.
_Avoid_: shortcut, hotkey, mapping, rule

**Key Combination**:
One non-modifier key plus the exact set of modifiers (Shift, Alt, Ctrl, Meta) held with it; `Shift+←` and `←` are different Key Combinations.
_Avoid_: hotkey, keybind, shortcut

**Seek Offset**:
A direction (backward or forward) and a whole number of seconds, from 1 to 3600.
_Avoid_: jump, skip, step

**Native Seek**:
Twitch's own 10-second arrow-key seek, which stays in effect on live streams and for any Key Combination without a Seek Binding.
_Avoid_: default seek

**Default Bindings**:
The preset Seek Bindings present after install and restorable on demand: `←`/`→` 5 s, `J`/`L` 10 s, `Shift+J`/`Shift+L` 30 s, `Shift+←`/`Shift+→` 60 s.
_Avoid_: preset, factory settings

**Seekable Video**:
A VOD (including highlights and uploads) or a clip; a live stream is never a Seekable Video, even while rewound.
_Avoid_: recording, replay

**Seek Indicator**:
The brief label on the player showing the Seek Offset just applied; while it stays visible, further seeks in the same direction add to the total shown, and a seek in the other direction starts a new total.
_Avoid_: OSD, toast, overlay
