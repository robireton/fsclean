import { readdir, rmdir } from 'fs/promises'
import { join, resolve } from 'path'
import { argv } from 'process'

async function directory (path, verbose = false) {
  if (verbose) console.log(path)
  const hidden = []
  const links = []
  const files = []
  const directories = []
  const found = []
  try {
    for (const file of await readdir(path, { withFileTypes: true })) {
      if (file.name.startsWith('.')) {
        hidden.push(join(path, file.name))
      } else if (file.isSymbolicLink()) {
        links.push(join(path, file.name))
      } else if (file.isFile()) {
        files.push(join(path, file.name))
      } else if (file.isDirectory()) {
        directories.push(join(path, file.name))
      }
    }
    for (const d of directories) {
      found.push(...(await directory(d, verbose)))
    }
    if (links.length + files.length + directories.length === 0) {
      if (hidden.length === 0) {
        found.push(path)
      } else {
        console.log(`hidden(s) in ${path}: ${hidden.join(', ')}`)
      }
    }
    // if (hidden.length === 0 && links.length === 0 && directories.length === 0 && files.length === 1) {
    //   found.push(path)
    // }
  } catch (err) {
    console.error(err)
  }
  return found
}

async function find () {
  const [, , ...args] = argv
  let del = false
  let verbose = false
  const dirs = new Set()
  for (const arg of args) {
    if (arg === '-d') {
      del = true
      continue
    }
    if (arg === '-v') {
      verbose = true
      continue
    }
    dirs.add(resolve(arg))
  }
  console.log(`verbose: ${verbose}`)
  console.log(`delete: ${del}`)
  for (const d of dirs) {
    console.log(`\nStarting at ${d}`)
    for (const p of await directory(d, verbose)) {
      console.log(`${del ? 'deleting' : 'found'} ${p}`)
      if (del) rmdir(p)
    }
  }
}

find()
