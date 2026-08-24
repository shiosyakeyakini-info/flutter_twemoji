#!/bin/bash
# Kept for backwards compatibility. The asset sync now lives in
# tool/sync_twemoji.sh, which additionally records the upstream release and
# regenerates the emoji regex.
exec "$(dirname "$(readlink -f "$0")")/tool/sync_twemoji.sh" "$@"
