import color from 'cli-color'
import dgram from 'dgram'
import figlet from 'figlet'
import fs from 'fs'
import { Server } from 'socket.io'
import { Duplex } from 'stream'
import { inspect } from 'util'
import { deserialize } from 'v8'
import winston from 'winston'
import parser from './parser'
import { colors as levelColors, levels } from './static'

const PANDO_PORT = process.env.PANDO_PORT || '1835'
const PANDO_CLIENT_PORT = process.env.PANDO_CLIENT_PORT || '1385'
const PANDO_APP_NAME = process.env.PANDO_APP_NAME || 'Pando'
const DEBUG = process.env.DEBUG || ''

const consumer = async () => {
  const debugChannels = DEBUG.split(',')
  const channels = debugChannels.map((channel) => {
    if (!channel.endsWith(':*')) {
      channel = channel + ':*'
    }
    return { channel, enabled: true }
  })
  const pandoFormat = winston.format.printf(({ level, message, label, timestamp }) => {
    if (levelColors[level]) {
      level = levelColors[level](level)
    } else {
      level = color.whiteBright(level)
    }
    return `[${color.greenBright(timestamp)}][${label}][${level}]: ${message}`
  })
  const ipc = dgram.createSocket('udp4')
  const io = new Server(parseInt(PANDO_CLIENT_PORT), {
    serveClient: false,
    allowEIO3: true,
    cors: {
      origin: '*',
    },
  })
  const logStream = new Duplex({
    write(_chunk, _encoding, callback) {
      callback()
    },
    read(_size) {
      return null
    },
  })
  logStream.on('data', (chunk) => {
    io.emit('log', chunk.toString())
  })
  ipc.on('error', (err) => {
    log('pando', 'error', err)
    ipc.close()
  })
  ipc.on('message', (msg) => {
    try {
      const deserialized = deserialize(msg)
      if ('object' !== typeof deserialized || null === deserialized || !deserialized.channel) {
        return
      }
      const { channel, what } = deserialized
      const whatAsString = what.join(' ')
      const { level, input } = parser(whatAsString)
      const rows = input.split('\n')
      rows.forEach((row) => {
        log(channel, level, row)
      })
    } catch (err) {
      log('pando', 'error', err)
      return
    }
  })
  ipc.on('listening', () => {
    const address = ipc.address()
    log('pando', 'info', `Listening for IPC on ${address.address}:${address.port}`)
    log('pando', 'info', `Listening for clients on ${address.address}:${PANDO_CLIENT_PORT}`)
  })
  const channelLoggers = Object.assign(
    {},
    ...channels.map((channel, index) => {
      let colorIndex = index
      while (colorIndex > 255) {
        colorIndex -= 255
      }
      const logger = winston.createLogger({
        level: 'debug',
        levels,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.label({
            label: color.xterm(colorIndex)(channel.channel.replace(/:\*$/, '')),
          }),
          pandoFormat
        ),
        transports: [
          new winston.transports.Stream({
            stream: fs.createWriteStream('/dev/stdout'),
          }),
          new winston.transports.Stream({
            stream: logStream,
          }),
        ],
      })
      return { [channel.channel]: logger }
    })
  )
  const loggerNotEnabledWarning = new Set<string>()
  const subscribe = (channel: string) => {
    if (!channel.endsWith(':*')) {
      channel = channel + ':*'
    }
    const index = channels.findIndex((c) => c.channel === channel)
    if (index >= 0) {
      return
    }
    channels.push({ channel, enabled: true })
    let colorIndex = channels.length - 1
    while (colorIndex > 255) {
      colorIndex -= 255
    }
    channelLoggers[channel] = winston.createLogger({
      level: 'debug',
      levels,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.label({
          label: color.xterm(colorIndex)(channel.replace(/:\*$/, '')),
        }),
        pandoFormat
      ),
      transports: [
        new winston.transports.Stream({
          stream: fs.createWriteStream('/dev/stdout'),
          level: 'debug',
        }),
        new winston.transports.Stream({
          stream: logStream,
          level: 'debug',
        }),
      ],
    })
  }
  const unsubscribe = (channel: string) => {
    if (!channel.endsWith(':*')) {
      channel = channel + ':*'
    }
    const index = channels.findIndex((c) => c.channel === channel)
    if (index >= 0) {
      channels.splice(index, 1)
    }
    delete channelLoggers[channel]
    if (index >= 0) {
    }
  }
  const log = (channel: string, level: string, ...what: any[]) => {
    const splitChannel = channel.split(':')
    let logger: winston.Logger | undefined
    if (channels.find((c) => c.channel === '*:*')) {
      subscribe(channel)
    }
    const combinedChannel: Array<string> = []
    while (!logger && splitChannel.length > 0) {
      const next = splitChannel.shift()
      if (!next) {
        break
      }
      combinedChannel.push(next)
      const joinedChannel = combinedChannel.join(':')
      if (channelLoggers[joinedChannel]) {
        logger = channelLoggers[joinedChannel]
        break
      }
      const joinedChannelWithWildcard = joinedChannel + ':*'
      if (channelLoggers[joinedChannelWithWildcard]) {
        logger = channelLoggers[joinedChannelWithWildcard]
        break
      }
    }
    if (!logger) {
      if (!loggerNotEnabledWarning.has(channel)) {
        loggerNotEnabledWarning.add(channel)
        io.emit('unknown-channel', channel)
        const hasPandoChannel = channels.find((c) => c.channel.startsWith('pando'))
        if (hasPandoChannel) {
          log('pando', 'debug', `No logger found for channel "${channel}"`)
        }
      }
      return
    }
    if (!logger[level] || 'function' !== typeof logger[level]) {
      return
    }
    what = what.map((i) => {
      if ('string' === typeof i) {
        return i
      } else {
        return inspect(i, false, 25, true)
      }
    })
    logger[level](...what)
  }
  console.log(
    color.blueBright(
      figlet.textSync(PANDO_APP_NAME, {
        horizontalLayout: 'default',
        verticalLayout: 'default',
        width: 80,
        whitespaceBreak: true,
      })
    )
  )
  log(
    'pando',
    'info',
    `Currently enabled loggers: ${channels
      .map((c, i) => {
        let colorIndex = i
        while (colorIndex > 255) {
          colorIndex -= 255
        }
        return color.xterm(colorIndex)(c.channel)
      })
      .join(', ')}`
  )
  ipc.bind(parseInt(PANDO_PORT))
  io.on('connection', (socket) => {
    log('pando', 'info', `Client connected: ${socket.id}`)
    socket.on('disconnect', () => {
      log('pando', 'info', `Client disconnected: ${socket.id}`)
    })
    socket.on('subscribe', subscribe)
    socket.on('unsubscribe', unsubscribe)
  })
}

export default consumer
