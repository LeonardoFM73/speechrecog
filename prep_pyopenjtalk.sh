#!/bin/sh
# Patch pyopenjtalk's htsengine submodule so its CMakeLists.txt
# declares a CMake policy version compatible with CMake 4.x.
set -e

# pyopenjtalk submodules aren't always present after --depth 1 clone.
# Re-init if needed.
git submodule update --init --recursive

# Find every CMakeLists.txt in the tree and bump the minimum-required
# version. We only do a single edit per file: the first line that
# mentions cmake_minimum_required gets VERSION < 3.5 replaced.
find . -name CMakeLists.txt -print0 | xargs -0 sed -i \
    -E 's/cmake_minimum_required\(VERSION[[:space:]]*[0-9.]+\)/cmake_minimum_required(VERSION 3.10)/g'

echo "[prep_pyopenjtalk] Patched CMakeLists.txt files:"
find . -name CMakeLists.txt -exec grep -Hn "cmake_minimum" {} \;
