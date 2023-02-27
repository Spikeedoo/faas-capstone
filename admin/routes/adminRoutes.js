const adminRoute = require('express').Router()
const multer  = require('multer')
const Docker = require('dockerode')
const fs = require('fs/promises')
var tar = require('tar')
const pathLib = require('path')

const docker = new Docker({socketPath: '/var/run/docker.sock'})
const upload = multer({ dest: 'upload' })

const {
  ERROR_CONSTANTS,
} = require('../shared/utils')

const db = require('../db')
const { copyFiles, resolveBuildPath, resolveUploadPath, listFilesRecursively, fileExists, VALID_ENV_NAMES, VALID_ENV_CONFIGS } = require('../utils')
// Admin routes for cloud function CRUD operations

// *** Helpers *** //
const buildDirStr = (buildId) => `${buildId}-build`

const cleanUpBuildFiles = async (buildId) => {
  await fs.rm(buildDirStr(buildId), { recursive: true, force: true })
  await fs.rm(buildId, { force: true })
}

// *** Routes *** //

// List cloud functions
adminRoute.get('/list', async (_, res) => {
  const cloudFunctionList = await db.query('SELECT * FROM functions')
  const { rows = [] } = cloudFunctionList
  res.send({ success: true, data: rows })
})

// Fetch data about specific cloud function
adminRoute.post('/info', async (req, res) => {
  const { functionName } = req.body || {}
  if (!functionName) return res.send({ success: false, error: ERROR_CONSTANTS.MISSING_PARAM })
  
  const functionQuery = await db.query('SELECT * FROM functions WHERE name = $1', [functionName])
  const { rows = [] } = functionQuery
  const targetFunction = rows[0]

  res.send({ success: true, data: { ...targetFunction } })
})

// Deploy cloud function
adminRoute.post('/deploy', upload.single('deployment'), async (req, res) => {
  const { env } = req.body || {}
  const { filename, path } = req.file || {}
  const buildDir = buildDirStr(path)

  // Validate function environment before kicking off build
  if (!VALID_ENV_NAMES.includes(env)) res.status(400).send({ error: 'Invalid environment!' })
  // Since a valid env name was passed, get the rest of the env config
  const selectedEnvConfig = VALID_ENV_CONFIGS.find(cfg => cfg.name === env) || {}

  try {
    // Create build dir
    await fs.mkdir(buildDir, { recursive: true })

    // Untar to build dir
    await tar.x(
      {
        strip: 1,
        file: path,
        cwd: buildDir,
      }
    )
  } catch (err) {
    await cleanUpBuildFiles(path)
    res.status(400).send({ error: err })
  }

  // Validate existence of dependency/config file
  const depFileExists = await fileExists(selectedEnvConfig.depFilePath)
  if (!depFileExists) {
    await cleanUpBuildFiles(path)
    res.status(400).send({ error: `Missing a dependency file for your selected function environment (${env})!` })
  }

  res.status(200).send({ buildId: filename })

})

adminRoute.get('/build', async (req, res) => {
  const { buildId, functionName, env, module, cpu, memory } = req.query || {}
  // Set up for event-stream response
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  }
  res.writeHead(200, headers)

  const functionQuery = await db.query('SELECT * FROM functions WHERE name = $1', [functionName])
  const { rows = [] } = functionQuery

  !rows.length ? res.write(`Creating new function: ${functionName}\n\n`) : res.write(`Updating function: ${functionName}\n\n`)

  res.write('Setting up build environment...\n\n')

  // Move template files in
  await copyFiles(resolveBuildPath(env), buildDirStr(resolveUploadPath(buildId)))

  res.write('Building function image...\n\n')

  // Build function image
  let stream = await docker.buildImage({
      context: pathLib.resolve(__dirname, buildDirStr(resolveUploadPath(buildId))),
      src: listFilesRecursively(resolveUploadPath(buildDirStr(buildId)), resolveUploadPath(buildDirStr(buildId))),
    },
    {
      t: buildId,
      buildargs: { module, target_function: functionName },
    })

  // TODO: Better error handling here
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (err, res) => {
      err ? reject(err) : resolve(res)
    })
  })

  res.write(`New image built with id: ${buildId}\n\n`)

  // Database functions
  if (!rows.length) {
    await db.query('INSERT INTO functions (name, env, memory, cpus, type, "latestImageTag") VALUES ($1, $2, $3, $4, $5, $6)', [
      functionName,
      env,
      memory,
      cpu,
      'http',
      buildId,
    ])
  } else {
    await db.query('UPDATE functions SET "latestImageTag" = $1 WHERE name = $2', [
      buildId,
      functionName,
    ])
  }

  // Clean up
  res.write('Cleaning build files...\n\n')
  await cleanUpBuildFiles(resolveUploadPath(buildId))  
  res.write('Done!\n\n')
  res.end()
})

// Delete cloud function
adminRoute.post('/delete', async (req, res) => {

})

module.exports = adminRoute
