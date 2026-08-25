#!/usr/bin/env node
// Regenerates `TwemojiUtils.emojiRegex` in lib/src/utils.dart from the
// `@misskey-dev/emoji-data` npm package, which generates its pattern from
// Twemoji's own `emoji.yml` — the same source `@twemoji/parser` is built from,
// but with U+FE0F kept optional (while U+FE0E is still rejected) and without
// the missing skin-tone alternatives of jdecked/twemoji-parser#16.
//
// Usage:
//   node tool/update_emoji_regex.mjs [options]
//
//   --twemoji-version <x.y.z>   Twemoji release the assets were synced from.
//                               The newest emoji-data release of the same
//                               major.minor series is used.
//   --data-version <x.y.z>      Pin an exact `@misskey-dev/emoji-data` version.
//   --file <path>               Dart file to patch (default lib/src/utils.dart).

import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PACKAGE = '@misskey-dev/emoji-data';
const ENTRY_POINT = `${PACKAGE}/regex`;
const BEGIN = '  // twemoji-regex:begin';
const END = '  // twemoji-regex:end';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = {file: path.join(rootDir, 'lib/src/utils.dart')};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case '--twemoji-version': opts.twemojiVersion = next().replace(/^v/, ''); break;
      case '--data-version': opts.dataVersion = next().replace(/^v/, ''); break;
      case '--file': opts.file = path.resolve(rootDir, next()); break;
      case '-h':
      case '--help': opts.help = true; break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

/// Compares dotted numeric versions; returns <0, 0 or >0.
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function npm(args, options = {}) {
  return execFileSync('npm', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options});
}

/// Picks the newest emoji-data release covering the same emoji set as the
/// Twemoji release the assets came from.
///
/// Only major.minor is matched: those track the Unicode/Twemoji generation
/// (17.0 for Twemoji 17.0.x), while the patch number is the package's own
/// revision and moves independently of Twemoji's. Picking the newest release
/// that is not newer than the Twemoji version — which is what we did while the
/// regex came from `@twemoji/parser`, whose releases are in lockstep with
/// Twemoji's — would pin a stale pattern here: emoji-data 17.0.3 still shipped
/// a copy of the old parser regex, and only 17.0.5 switched to the generated
/// one this fork is after.
function resolveDataVersion(twemojiVersion) {
  const versions = JSON.parse(npm(['view', PACKAGE, 'versions', '--json']));
  const stable = versions.filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort(compareVersions);
  if (stable.length === 0) throw new Error(`No stable ${PACKAGE} releases found`);
  const newest = stable[stable.length - 1];
  if (!twemojiVersion) return newest;
  const series = twemojiVersion.split('.').slice(0, 2);
  const candidates = stable.filter((v) => {
    const parts = v.split('.');
    return parts[0] === series[0] && parts[1] === series[1];
  });
  if (candidates.length === 0) {
    console.warn(`No ${PACKAGE} release in the ${series.join('.')}.x series; falling back to ${newest}`);
    return newest;
  }
  return candidates[candidates.length - 1];
}

function readRegexSource(dataVersion) {
  const installDir = mkdtempSync(path.join(tmpdir(), 'misskey-emoji-data-'));
  try {
    npm(['install', '--prefix', installDir, '--no-save', '--no-audit', '--no-fund', '--loglevel', 'error',
      `${PACKAGE}@${dataVersion}`]);
    const require = createRequire(path.join(installDir, 'noop.cjs'));
    const {emojiRegex} = require(ENTRY_POINT);
    if (!(emojiRegex instanceof RegExp)) throw new Error(`${ENTRY_POINT} did not export an emojiRegex RegExp`);
    return emojiRegex.source;
  } finally {
    rmSync(installDir, {recursive: true, force: true});
  }
}

/// The pattern is embedded in a single quoted Dart string, where Dart itself
/// resolves the `\uXXXX` escapes before the pattern reaches `RegExp`. Anything
/// that would need extra escaping means the upstream pattern changed shape and
/// the generator has to be revisited instead of silently emitting broken Dart.
function assertEmbeddable(pattern) {
  if (pattern.length === 0) throw new Error('Upstream regex is empty');
  if (/[\r\n]/.test(pattern)) throw new Error('Upstream regex contains a line break');
  if (pattern.includes("'")) throw new Error("Upstream regex contains a single quote");
  if (pattern.includes('$')) throw new Error('Upstream regex contains a dollar sign');
  if (pattern.includes('"')) throw new Error('Upstream regex contains a double quote');
  const escapes = new Set((pattern.match(/\\[\s\S]/g) ?? []).map((e) => e[1]));
  for (const escape of escapes) {
    if (escape !== 'u') throw new Error(`Upstream regex contains an unsupported \\${escape} escape`);
  }
  // Sanity check: the pattern has to stay a valid regex once the Dart string
  // escapes are resolved, which is what the Dart VM will compile.
  new RegExp(JSON.parse(`"${pattern}"`));
}

/// The properties this fork switched sources for. A release that loses one of
/// them is a regression upstream, not something to commit and find out about
/// through invisible gaps in rendered text.
const MATCHES = [
  ['☹', 'an unqualified text-default emoji'],
  ['☹️', 'a fully qualified text-default emoji'],
  ['☝🏻', 'a text-default emoji with a skin tone (twemoji-parser#16)'],
  ['🏋️‍♀️', 'a fully qualified ZWJ sequence'],
  ['😀', 'a plain emoji-default emoji'],
  ['🇩🇪', 'a flag'],
  ['👨‍👩‍👧‍👦', 'a family ZWJ sequence'],
  ['1️⃣', 'a keycap'],
];
const NON_MATCHES = [
  ['☹︎', 'an emoji explicitly asked to render as text'],
  ['Flutter is awesome', 'plain text'],
];

function assertSane(pattern) {
  const regex = new RegExp(JSON.parse(`"${pattern}"`), 'g');
  for (const [input, what] of MATCHES) {
    regex.lastIndex = 0;
    const match = regex.exec(input);
    if (match?.[0] !== input) {
      throw new Error(`Upstream regex no longer matches ${what} (${JSON.stringify(input)})`);
    }
  }
  for (const [input, what] of NON_MATCHES) {
    regex.lastIndex = 0;
    if (regex.test(input)) {
      throw new Error(`Upstream regex now matches ${what} (${JSON.stringify(input)})`);
    }
  }
}

function patch(file, pattern, dataVersion) {
  const source = readFileSync(file, 'utf8');
  const begin = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(`Could not find the twemoji-regex markers in ${file}`);
  }
  const block = [
    `${BEGIN} (generated by tool/update_emoji_regex.mjs, do not edit)`,
    '  /// Matches every emoji sequence Twemoji ships an asset for.',
    '  ///',
    '  /// U+FE0F is optional throughout, so emoji arriving unqualified — as they',
    '  /// do from servers that normalize it away — still match; U+FE0E, the',
    '  /// explicit request for a text rendering, does not.',
    '  ///',
    `  /// Generated from \`${PACKAGE}\` v${dataVersion}, which builds the`,
    "  /// pattern from Twemoji's `emoji.yml`.",
    '  static final emojiRegex = RegExp(',
    '      // ignore: lines_longer_than_80_chars',
    `      '${pattern}');`,
    END,
  ].join('\n');
  const patched = source.slice(0, begin) + block + source.slice(end + END.length);
  if (patched === source) return false;
  writeFileSync(file, patched);
  return true;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    const lines = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
    const banner = lines.slice(0, lines.findIndex((l) => !l.startsWith('//')));
    console.log(banner.map((l) => l.slice(3)).join('\n'));
    return;
  }
  const dataVersion = opts.dataVersion ?? resolveDataVersion(opts.twemojiVersion);
  console.log(`Using ${PACKAGE}@${dataVersion}`);
  const pattern = readRegexSource(dataVersion);
  assertEmbeddable(pattern);
  assertSane(pattern);
  const changed = patch(opts.file, pattern, dataVersion);
  console.log(changed
    ? `Updated the emoji regex in ${path.relative(rootDir, opts.file)} (${pattern.length} chars)`
    : `The emoji regex in ${path.relative(rootDir, opts.file)} is already up to date`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `regex_package=${PACKAGE}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `regex_version=${dataVersion}\n`);
  }
}

main();
