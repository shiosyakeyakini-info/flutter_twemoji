import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_twemoji/flutter_twemoji.dart';

/// Emoji that only exist in recent Twemoji releases. They guard against the
/// bundled assets and the generated emoji regex drifting apart, which is what
/// happens when only one half of a sync lands.
const _recentEmojis = <String>[
  '\u{1F6D8}', // Landslide (Unicode 16.0)
  '\u{1FA89}', // Harp (Unicode 15.0)
  '\u{1FAE9}', // Face with bags under eyes (Unicode 16.0)
  '\u{1FAEF}', // Apple core (Unicode 17.0)
];

/// Emoji whose default presentation is text, so a server that normalizes the
/// variation selector away (Misskey does, before storing a reaction) hands
/// them to the client unqualified. `@twemoji/parser` stopped matching those in
/// 17.0.2, which is why the regex is generated from `@misskey-dev/emoji-data`
/// instead.
const _unqualifiedEmojis = <String>[
  '\u2639', // Frowning face
  '\u2764', // Red heart
  '\u270C', // Victory hand
  '\u{1F575}', // Detective
];

/// Text-default emoji that can take a skin tone. `@twemoji/parser` matches
/// none of these, not even fully qualified — jdecked/twemoji-parser#16, still
/// open upstream.
const _tonedTextDefaultEmojis = <String>[
  '\u261D\u{1F3FB}', // Index pointing up
  '\u270C\u{1F3FC}', // Victory hand
  '\u270D\u{1F3FD}', // Writing hand
  '\u{1F574}\u{1F3FE}', // Person in suit levitating
  '\u{1F575}\u{1F3FF}', // Detective
  '\u{1F590}\u{1F3FB}', // Hand with fingers splayed
  '\u26F7\u{1F3FC}', // Skier
  '\u26F9\u{1F3FD}', // Person bouncing ball
  '\u{1F3CB}\u{1F3FE}', // Person lifting weights
  '\u{1F3CC}\u{1F3FF}', // Person golfing
];

/// Both spellings of the eye in speech bubble. Twemoji names the asset after
/// the unqualified sequence, while `toUnicode` keeps U+FE0F inside a ZWJ
/// sequence and asks for the qualified one, so the sync stores the asset under
/// both names until upstream settles on one (jdecked/twemoji#151).
const _eyeInSpeechBubble = <String>[
  '\u{1F441}\u200D\u{1F5E8}',
  '\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F',
];

/// Whether [emoji] is matched as a whole, rather than partly or not at all.
/// A partial match is as broken as none: [Twemoji] renders the match and drops
/// whatever it did not consume.
bool _matchesWhole(String emoji) {
  final match = TwemojiUtils.emojiRegex.firstMatch(emoji);
  return match != null && match.group(0) == emoji;
}

Set<String> _assetNames(String directory, String extension) =>
    Directory(directory)
        .listSync()
        .whereType<File>()
        .map((file) => file.uri.pathSegments.last)
        .where((name) => name.endsWith(extension))
        .map((name) => name.substring(0, name.length - extension.length))
        .toSet();

void main() {
  group('bundled assets', () {
    test('ship the same set of PNGs and SVGs', () {
      final pngs = _assetNames('assets/png', '.png');
      final svgs = _assetNames('assets/svg', '.svg');

      expect(pngs, isNotEmpty);
      expect(pngs.difference(svgs), isEmpty, reason: 'PNGs without an SVG');
      expect(svgs.difference(pngs), isEmpty, reason: 'SVGs without a PNG');
    });

    test('are declared to come from a Twemoji release', () {
      expect(twemojiVersion, matches(RegExp(r'^\d+\.\d+\.\d+$')));
      expect(twemojiSourceRepository, startsWith('https://github.com/'));
    });
  });

  group('emojiRegex', () {
    test('matches emoji of the bundled Twemoji release', () {
      for (final emoji in _recentEmojis) {
        expect(TwemojiUtils.emojiRegex.hasMatch(emoji), isTrue,
            reason: 'regex does not match ${TwemojiUtils.toUnicode(emoji)}');
      }
    });

    test('does not match plain text', () {
      expect(TwemojiUtils.emojiRegex.hasMatch('Flutter is awesome'), isFalse);
    });

    test('matches text-default emoji without the variation selector', () {
      for (final emoji in _unqualifiedEmojis) {
        expect(_matchesWhole(emoji), isTrue,
            reason: 'regex does not match bare '
                '${TwemojiUtils.toUnicode(emoji)}');
        expect(_matchesWhole('$emoji\uFE0F'), isTrue,
            reason: 'regex does not match qualified '
                '${TwemojiUtils.toUnicode(emoji)}');
      }
    });

    test('matches text-default emoji with a skin tone', () {
      for (final emoji in _tonedTextDefaultEmojis) {
        expect(_matchesWhole(emoji), isTrue,
            reason: 'regex does not match ${TwemojiUtils.toUnicode(emoji)}');
      }
    });

    test('matches both spellings of the eye in speech bubble', () {
      for (final emoji in _eyeInSpeechBubble) {
        expect(_matchesWhole(emoji), isTrue,
            reason: 'regex does not match ${TwemojiUtils.toUnicode(emoji)}');
      }
    });

    test('does not match emoji asked to render as text', () {
      for (final emoji in _unqualifiedEmojis) {
        expect(TwemojiUtils.emojiRegex.hasMatch('$emoji\uFE0E'), isFalse,
            reason: 'regex matches ${TwemojiUtils.toUnicode(emoji)} + U+FE0E');
      }
    });
  });

  group('toUnicode', () {
    test('resolves to bundled asset file names', () {
      const others = ['🍕', '👍🏽', '👨‍👩‍👧‍👦', '🇩🇪'];

      for (final emoji in [
        ..._recentEmojis,
        ..._unqualifiedEmojis,
        ..._tonedTextDefaultEmojis,
        ..._eyeInSpeechBubble,
        ...others,
      ]) {
        final unicode = TwemojiUtils.toUnicode(emoji);

        expect(File('assets/png/$unicode.png').existsSync(), isTrue,
            reason: 'missing assets/png/$unicode.png');
        expect(File('assets/svg/$unicode.svg').existsSync(), isTrue,
            reason: 'missing assets/svg/$unicode.svg');
      }
    });
  });
}
