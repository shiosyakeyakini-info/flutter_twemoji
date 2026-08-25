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
the release in `lib/src/twemoji_version.dart`, and regenerates `TwemojiUtils.emojiRegex` from
[`@misskey-dev/emoji-data`](https://github.com/misskey-dev/emojis), which builds its pattern from
Twemoji's own `emoji.yml`. Regenerating the regex needs Node.js; pass `--skip-regex` to sync only
the assets.

### Syncing from the Actions tab

`.github/workflows/sync-twemoji.yml` runs the same script on _Actions → Sync Twemoji → Run
workflow_, optionally pinned to a tag, and opens a pull request with the result. `flutter test`
guards against the assets and the regex drifting apart, so the pull request only needs a version
bump and a changelog entry before publishing.

The workflow is deliberately manual: upstream publishes a release a few times a year, and GitHub
disables scheduled workflows in public repositories after 60 days without a commit, which this
repository would regularly exceed.

> The workflow pushes with the built-in `GITHUB_TOKEN`, which requires
> _Settings → Actions → General → Allow GitHub Actions to create and approve pull requests_ to be
> enabled for the repository.

## 絵文字の照合と異体字セレクタ

`Twemoji`・`TwemojiText`・`TwemojiTextSpan` は、どこからどこまでが絵文字かを
`TwemojiUtils.emojiRegex` で判定する。この正規表現は sync が
[`@misskey-dev/emoji-data`](https://github.com/misskey-dev/emojis) から生成している。Twemoji の
`emoji.yml` から起こしたもので、次のように振る舞う。

- 異体字セレクタ U+FE0F は任意。`☹️` でも素の `☹` でもマッチする。
- テキスト表示を明示する U+FE0E は拒む。`☹︎` はマッチしない。
- テキスト表示が既定で、かつ肌の色を取れる絵文字（☝ ✌ ✍ 🖐 🕴 🕵 ⛷ ⛹ 🏋 🏌）も肌の色つきでマッチする。

これはキーボードからではなくサーバーから絵文字を受け取る用途で効いてくる。たとえば Misskey は
リアクションを保存する前に U+FE0F を落とす（`ReactionService.normalize`）ため、クライアントには
素の形が届く。`Twemoji` はマッチしない入力に対して**何も描画しない**ので、取りこぼした絵文字は
システムフォントにフォールバックせず、そのまま消える。

以前は Twemoji 自身が使う [`@twemoji/parser`](https://www.npmjs.com/package/@twemoji/parser) から
生成していたが、パーサ 17.0.2（[jdecked/twemoji-parser#12](https://github.com/jdecked/twemoji-parser/pull/12)、
2026-06-01 マージ）以降、Unicode 特性が `Emoji_Presentation=No` の文字は U+FE0F が続くときしか
マッチしなくなり、さらに上の10字は完全修飾してもマッチしない
（[#16](https://github.com/jdecked/twemoji-parser/issues/16)、未修正）。Unicode 17.0 の絵文字1915字で
測ると描画できないものが141字あり、生成元を切り替えて1字（`👁️‍🗨️`、アセット名の付き方が別問題）まで
減らした。測定と経緯は `CLAUDE.md` にある。

## Credits
- Originally maintained by [hadi-codes](https://github.com/hadi-codes/twemoji)
- Continued as `flutter_twemoji` by [jasonlessenich](https://github.com/jasonlessenich/flutter_twemoji)
- Twemoji graphics by [jdecked/twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0)
- Emoji regex from [`@misskey-dev/emoji-data`](https://github.com/misskey-dev/emojis) (MIT)