# flutter_twemoji
Based on [jdecked/twemoji (v17.0.3)](https://github.com/jdecked/twemoji), the actively maintained
successor of the now-dormant [twitter/twemoji](https://github.com/twitter/twemoji).

A fork of [jasonlessenich/flutter_twemoji](https://github.com/jasonlessenich/flutter_twemoji) that
follows upstream Twemoji releases automatically.

<img src="https://raw.githubusercontent.com/shiosyakeyakini-info/flutter_twemoji/main/art/1.png" width=270>

## Usage

### Display a Single Emoji

Use the **Twemoji** Widget to display individual emojis.

```dart
Twemoji(
  emoji: '🍕',
  height: 50,
  width: 50,
)
```

### Render Text with Emojis

The **TwemojiText** Widget allows you to render text with embedded Twemoji.

```dart
TwemojiText(
  text: 'Flutter is awesome 🎉',
)
```

### Rich Text with Emojis

Combine the **TwemojiTextSpan** with **RichText** to create rich text content with emojis.

```dart
RichText(
    text: TwemojiTextSpan(
    text: 'Text 🍕🍔🌭🍿🧂🥓🥨🥐🍞🥞🥞',
    style: Theme.of(context).textTheme.headline6,
  ),
)
```

### Only include specific emojis
By default, the package includes _all_ twemojis.
To reduce the overall bundle size, you can specify which emojis to include in your pubspec.yaml:

```yaml
flutter_twemoji:
  includes: '🍕🍔🌭🍿🧂🥓🥨🥐🍞🥞🥞'
```

Then call `dart run flutter_twemoji:include_emojis` to have it filter down the list of emojis
to generate assets for.

## Keeping up with Twemoji

The bundled assets and the emoji regex are generated from an upstream Twemoji release. The release
they were taken from is available at runtime:

```dart
print('$twemojiSourceRepository @ $twemojiVersion'); // https://github.com/jdecked/twemoji @ 17.0.3
```

### Syncing manually

```bash
tool/sync_twemoji.sh                # sync with the newest upstream release
tool/sync_twemoji.sh --ref v17.0.3  # sync with a specific release
tool/sync_twemoji.sh --print-current
```

The script replaces `assets/png` and `assets/svg` with the upstream `72x72` PNGs and SVGs, records
the release in `lib/src/twemoji_version.dart`, and regenerates `TwemojiUtils.emojiRegex` from the
[`@twemoji/parser`](https://www.npmjs.com/package/@twemoji/parser) package Twemoji itself builds its
distribution from. Regenerating the regex needs Node.js; pass `--skip-regex` to sync only the assets.

### Syncing automatically

`.github/workflows/sync-twemoji.yml` runs the same script every Monday (and on demand via
_Run workflow_) and opens a pull request whenever upstream published a new release. `flutter test`
guards against the assets and the regex drifting apart, so the pull request only needs a version
bump and a changelog entry before publishing.

> The workflow pushes with the built-in `GITHUB_TOKEN`, which requires
> _Settings → Actions → General → Allow GitHub Actions to create and approve pull requests_ to be
> enabled for the repository.

## Credits
- Originally maintained by [hadi-codes](https://github.com/hadi-codes/twemoji)
- Continued as `flutter_twemoji` by [jasonlessenich](https://github.com/jasonlessenich/flutter_twemoji)
- Twemoji graphics by [jdecked/twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0)