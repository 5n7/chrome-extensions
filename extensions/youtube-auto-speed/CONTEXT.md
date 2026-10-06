# YouTube Auto Speed

Plays every Target Video on youtube.com at the Speed its rules choose, and lets the viewer step that Speed down or up with Speed Shortcuts.

## Language

### Speed

**Speed**:
One of six playback speeds, 0.5x, 1.0x, 1.5x, 2.0x, 2.5x, and 3.0x, always written with one decimal place; no other speed is ever applied.
_Avoid_: rate, playback rate, step

**Target Video**:
A regular video playing on a youtube.com watch page, including a finished live stream or premiere, the ads played within it, and its continuation in the miniplayer. Shorts, live streams while live, hover previews, and channel trailers are never Target Videos.
_Avoid_: main video, player video

**Rule Speed**:
The Speed the rules choose for a Target Video: the first matching Title Rule's, otherwise its Channel Rule's, otherwise the Default Speed.
_Avoid_: auto speed, resolved speed

**Manual Speed**:
A Speed the viewer picks with a Speed Shortcut; it replaces the Rule Speed until another Target Video starts, the current one's Rule Speed changes, or a Speed is picked for its channel in the popup.
_Avoid_: override, temporary speed

**Speed Lock**:
The extension's hold on a Target Video's Speed: a change made by anything else, such as YouTube's own speed menu, an ad, a quality switch, or another extension, is reverted.
_Avoid_: enforcement, guard

**Speed Indicator**:
The label in the top-right corner of the player showing the current Speed; it shows clearly whenever the Speed is set or changed, or a Speed Shortcut hits a limit, then dims, or hides at 1.0x. A revert by the Speed Lock never shows it.
_Avoid_: overlay, OSD, badge

### Rules

**Title Rule**:
A pattern (a regular expression) and a Speed; it matches a Target Video whose title contains the pattern, ignoring case. An empty or invalid pattern matches nothing, and among the ordered Title Rules the first match wins.
_Avoid_: regex rule, title regex rule

**Channel Rule**:
A channel's handle (such as `@example`, compared ignoring case) and a Speed; it matches every Target Video from that channel. A channel is never identified by its display name.
_Avoid_: channel name rule

**Default Speed**:
The Speed for a Target Video that no rule matches; 1.0x after install.
_Avoid_: global speed, base speed

### Shortcuts

**Speed Shortcut**:
Speed Down or Speed Up, each bound to one Key Combination (`S` and `D` after install), moving the Target Video one Speed lower or higher and stopping at 0.5x and 3.0x. YouTube's own speed keys, `<` and `>`, act as Speed Down and Speed Up too, unless a Key Combination takes them.
_Avoid_: hotkey, keybinding

**Key Combination**:
One non-modifier key plus the exact set of modifiers (Shift, Alt, Ctrl, Meta) held with it; `Shift+S` and `S` are different Key Combinations.
_Avoid_: keybind, shortcut
