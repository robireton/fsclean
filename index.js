import { readdir, rmdir, rm } from 'fs/promises'
import { extname, join, resolve } from 'path'
import { argv } from 'process'
import { imageSize } from 'image-size'

async function directory (path, options) {
  const hidden = []
  const links = []
  const files = []
  const directories = []
  const found = {
    empties: []
  }
  if (options.orphans) found.orphans = []
  if (options.sizes) found.sizes = []
  try {
    // process the contents of this directory
    for (const file of await readdir(path, { withFileTypes: true })) {
      if (file.name.startsWith('.')) {
        if (file.name === '.DS_Store' && options.delete) {
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
      for (const [name, list] of Object.entries(await directory(d, options))) {
        found[name].push(...list)
      }
    }

    if (links.length === 0 && hidden.length === 0) {
      if (directories.length === 0 && files.length === 0) {
        // empty directory
        found.empties.push(path)
      } else if (options.orphans && directories.length === 0 && files.length === 1) {
        // orphan file
        found.orphans.push(files[0])
      } else if (options.sizes && directories.length === 0 && files.length > 0) {
        const images = ['.bmp', '.gif', '.jpg', '.jpeg', '.png', '.psd', '.svg', '.tiff', '.webp']
        const sizes = []
        for (const f of files) {
          if (images.includes(extname(f).toLowerCase())) {
            try {
              const dimensions = imageSize(f)
              if (options.verbose) console.log(f, dimensions)
              sizes.push(dimensions.height * dimensions.width)
            } catch (sizeError) {
              console.error(`${f} ${sizeError.message}`)
            }
          }
        }
        if (sizes.length > 0) {
          found.sizes.push({ path: path, size: Math.floor(sizes.reduce((previous, current) => (previous + current)) / sizes.length) })
        }
      }
    }
  } catch (err) {
    console.error(path)
    console.error(err)
  }
  return found
}

async function find () {
  const [, , ...args] = argv
  const options = {
    delete: false,
    orphans: false,
    verbose: false,
    sizes: false
  }
  const dirs = new Set()
  for (const arg of args) {
    if (arg === '-d') {
      options.delete = true
      continue
    }
    if (arg === '-o') {
      options.orphans = true
      continue
    }
    if (arg === '-s') {
      options.sizes = true
      continue
    }
    if (arg === '-v') {
      options.verbose = true
      continue
    }
    dirs.add(resolve(arg))
  }
  if (options.verbose) console.log('options: %O', options)
  for (const d of dirs) {
    console.log(`\nStarting at ${d}\n`)
    const results = await directory(d, options)

    if (results.empties.length > 0) {
      console.log(`\n${options.delete ? 'Deleting' : 'Empties'}:`)
      for (const p of results.empties) {
        console.log(p)
        if (options.delete) rmdir(p)
      }
    } else {
      console.log('\nNo empty directories')
    }

    if (options.orphans) {
      if (results.orphans.length > 0) {
        console.log('\nOrphans:')
        for (const p of results.orphans) {
          console.log(p)
        }
      } else {
        console.log('\nNo orphaned files')
      }
    }

    if (options.sizes) {
      for (const p of results.sizes.sort((a, b) => (a.size - b.size))) {
        console.log(`${Math.floor(p.size / 100000) / 10}\t${p.path}`)
      }
    }
  }
}

find()
