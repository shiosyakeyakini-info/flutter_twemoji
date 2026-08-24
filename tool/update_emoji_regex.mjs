#!/usr/bin/env node
// Regenerates `TwemojiUtils.emojiRegex` in lib/src/utils.dart from the
// `@twemoji/parser` npm package, which is the same source jdecked/twemoji
// itself uses to build its `twemoji.js` distribution.
//
// Usage:
//   node tool/update_emoji_regex.mjs [options]
//
//   --twemoji-version <x.y.z>   Twemoji release the assets were synced from.
//                               The newest parser release that is not newer
//                               than this version is used.
//   --parser-version <x.y.z>    Pin an exact `@twemoji/parser` version.
//   --file <path>               Dart file to patch (default lib/src/utils.dart).

import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const PACKAGE = '@twemoji/parser';
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
      case '--parser-version': opts.parserVersion = next().replace(/^v/, ''); break;
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

/// Picks the newest published parser release that is not newer than the
/// Twemoji release we synced the assets from. The parser is versioned in
/// lockstep with Twemoji, but its patch releases can lag behind.
function resolveParserVersion(twemojiVersion) {
  const versions = JSON.parse(npm(['view', PACKAGE, 'versions', '--json']));
  const stable = versions.filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort(compareVersions);
  if (stable.length === 0) throw new Error(`No stable ${PACKAGE} releases found`);
  if (!twemojiVersion) return stable[stable.length - 1];
  const candidates = stable.filter((v) => compareVersions(v, twemojiVersion) <= 0);
  if (candidates.length === 0) {
    console.warn(`No ${PACKAGE} release <= ${twemojiVersion}; falling back to ${stable[stable.length - 1]}`);
    return stable[stable.length - 1];
  }
  return candidates[candidates.length - 1];
}

function readRegexSource(parserVersion) {
  const installDir = mkdtempSync(path.join(tmpdir(), 'twemoji-parser-'));
  try {
    npm(['install', '--prefix', installDir, '--no-save', '--no-audit', '--no-fund', '--loglevel', 'error',
      `${PACKAGE}@${parserVersion}`]);
    const require = createRequire(path.join(installDir, 'noop.cjs'));
    const regex = require(`${PACKAGE}/dist/lib/regex`).default;
    if (!(regex instanceof RegExp)) throw new Error(`${PACKAGE} did not export a RegExp`);
    return regex.source;
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

function patch(file, pattern, parserVersion) {
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
    `  /// Generated from \`${PACKAGE}\` v${parserVersion}.`,
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
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n')
      .filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    return;
  }
  const parserVersion = opts.parserVersion ?? resolveParserVersion(opts.twemojiVersion);
  console.log(`Using ${PACKAGE}@${parserVersion}`);
  const pattern = readRegexSource(parserVersion);
  assertEmbeddable(pattern);
  const changed = patch(opts.file, pattern, parserVersion);
  console.log(changed
    ? `Updated the emoji regex in ${path.relative(rootDir, opts.file)} (${pattern.length} chars)`
    : `The emoji regex in ${path.relative(rootDir, opts.file)} is already up to date`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `parser_version=${parserVersion}\n`);
  }
}

main();
