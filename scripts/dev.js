import { spawn } from 'node:child_process'

const children = []

const run = (label, command, args) => {
  const child = spawn(command, args, {
    shell: false,
    stdio: 'inherit',
    windowsHide: false,
  })

  child.on('exit', (code, signal) => {
    if (signal || code === 0) {
      return
    }

    console.error(`${label} exited with code ${code}`)
    stopAll()
    process.exit(code)
  })

  children.push(child)
}

const stopAll = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill()
    }
  }
}

process.on('SIGINT', () => {
  stopAll()
  process.exit(0)
})

process.on('SIGTERM', () => {
  stopAll()
  process.exit(0)
})

run('API server', 'node', ['server/index.js'])
run('Vite client', 'node', ['node_modules/vite/bin/vite.js'])
