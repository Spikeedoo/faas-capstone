const { Pool } = require('pg')
 
const pool = new Pool()
 
module.exports = {
  async query(text, params) {
    return await pool.query(text, params)
  },
}
