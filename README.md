<p align="center">
  <img src=".github/readme/banner.svg" alt="chrome-extensions: personal Chrome extensions, one TV at a time." width="880">
</p>

Personal Chrome extensions, built with [WXT](https://wxt.dev), React, Tailwind CSS, and shadcn/ui on Bun workspaces.

## Extensions

<!-- extensions:start -->

<a href="extensions/twitch-seek-keys"><img src=".github/readme/twitch-seek-keys.svg" alt="Twitch Seek Keys: Custom keyboard seek amounts for Twitch VODs and clips." width="880"></a>

<a href="extensions/twitch-spoiler-guard"><img src=".github/readme/twitch-spoiler-guard.svg" alt="Twitch Spoiler Guard: Hides the seek bar and total time on Twitch VODs, so their length never spoils the ending." width="880"></a>

<!-- extensions:end -->

## Development

```sh
bun install
bun dev <name>  # Open Chrome with one extension, reloading on change
bun run zip     # Package every extension into extensions/<name>/.output
bun run readme  # Redraw the cards above after adding or changing an extension
```
