import dgram from 'dgram'
import { serialize } from 'v8'
const PANDO_PORT = process.env.PANDO_PORT || '1835'

const producer = async (ipc: dgram.Socket, channel?, ...what: string[]) => {
  if (!channel || !what || !Array.isArray(what) || what.length === 0) {
    return
  }
  try {
    await new Promise((resolve, reject) => {
      ipc.send(serialize({ channel, what }), parseInt(PANDO_PORT), 'localhost', (err) => {
        if (err) {
          return reject(err)
        }
        return resolve(void 0)
      })
    })
  } catch (error) {
    console.error(error)
  }
}

export default producer
