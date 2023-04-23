const amqp = require('amqplib/callback_api')
const Docker = require('dockerode')
const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const db = require('./db')

const stream = require('stream')
const finalStream = require('final-stream')

const {
  MESSAGE_QUEUES,
} = require('./shared/utils')

amqp.connect('amqp://guest:guest@rabbitmq:5672', function(error0, connection) {
  if (error0) {
    throw error0
  }
  connection.createChannel(function(error1, channel) {
    if (error1) {
      throw error1
    }

    const rxQueue = MESSAGE_QUEUES.EXECUTION_QUEUE
    const txQueue = MESSAGE_QUEUES.EXECUTION_RESPONSE_QUEUE

    // Set up execution channel
    channel.assertQueue(rxQueue, { durable: false })

    channel.assertQueue(txQueue, { durable: false })

    // Consume execution channel
    channel.consume(rxQueue, async (msg) => {
      const stdout = new stream.PassThrough()
      // Parse execution information
      const execution = JSON.parse(msg.content.toString())
      const { functionName, params = {}, executionId } = execution

      // Call database to get function info
      const functionQuery = await db.query('SELECT * FROM functions WHERE name = $1', [functionName])
      const { rows = [] } = functionQuery
      const targetFunction = rows[0]
      const { latest_image_tag, memory = 256 } = targetFunction

      const createOptions = {
        HostConfig: {
          Memory: memory * 1000 * 1000, // MB -> Bytes
        },
      }

      // Execute the function
      const [_, container] = await docker.run(latest_image_tag, [JSON.stringify(params)], stdout, createOptions)

      // Capture the response
      const response = await finalStream(stdout).then(buffer => buffer.toString())

      // Send the response
      channel.sendToQueue(txQueue, Buffer.from(JSON.stringify({ response, executionId })))

      // Remove the container
      await container.remove()

    }, {
      noAck: true
    })
  })
})