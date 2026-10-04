# Twitch Spoiler Guard

Hides how much of a Guarded Video remains on twitch.tv, so the viewer cannot guess an outcome (such as the end of an e-sports match) from the remaining time.

## Language

**Guarded Video**:
A VOD, including highlights and uploads; clips and live streams are never Guarded Videos.
_Avoid_: Seekable Video (Twitch Seek Keys' term, which includes clips), recording, replay

**Spoiler Cue**:
Anything on screen from which the viewer could tell how much of a Guarded Video remains: its total duration wherever it appears (in the player or as a badge on its thumbnail), its seek bar (including the hover preview and markers), the length of each of its chapters, and the watched-progress bar on its thumbnail. The elapsed time alone is not a Spoiler Cue, and neither are titles, thumbnail images, or chat, even when they reveal an outcome.
_Avoid_: progress, timeline, spoiler

**Guard**:
The single on/off switch that, while on, hides every Spoiler Cue of every Guarded Video; there are no per-channel or per-video exceptions. It is on after install and covers twitch.tv only; Twitch players embedded in other sites and the browser's own media controls are outside it.
_Avoid_: protection, spoiler mode, blocker
