import dgram from 'dgram'
import 'dotenv/config'
import consumer from './src/consumer'
import producer from './src/producer'
const args = process.argv.slice(2)
if (args.length > 0) {
  /**
   * Launch the producer
   */
  const ipc = dgram.createSocket('udp4')
  const channel = args.shift()
  if (process.stdin && args[0] === '-') {
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      producer(ipc, channel, chunk.toString())
    })
  } else {
    producer(ipc, channel, ...args).then(() => {
      ipc.close()
      process.exit(0)
    })
  }
} else {
  /**
   * Launch the consumer
   */
  consumer()
}
