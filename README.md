# flutter_twemoji
Based on [jdecked/twemoji (v17.0.3)](https://github.com/jdecked/twemoji), the actively maintained
successor of the now-dormant [twitter/twemoji](https://github.com/twitter/twemoji).

A fork of [jasonlessenich/flutter_twemoji](https://github.com/jasonlessenich/flutter_twemoji) that
follows upstream Twemoji releases automatically.

**This fork is maintained for Misskey clients.** Nothing here is Misskey-specific in its API — it
renders any emoji — but where a choice had to be made, it was made for how a Misskey server hands
emoji out. The emoji regex comes from [`@misskey-dev/emoji-data`](https://github.com/misskey-dev/emojis)
rather than `@twemoji/parser`, so emoji stripped of the U+FE0F variation selector (Misskey drops it
in `ReactionService.normalize` before storing a reaction) still match instead of rendering as an
invisible gap. See [絵文字の照合と異体字セレクタ](#絵文字の照合と異体字セレクタ) for what that
covers and what it costs.

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

このフォークが Misskey 向けだというのは、要するにこの節のことである。

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
測ると描画できないものが141字あった。生成元の切り替えで1字（`👁️‍🗨️`）まで減り、それは正規表現ではなく
アセット名の問題だったので、sync で別名を置いて解消した（下記）。**いまは1915字すべて描画できる。**
測定手順は `CLAUDE.md` にある。

`👁️‍🗨️` だけ事情が違うのは、Twemoji のアセット名が `1f441-200d-1f5e8` なのに対し、`toUnicode` は ZWJ が
あるとき U+FE0F を残すので `1f441-fe0f-200d-1f5e8-fe0f` を探しにいくためである。U+FE0F を残す名前
（`1f3cb-fe0f-200d-2640-fe0f` など）のほうが多数派なので、`toUnicode` 側を一律に変えると他が壊れる。
そこで `tool/sync_twemoji.sh` は、この1字だけアセットを両方の名前で置く。上流がどちらの名前に倒しても
成り立つよう向きは判定しており、[jdecked/twemoji#151](https://github.com/jdecked/twemoji/issues/151) が
決着するまでの措置である点も含めて、`@misskey-dev/emoji-assets` と同じやり方にしてある。

### 上流の経緯

この節の内容は、上流のやりとりをそのままなぞっている。

| 番号 | 種別・状態 | 日付 | 内容 |
|---|---|---|---|
| [twemoji#151](https://github.com/jdecked/twemoji/issues/151) | issue（nicksellen）・open | 2025-12-23 起票 | `"eye in speech bubble" emoji not being mapped correctly to filename`。アセット名 `1f441-200d-1f5e8` と、コードポイントから導かれる `1f441-fe0f-200d-1f5e8-fe0f` が食い違う。未解決 |
| [twemoji-parser#10](https://github.com/jdecked/twemoji-parser/pull/10) | PR（jdecked）・マージ済 | 2026-03-31 | `fix: Eye in speech bubble must now be fully-qualified`。`👁️‍🗨️` が完全修飾必須になった経緯（#9、[twemoji#151](https://github.com/jdecked/twemoji/issues/151)） |
| [twemoji-parser#11](https://github.com/jdecked/twemoji-parser/pull/11) | PR（jasmussen）・未マージで close | 2026-05-22 | 斜め矢印 U+2196–2199 の完全修飾化。より広く直す #12 に置き換えられた |
| [twemoji-parser#12](https://github.com/jdecked/twemoji-parser/pull/12) | PR（jdecked）・マージ済 | 2026-06-01 | `fix: All Emoji_Presentation=No characters are now text-default type, not variant`。FE0F 必須化の張本人。同日 17.0.2 として公開 |
| [twemoji-parser#13](https://github.com/jdecked/twemoji-parser/issues/13) | issue（kakkokari-gtyih）・not planned で close | 2026-06-18 起票 | `Provide old (prior to 17.0.2) emoji matching behavior as option`。Misskey は VS16 の有無に関わらず Twemoji が対応する文字を全部描画する設計で、既定を戻せとは言っていない。却下 |
| [twemoji-parser#15](https://github.com/jdecked/twemoji-parser/issues/15) | issue（mxz7）・close | 2026-06-28 | `failed to parse '🏛'`。#12 の余波の同種報告 |
| [misskey-dev/emojis#9](https://github.com/misskey-dev/emojis/pull/9) | PR（kakkokari-gtyih）・マージ済 | 2026-06-28 | `fix: 絵文字正規表現を自前で生成するように`。#13 の起票から10日、上流待ちをやめて自前生成へ移った。いまこのフォークが使っている正規表現の正体 |
| [twemoji-parser#14](https://github.com/jdecked/twemoji-parser/pull/14) | PR（kakkokari-gtyih）・作者取り下げ | 2026-06-28 起票 → 07-19 close | 正規表現ジェネレータの TypeScript 化。却下ではなく「#2 を読み違えた、実際の目標は JS+Flow だった」と作者自身が引き上げた |
| [twemoji-parser#16](https://github.com/jdecked/twemoji-parser/issues/16) | issue（jdecked）・open、PR なし | 2026-07-07 起票 | `Text default diversity emoji do not parse correctly`。対象は 1f590 270d 1f575 1f574 26f7 1f3cb 26f9 1f3cc 270c 261d の10字で、上の一覧と完全に一致する。原因は `emoji.yml` の `text-default,diversity` タグの扱い |

ここから言えること:

1. **FE0F 必須は仕様変更であって不具合ではない。** 上流は Unicode 的に正しい側に倒し、互換オプションの要望（#13）は not planned で閉じられた。待っていても戻ってこない。
2. **10字の取りこぼしは本物の不具合で、上流も認識している（#16）。** ただしメンテナ自身の起票で、PR はなく、動きがない。近いうちに直る前提では組めない。
3. **Misskey はすでに自前生成へ移った（emojis#9）。** Misskey クライアント向けのこのフォークが同じ正規表現に揃えるのは、測定結果（141字 → 1字）だけでなく足並みの点でも素直な選択になる。

なお `@twemoji/parser` の最新リリースは 17.0.2（2026-06-01）で、Twemoji 本体 17.0.3 に対応するパーサのリリースはない。アセットとパーサがバージョンで揃うという前提自体、すでに崩れている。

代わりに背負ったものもある。`@misskey-dev/emoji-data` の README には「ほかのプロダクトで使用される
ことは想定していません」と明記されており、上流のサポートは期待できない。バージョンも Twemoji の
リリースとは独立に動く。そのため sync は、生成した正規表現が上の3点を満たしているか確かめてからで
ないと書き込まない（`tool/update_emoji_regex.mjs`）。同じ3点は `flutter test` でも押さえてある。
なお正規表現部分のライセンスは `@twemoji/parser` 由来の MIT で、そこは切り替え前後で変わらない。

## Credits
- Originally maintained by [hadi-codes](https://github.com/hadi-codes/twemoji)
- Continued as `flutter_twemoji` by [jasonlessenich](https://github.com/jasonlessenich/flutter_twemoji)
- Twemoji graphics by [jdecked/twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0)
- Emoji regex from [`@misskey-dev/emoji-data`](https://github.com/misskey-dev/emojis) (MIT)