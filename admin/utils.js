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
      list.push(fullPath.split(initialDir+'/')[1])
     }
  })
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

const fileExists = async (path) => {  
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

// Constants
const ENV_NODE_14_CONFIG = {
  name: 'node-14',
  depFilePath: 'package.json'
}

const ENV_PYTHON3_CONFIG = {
  name: 'python3',
  depFilePath: 'requirements.txt',
}

const VALID_ENV_CONFIGS = [ENV_NODE_14_CONFIG, ENV_PYTHON3_CONFIG]
const VALID_ENV_NAMES = VALID_ENV_CONFIGS.map(config => config.name)

const VALID_MEMORY_CONFIGS = ["128", "256", "512", "1024", "2048", "4096", "8192"]
const VALID_CPU_CONFIGS = ["1", "2", "4"]

module.exports = {
  copyFiles,
  listFilesRecursively,
  resolveBuildPath,
  resolveUploadPath,
  fileExists,

  VALID_ENV_CONFIGS,
  VALID_ENV_NAMES,
  VALID_MEMORY_CONFIGS,
  VALID_CPU_CONFIGS,
}