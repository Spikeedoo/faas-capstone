const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { validatePasswordHashes } = require('./utils')
const db = require('./db')

const {
  ERROR_CONSTANTS,
} = require('./shared/utils')

const app = express()
const PORT = 3000

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.send({ success: false, error: ERROR_CONSTANTS.MISSING_PARAM })

  const functionQuery = await db.query('SELECT * FROM users WHERE username = $1', [username])
  const { rows = [] } = functionQuery
  const targetUser = rows[0]

  if (!targetUser) return res.send({ success: false, error: 'User does not exist' })
  const { password: passwordHash, id } = targetUser

  if (!await validatePasswordHashes(password, passwordHash)) return res.send({ success: false, error: 'Incorrect password' })

  const token = jwt.sign({
    userId: id,
  }, process.env.JWT_SECRET)

  return res.send({ success: true, accessToken: token })
})

app.listen(PORT, (error) => {
  if (error) console.error(error)
  else console.log(`Backend running on port ${PORT}!`)
})
