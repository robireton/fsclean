import { readdir, rmdir, rm } from 'fs/promises'
import { join, resolve } from 'path'
import { argv } from 'process'

async function directory (path) {
  const hidden = []
  const links = []
  const files = []
  const directories = []
  const found = []
  try {
    // process the contents of this directory
    for (const file of await readdir(path, { withFileTypes: true })) {
      if (file.name.startsWith('.')) {
        if (file.name === '.DS_Store') {
          await rm(join(path, file.name))
        } else {
          hidden.push(join(path, file.name))
        }
      } else if (file.isSymbolicLink()) {
        links.push(join(path, file.name))
      } else if (file.isFile()) {
        files.push(join(path, file.name))
      } else if (file.isDirectory()) {
        directories.push(join(path, file.name))
      }
    }

    // process the contents of subdirectories
    for (const d of directories) {
      found.push(...(await directory(d)))
    }

    if (links.length === 0 && hidden.length === 0) {
      if (directories.length === 0 && files.length === 0) {
        // empty directory
        found.push(path)
      } else if (directories.length === 0 && files.length === 1) {
        // orphan file
        console.log(`orphan: ${files[0]}`)
      }
    }
  } catch (err) {
    console.error(err)
  }
  return found
}

async function find () {
  const [, , ...args] = argv
  let del = false
  const dirs = new Set()
  for (const arg of args) {
    if (arg === '-d') {
      del = true
      continue
    }
    dirs.add(resolve(arg))
  }
  console.log(`delete: ${del}`)
  for (const d of dirs) {
    console.log(`\nStarting at ${d}`)
    for (const p of await directory(d)) {
      console.log(`${del ? 'deleting' : 'found'} ${p}`)
      if (del) rmdir(p)
    }
  }
}

find()
