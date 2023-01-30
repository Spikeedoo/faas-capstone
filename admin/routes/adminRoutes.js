const adminRoute = require('express').Router()
const multer  = require('multer')
const Docker = require('dockerode')
const fs = require('fs/promises')
var tar = require('tar')

const docker = new Docker({socketPath: '/var/run/docker.sock'})
const upload = multer({ dest: 'upload' })

const {
  ERROR_CONSTANTS,
} = require('../shared/utils')

const db = require('../db')
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
  const { filename, path } = req.file
  const buildDir = buildDirStr(path)
  const { functionName, env, module } = req.body

  try {
    // Create build dir
    await fs.mkdir(buildDir, { recursive: true })

    // Untar to build dir
    await tar.x(
      {
        file: path,
        cwd: buildDir,
      }
    )
  } catch (err) {
    await cleanUpBuildFiles(path)
    res.status(400).send({ error: err })
  }

  res.status(200).send({ buildId: filename, functionName })

})

adminRoute.get('/build', async (req, res) => {
  const { buildId, functionName } = req.query || {}
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
  if (!rows.length) {
    res.write(`Creating new function: ${functionName}\n\n`)
    // await db.query('')
  } else {
    res.write(`Updating function: ${functionName}\n\n`)
  }

  res.write(`${buildId} is ready to build...\n\n`)

  res.write('Cleaning build files...\n\n')
  await cleanUpBuildFiles(`upload/${buildId}`)
  res.write('Done!\n\n')
  res.end()
})

// Delete cloud function
adminRoute.post('/delete', async (req, res) => {

})

module.exports = adminRoute
