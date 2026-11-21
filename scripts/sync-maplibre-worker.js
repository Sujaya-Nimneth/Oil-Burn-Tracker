#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(
  ROOT,
  'node_modules',
  'maplibre-gl',
  'dist',
  'maplibre-gl-worker.mjs'
);
const DEST = path.join(ROOT, 'public', 'maplibre-gl-worker.js');

if (!fs.existsSync(SRC)) {
  console.error(
    `[sync-maplibre-worker] Missing MapLibre v6 worker at ${SRC}. Run npm install first.`
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.copyFileSync(SRC, DEST);
