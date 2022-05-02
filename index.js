import { mkdir, readdir, rename, rmdir, rm } from 'fs/promises'
import { dirname, extname, join, resolve } from 'path'
import { argv } from 'process'
import { imageSize } from 'image-size'

const categories = {
  image: ['.bmp', '.gif', '.jpg', '.jpeg', '.png', '.psd', '.svg', '.tiff', '.webp'],
  video: ['.avi', '.mov', '.mpg', '.mp4', '.wmv', '.mpeg']
}

async function directory (path, options) {
  if (options.verbose) console.error(path)
  const hidden = []
  const links = []
  const files = []
  const directories = []
  const found = {
    empties: []
  }
  if (options.orphans) found.orphans = []
  if (options.sizes) found.sizes = []
  if (options.categorize) {
    found.images = []
    found.videos = []
    found.others = []
    found.mixed = []
  }
  try {
    // process the contents of this directory
    for (const file of await readdir(path, { withFileTypes: true })) {
      if (file.name.startsWith('.')) {
        if (file.name === '.DS_Store') {
          if (options.delete) await rm(join(path, file.name))
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
      } else if ((options.sizes || options.categorize) && directories.length === 0 && files.length > 0) {
        const sizes = []
        const extensions = []
        for (const f of files) {
          const extension = extname(f).toLowerCase()
          if (options.sizes) {
            if (categories.image.includes(extension)) {
              try {
                const dimensions = imageSize(f)
                // if (options.verbose) console.error(f, dimensions)
                sizes.push(dimensions.height * dimensions.width)
              } catch (sizeError) {
                console.error(`${f} ${sizeError.message}`)
              }
            }
          }
          if (options.categorize) {
            extensions.push(extension)
          }
        }
        if (sizes.length > 0) {
          found.sizes.push({ path: path, size: Math.floor(sizes.reduce((previous, current) => (previous + current)) / sizes.length) })
        }
        if (options.categorize) {
          if (extensions.every(e => categories.image.includes(e))) found.images.push(path)
          else if (extensions.every(e => categories.video.includes(e))) found.videos.push(path)
          else if (!(extensions.some(e => categories.image.includes(e)) || extensions.some(e => categories.video.includes(e)))) found.others.push(path)
          else found.mixed.push(path)
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
    categorize: false,
    delete: false,
    orphans: false,
    verbose: false,
    sizes: false
  }
  const dirs = new Set()
  for (const arg of args) {
    switch (arg) {
      case '-c':
        options.categorize = true
        break

      case '-d':
        options.delete = true
        break

      case '-o':
        options.orphans = true
        break

      case '-s':
        options.sizes = true
        break

      case '-v':
        options.verbose = true
        break

      default:
        dirs.add(resolve(arg))
    }
  }
  if (options.verbose) console.error('options: %O', options)
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
        console.log(`${(p.size / 1000000).toFixed(1)}\t${p.path}`)
      }
    }

    if (options.categorize) {
      if (results.images.length > 0) {
        if (options.verbose) console.log('\nImage Directories:')
        const imageDir = join(d, '_images')
        for (const p of results.images) {
          if (p.startsWith(imageDir)) continue
          const destination = p.replace(d, imageDir)
          if (options.verbose) console.log(`${p} -> ${destination}`)
          try {
            await mkdir(dirname(destination), { recursive: true })
            await rename(p, destination)
          } catch (err) {
            console.error(err)
          }
        }
      } else {
        if (options.verbose) console.log('\nNo Image Directories')
      }

      if (results.videos.length > 0) {
        if (options.verbose) console.log('\nVideo Directories:')
        const videoDir = join(d, '_videos')
        for (const p of results.videos) {
          if (p.startsWith(videoDir)) continue
          const destination = p.replace(d, videoDir)
          if (options.verbose) console.log(`${p} -> ${destination}`)
          try {
            await mkdir(dirname(destination), { recursive: true })
            await rename(p, destination)
          } catch (err) {
            console.error(err)
          }
        }
      } else {
        if (options.verbose) console.log('\nNo Video Directories')
      }

      if (results.mixed.length > 0) {
        if (options.verbose) console.log('\nMixed Directories:')
        const mixedDir = join(d, '_mixed')
        for (const p of results.mixed) {
          if (p.startsWith(mixedDir)) continue
          const destination = p.replace(d, mixedDir)
          if (options.verbose) console.log(`${p} -> ${destination}`)
          try {
            await mkdir(dirname(destination), { recursive: true })
            await rename(p, destination)
          } catch (err) {
            console.error(err)
          }
        }
      } else {
        if (options.verbose) console.log('\nNo Mixed Directories')
      }

      // if (results.others.length > 0) {
      //   console.log('\nOther Directories:')
      //   for (const p of results.others) {
      //     console.log(p)
      //   }
      // } else {
      //   console.log('\nNo Other Directories')
      // }
    }
  }
}

find()
