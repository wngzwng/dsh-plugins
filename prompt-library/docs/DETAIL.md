# Prompt Library

Keep prompts from chats, notes and the web in one place. Find them again with tags, favorites, pinning, ratings and search, then copy them or insert them safely into the current draft.

## Features

- **Full management page in the sidebar**: search across title, body and tags; tags; favorites; pinning; recently used; half-star personal ratings with a "needs re-rating" state; review notes.
- **Quick picker beside the composer**: browse All / Pinned / Favorites / Recent, copy the body, or insert it at the caret (undoable, never replaces the whole draft).
- **Quick capture**: paste text, the whole composer draft, or text selected in a conversation; inbox state, automatic titles, duplicate warnings and source metadata.
- **Body display**: plain text by default, with an optional read-only Markdown preview; HTML is never executed and remote images are not loaded.
- **Import / export**: CSV for exchange, JSON for full backups.
- **Optional AI review**: only when you ask for it, using the model already configured in DSH; at most 200 characters, shown as a reference, never as your personal rating.

## Install

Install "提示库 / Prompt Library" from the DSH plugin market, or download the tarball from [Releases](https://github.com/wngzwng/dsh-prompt-library/releases) and run:

```bash
dsh plugin --profile web add https://github.com/wngzwng/dsh-prompt-library/releases/download/1.0.0/wngzwng-dsh-prompt-library-1.0.0.tgz
```

## Usage

- Open the full page from the sidebar icon, or the quick picker from the composer toolbar.
- Data stays in this browser. Export a JSON backup before switching devices or clearing browser data.

## Data and privacy

- Prompts, tags, ratings, AI reviews and source metadata stay in this browser's local storage and are never uploaded.
- AI review calls the DSH model service from the Host half; the browser never sees credentials. Each call may incur model cost.
- Sharing and copying include only the title and body, never review notes or AI reviews.

## License

MIT
