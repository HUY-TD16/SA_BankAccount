#!/usr/bin/env bash
# Build the Kaggle dataset that lets the load-test notebook run with Internet off.
#   test/performance/build-offline-bundle.sh <full-sha> <out-dir>
# Needs Node 24, npm, git, curl, shasum, tar. Upload <out-dir> as a Kaggle dataset, attach it to the notebook,
# then run in one cell: !python /kaggle/input/<dataset>/kaggle_batch.py <full-sha> smoke
set -euo pipefail
# Kaggle unpacks .tar.gz/.tgz uploads (and fails on node_modules) but keeps .tar.xz, so every archive ships as .tar.xz.
export COPYFILE_DISABLE=1  # no macOS ._ files in tars
sha=${1:?full commit SHA}; out=${2:?output directory}
[ ${#sha} = 40 ] || { echo "SHA must be 40 characters" >&2; exit 1; }
repo=$(git rev-parse --show-toplevel)
node_tar=node-v24.22.0-linux-x64.tar.xz
k6_tar=k6-v1.3.0-linux-amd64.tar.gz
pg_pkg=@embedded-postgres/linux-x64@15.19.0-beta.19
psutil=psutil==7.2.2
mkdir -p "$out"; out=$(cd "$out" && pwd)
work=$(mktemp -d); trap 'git -C "$repo" worktree remove --force "$work/src" 2>/dev/null; rm -rf "$work"' EXIT
cd "$out"

echo "== Node, k6 (checksum from the official release)"
[ -f $node_tar ] || curl -fsSLO https://nodejs.org/dist/v24.22.0/$node_tar
curl -fsSL https://nodejs.org/dist/v24.22.0/SHASUMS256.txt | grep " $node_tar\$" | shasum -a 256 -c
if [ ! -f k6-v1.3.0-linux-amd64.tar.xz ]; then
  curl -fsSLO https://github.com/grafana/k6/releases/download/v1.3.0/$k6_tar
  curl -fsSL https://github.com/grafana/k6/releases/download/v1.3.0/k6-v1.3.0-checksums.txt | grep " $k6_tar\$" | shasum -a 256 -c
  gzip -dc $k6_tar | xz -T0 > k6-v1.3.0-linux-amd64.tar.xz && rm $k6_tar
fi

echo "== PostgreSQL 15 prebuilt binaries (no apt offline), psutil wheel"
if ! ls embedded-postgres-linux-x64-*.tar.xz >/dev/null 2>&1; then
  pg_tgz=$(npm pack "$pg_pkg" --silent)
  gzip -dc "$pg_tgz" | xz -T0 > "${pg_tgz%.tgz}.tar.xz" && rm "$pg_tgz"
fi
ls psutil-*.whl >/dev/null 2>&1 || python3 -m pip download -q $psutil --only-binary=:all: --no-deps \
  --platform manylinux2014_x86_64 --platform manylinux_2_17_x86_64 --python-version 3.11 -d .

echo "== Source $sha"
git -C "$repo" worktree add --detach "$work/src" "$sha" >/dev/null
git -C "$work/src" bundle create "$out/repo.bundle" HEAD 2>/dev/null
cp "$work/src/test/performance/kaggle_batch.py" "$out/"

echo "== Build on this machine: dist and Prisma client are plain JS and wasm, the same on Linux"
(cd "$work/src" && npm ci --no-audit --no-fund >/dev/null && npx prisma generate >/dev/null && npm run build >/dev/null)

echo "== Runtime node_modules for linux-x64 glibc"
mkdir "$work/app"
cp "$work/src/package.json" "$work/src/package-lock.json" "$work/app/"
(cd "$work/app" && npm ci --omit=dev --os=linux --cpu=x64 --libc=glibc --ignore-scripts --no-audit --no-fund >/dev/null)
cp -R "$work/src/node_modules/.prisma" "$work/app/node_modules/"
cp -R "$work/src/dist" "$work/app/"
tar -cJf "$out/app-${sha:0:7}.tar.xz" -C "$work/app" dist node_modules

cat > "$out/manifest.json" <<EOF
{"commit": "$sha", "node": "$node_tar", "k6": "$k6_tar", "postgres": "$pg_pkg", "psutil": "$psutil",
 "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
ls -la "$out"
