#!/bin/bash
# Must have wasm-pack installed: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

echo "Building Rust Planner..."
cd src/lib/engine/planner/rust_core
wasm-pack build --target web --out-dir ../pkg

echo "WASM Build Complete. Artifacts in lib/engine/planner/pkg"
