#!/bin/sh
set -eu
command -v emcc >/dev/null || { echo 'Activate Emscripten 4.0.20 first.' >&2; exit 1; }
emcc --version | head -1 | grep -F '4.0.20' >/dev/null || { echo 'This core is pinned to Emscripten 4.0.20.' >&2; exit 1; }
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_dir=$(mktemp -d "${TMPDIR:-/tmp}/pixel-link-fceumm.XXXXXXXX")
trap 'rm -rf "$source_dir"' EXIT HUP INT TERM
tar -xzf "$project_dir/native/fceumm/upstream-source.tar.gz" -C "$source_dir"
make -C "$project_dir/native/fceumm" CORE_SOURCE="$source_dir" -j4
