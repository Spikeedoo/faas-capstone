const fs = require('fs/promises')
const fsSync = require('fs')
const path = require('path')

// Functions
const listFilesRecursively = (dir, initialDir, list = []) => {
  fsSync.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file)
    if (fsSync.lstatSync(fullPath).isDirectory()) {
      listFilesRecursively(fullPath, initialDir, list)
     } else {
      // Add files to array without leading directory
      console.log(fullPath)
      list.push(fullPath.split(initialDir+'/')[1])
     }
  })
  console.log(list)
  return list
}

const copyFiles = async (moveFrom, moveTo) => {
  try {
    // Get the files as an array
    const files = await fs.readdir(moveFrom)

    for( const file of files ) {
        const fromPath = path.join(moveFrom, file)
        const toPath = path.join(moveTo, file)

        await fs.copyFile(fromPath, toPath)
    }
  } catch( e ) {
      console.error( "Error while moving files!", e )
  }
}

const resolveBuildPath = (env) => {
  return path.resolve('build-env', env)
}

const resolveUploadPath = (file) => {
  return path.resolve('upload', file)
}

module.exports = {
  copyFiles,
  listFilesRecursively,
  resolveBuildPath,
  resolveUploadPath,
}