const modulePath = process.env.module
const targetFunction = process.env.target_function
const args = process.argv.slice(2)

const argument = args[0] || '{}'
const params = JSON.parse(argument)

const targetModule = require(modulePath)

const fn = targetModule.deploy[targetFunction]

const result = fn({ data: params })

process.stdout.write(JSON.stringify(result))
