# Twitch Danmaku

Shows Twitch chat as Comments scrolling across the player, Niconico-style, on every Watch Page, for live streams and VOD Chat Replay alike.

## Language

**Watch Page**:
A live channel page or a VOD page on www.twitch.tv. Clips, players embedded in other sites, popout players and chat, the moderator view, and autoplaying previews are never Watch Pages.
_Avoid_: target page, player page

**Comment**:
One chat message as it scrolls across the player, right to left, in a Lane of the Danmaku Area; its text is cut to 50 characters, each Emote counting as one character. A Comment stops in place while the video is paused.
_Avoid_: bullet, danmaku (for a single message), message

**Danmaku Area**:
The top part of the player, a set share of its height, in which Comments scroll; it applies in the normal, theater, and fullscreen layouts alike.
_Avoid_: overlay, screen, canvas

**Lane**:
One horizontal row of the Danmaku Area; a Comment keeps its Lane from entry to exit.
_Avoid_: row, line, track, stack

**Crossing Time**:
The seconds a Comment takes to travel the width of the player; every Comment moves at the same speed, so a long one stays on screen longer, and neither the VOD's playback speed nor the Comment's length changes that speed.
_Avoid_: duration, scroll speed

**Lane Count**:
How many Lanes the Danmaku Area holds; it sets the size of the text, so Comments keep their proportions in every layout.
_Avoid_: font size, density

**Drop**:
Discarding a chat message instead of showing it: when it finds no free Lane, when it arrives while the video is paused, or when its Replay Time lies ahead of the playback position or more than one Crossing Time behind it; it is never shown later.
_Avoid_: skip, throttle, queue

**Command**:
A chat message starting with `!`, meant for a bot; it never becomes a Comment.

**Chat Replay**:
The chat recorded with a VOD, played back in step with the VOD's playback position.
_Avoid_: VOD chat, rechat

**Replay Time**:
The playback position, in whole seconds, at which a Chat Replay message was posted.
_Avoid_: timestamp, offset

**Restore**:
Placing a Chat Replay message whose Replay Time lags more than a couple of seconds, but less than one Crossing Time, behind the playback position partway across, where it would be had the viewer been watching all along. After a seek and when a VOD starts playing, the screen is cleared and every message Twitch lists for the new position is shown this way. A live stream is never Restored; only messages arriving after the page opens become Comments.
_Avoid_: catch-up, backfill, resync

**Emote**:
An image standing for a word in a chat message, from Twitch or from 7TV, BetterTTV, or FrankerFaceZ, whether the channel's own or global; a Comment shows it as the image.
