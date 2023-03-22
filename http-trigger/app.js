const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const db = require('./db')
const EventEmitter = require('events')
const crypto = require('crypto')

const {
  ERROR_CONSTANTS,
  MESSAGE_QUEUES,
} = require('./shared/utils')

const app = express()
const PORT = 3000

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

const txQueue = MESSAGE_QUEUES.EXECUTION_QUEUE
const rxQueue = MESSAGE_QUEUES.EXECUTION_RESPONSE_QUEUE

const rxEventEmitter = new EventEmitter()

let rabbitChannel = null

const init = () => {
  return require('amqplib').connect('amqp://guest:guest@rabbitmq:5672')
    .then(connection => connection.createChannel())
    .then(channel => {
      rabbitChannel = channel

      channel.assertQueue(txQueue, { durable: false })
      channel.assertQueue(rxQueue, { durable: false })

      // Listen for responses
      channel.consume(rxQueue, async (msg) => {
        rxEventEmitter.emit('rx', msg)
      }, { noAck: true })
    })
}



app.post('/:functionName', async (req, res) => {
  const { functionName } = req.params || {}
  const { data = {} } = req.body || {}
  if (!functionName || !Object.values(data)) return res.send({ success: false, error: ERROR_CONSTANTS.MISSING_PARAM })

  const functionQuery = await db.query('SELECT * FROM functions WHERE name = $1', [functionName])
  const { rows = [] } = functionQuery
  const targetFunction = rows[0]
  if (!targetFunction) return res.send({ success: false, error: ERROR_CONSTANTS.INVALID_FUNCTION })

  const executionId = crypto.randomBytes(20).toString('hex')
  
  const msg = JSON.stringify({ functionName, params: data, executionId })
  rabbitChannel.sendToQueue(txQueue, Buffer.from(msg))
  
  rxEventEmitter.on('rx', async (msg) => {
    const fullResponse = JSON.parse(msg.content)
    const { executionId: returnedExecutionId, response = {} } = fullResponse
    if (executionId === returnedExecutionId) return res.status(200).json(JSON.parse(response))
  })
})

init()
  .then(() => app.listen(PORT, () => console.log(`Backend running on port ${PORT}!`)))
  .catch(err => console.error(err))