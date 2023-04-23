const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const authHeader = req.get('Authorization')
  if (!authHeader) return res.status(401).send({ error: 'Invalid authentication' })
  const accessToken = authHeader.split('Bearer ')[1]
  if (!accessToken) return res.status(401).send({ error: 'Invalid authentication' })
  try {
    jwt.verify(accessToken, process.env.JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).send({ error: 'Unauthorized' })
  }
}