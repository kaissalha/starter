#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

# Upstream #1033 fixes overstretched clone ranges after the 5.2.0 release.
revision=deb1db104f38692015acb750c96482570c98608f
install_dir="$PWD/node_modules/.cache/jscpd/$revision"

if [ ! -x "$install_dir/bin/jscpd" ]; then
    export CARGO_HOME="$PWD/node_modules/.cache/jscpd-cargo"
    export RUSTUP_HOME="$PWD/node_modules/.cache/jscpd-rustup"
    export PATH="$CARGO_HOME/bin:$PATH"

    if [ ! -x "$CARGO_HOME/bin/rustup" ]; then
        mkdir -p "$CARGO_HOME"
        curl --fail --silent --show-error https://sh.rustup.rs -o "$CARGO_HOME/rustup-init.sh"
        sh "$CARGO_HOME/rustup-init.sh" -y --no-modify-path --profile minimal --default-toolchain none
    fi

    rustup toolchain install 1.96.0 --profile minimal
    cargo +1.96.0 install --locked --git https://github.com/kucherenko/jscpd \
        --rev "$revision" --bin jscpd --root "$install_dir" jscpd
fi

exec "$install_dir/bin/jscpd" "$@"
