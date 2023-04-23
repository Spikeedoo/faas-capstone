const bcrypt = require('bcrypt')

const SALT_ROUNDS = 10

/* Hashes a password using bcrypt */
const hashPassword = async (plaintextPassword) => {
  try {
    const hash = await bcrypt.hash(plaintextPassword, SALT_ROUNDS)
    return { success: true, hash }
  } catch (err) {
    return { success: false, err }
  }
}

/* Verifies an entered password against its hash for a match */
const validatePasswordHashes = (plaintextPassword, hash) => {
  return bcrypt.compare(plaintextPassword, hash)
}

module.exports = {
  hashPassword,
  validatePasswordHashes,
}