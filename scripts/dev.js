#!/usr/bin/env node
// Wrapper to ensure ELECTRON_RUN_AS_NODE is not set, which would
// prevent Electron from starting as a GUI app (relevant when running
// inside environments like VS Code that set ELECTRON_RUN_AS_NODE=1).
const { spawn } = require('child_process')
const path = require('path')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(
  'npx',
  ['electron-vite', 'dev'],
  {
    stdio: 'inherit',
    env,
    shell: true
  }
)

child.on('exit', (code) => process.exit(code || 0))
