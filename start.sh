#!/bin/sh 

set -eu

zstd -D /chrome/chromium_lib.dict -d /chrome/chromium_lib.tar.zst
tar xvf /chrome/chromium_lib.tar
mv chromium /usr/lib/chromium
ln -s /usr/lib/chromium/chromium-launcher.sh /usr/bin/chromium-browser
node index.js