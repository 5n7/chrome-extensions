# Read chat from Twitch's own chat list

Comments come from the chat lines Twitch renders on the page, for live streams and Chat Replay alike, not from a separate anonymous IRC connection or Twitch's GQL comments query. Twitch keeps adding lines while the chat panel is collapsed, in theater mode, and in fullscreen. Each Chat Replay line carries its Replay Time as text, which is all that Drop and Restore need. One source covers both kinds of video and reuses Twitch's own emote images. The cost is breakage when Twitch renames its classes, so the selectors live in one place.

## Consequences

A forward seek briefly adds dozens of lines from just after the old position before Twitch rebuilds the list. These lines drowned the reference extension in Comments. They are Dropped here by comparing each line's Replay Time with the playback position, never by arrival order.
