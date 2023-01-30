const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

const adminRoute = require('./routes/adminRoutes')

const app = express()
const PORT = 3000

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use('/', adminRoute)

app.listen(PORT, (error) => {
  if (error) console.error(error)
  else console.log(`Backend running on port ${PORT}!`)
})
