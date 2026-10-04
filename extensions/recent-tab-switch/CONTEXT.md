# Recent Tab Switch

Makes Ctrl+Tab move through a window's tabs in the order they were last used, as Arc and Dia do, instead of their left-to-right order in the tab strip.

## Language

**Recency Order**:
The tabs of one window, ranked from the most recently used to the least; tabs never yet shown rank behind every used one. Each window has its own, and switching never leaves the window.
_Avoid_: MRU list, tab history, stack

**Walk**:
A run of Ctrl+Tab presses, each showing the next older tab in the Recency Order, with Ctrl+Shift+Tab stepping back toward the tab it started from. It stops at the oldest tab rather than wrapping around, and the Recency Order holds still until it settles.
_Avoid_: burst, cycle, session

**Settle**:
The end of a Walk, a second after the last press or as soon as a tab is switched to any other way; the tab the Walk stopped on becomes the most recently used.
_Avoid_: commit, confirm
