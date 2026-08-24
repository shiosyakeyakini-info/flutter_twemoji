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
  });

  group('toUnicode', () {
    test('resolves to bundled asset file names', () {
      const others = ['🍕', '👍🏽', '👨‍👩‍👧‍👦', '🇩🇪'];

      for (final emoji in [..._recentEmojis, ...others]) {
        final unicode = TwemojiUtils.toUnicode(emoji);

        expect(File('assets/png/$unicode.png').existsSync(), isTrue,
            reason: 'missing assets/png/$unicode.png');
        expect(File('assets/svg/$unicode.svg').existsSync(), isTrue,
            reason: 'missing assets/svg/$unicode.svg');
      }
    });
  });
}
