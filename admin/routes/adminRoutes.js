const adminRoute = require('express').Router()
const multer  = require('multer')
const Docker = require('dockerode')
const fs = require('fs/promises')
var tar = require('tar')
const pathLib = require('path')

const docker = new Docker({socketPath: '/var/run/docker.sock'})
const upload = multer({ dest: 'upload' })
const adminAuth = require('../middleware/auth')

const {
  ERROR_CONSTANTS,
} = require('../shared/utils')

const db = require('../db')
const { copyFiles, resolveBuildPath, resolveUploadPath, listFilesRecursively, fileExists, VALID_ENV_NAMES, VALID_ENV_CONFIGS, VALID_MEMORY_CONFIGS, VALID_CPU_CONFIGS } = require('../utils')
// Admin routes for cloud function CRUD operations

// *** Helpers *** //
const buildDirStr = (buildId) => `${buildId}-build`

const cleanUpBuildFiles = async (buildId) => {
  await fs.rm(buildDirStr(buildId), { recursive: true, force: true })
  await fs.rm(buildId, { force: true })
}

// *** Routes *** //
adminRoute.use(adminAuth)
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
  const { env, functionName, module, cpu = "1", memory = 256 } = req.body || {}
  const { filename, path } = req.file || {}
  const buildDir = buildDirStr(path)

  // Validate function environment before kicking off build
  if (!VALID_ENV_NAMES.includes(env)) return res.status(400).send({ error: 'Invalid environment!' })
  if (!VALID_MEMORY_CONFIGS.includes(memory)) return res.status(400).send({ error: 'Invalid memory value!' })
  if (!VALID_CPU_CONFIGS.includes(cpu)) return res.status(400).send({ error: 'Invalid CPU value!' })
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
    return res.status(400).send({ error: err })
  }

  // Validate existence of dependency/config file
  const depFileExists = await fileExists(selectedEnvConfig.depFilePath)
  if (!depFileExists) {
    await cleanUpBuildFiles(path)
    return res.status(400).send({ error: `Missing a dependency file for your selected function environment (${env})!` })
  }

  const functionQuery = await db.query('SELECT * FROM functions WHERE name = $1', [functionName])
  const { rows = [] } = functionQuery

  // Move template files in
  await copyFiles(resolveBuildPath(env), buildDirStr(resolveUploadPath(filename)))

  // Build function image
  let stream = await docker.buildImage({
      context: pathLib.resolve(__dirname, buildDirStr(resolveUploadPath(filename))),
      src: listFilesRecursively(resolveUploadPath(buildDirStr(filename)), resolveUploadPath(buildDirStr(filename))),
    },
    {
      t: filename,
      buildargs: { module, target_function: functionName },
    })

  // TODO: Better error handling here
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (err, res) => {
      err ? reject(err) : resolve(res)
    })
  })

  // Database functions
  if (!rows.length) {
    await db.query('INSERT INTO functions (name, env, memory, cpus, type, latest_image_tag, latest_deploy_date) VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))', [
      functionName,
      env,
      memory,
      cpu,
      'http',
      filename,
      Date.now() / 1000.0,
    ])
  } else {
    await db.query('UPDATE functions SET latest_image_tag = $1, latest_deploy_date = to_timestamp($2) WHERE name = $3', [
      filename,
      Date.now() / 1000.0,
      functionName,
    ])
  }

  // Clean up
  await cleanUpBuildFiles(resolveUploadPath(filename))  

  return res.status(200).send({ success: true })
})

// Delete cloud function
adminRoute.post('/delete', async (req, res) => {

})

module.exports = adminRoute
