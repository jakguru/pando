import color from 'cli-color'
import dgram from 'dgram'
import figlet from 'figlet'
import fs from 'fs'
import picomatch from 'picomatch'
import { Server } from 'socket.io'
import { Duplex } from 'stream'
import { inspect } from 'util'
import { deserialize } from 'v8'
import winston from 'winston'
import parser from './parser'
import {
  getNumericLevel,
  getTextLevel,
  colors as levelColors,
  possible,
  levels as rawLevels,
} from './static'

const levels: Record<string, number> = Object.assign({}, rawLevels, {
  none: undefined,
})
delete levels.none

const PANDO_PORT = process.env.PANDO_PORT || '1835'
const PANDO_CLIENT_PORT = process.env.PANDO_CLIENT_PORT || '1385'
const PANDO_APP_NAME = process.env.PANDO_APP_NAME || 'Pando'
const DEBUG = process.env.DEBUG || ''
/**
 * A map of channels and their max level
 */
const channels = new Map<string, number>()
const channelNames = new Map<string, string>()
const seenUnloggedChannels = new Set<string>()
if (DEBUG && DEBUG.trim().length > 0) {
  DEBUG.split(',').forEach((c) => {
    const parts = c.split(':').map((p) => p.trim())
    const lastPart = parts[parts.length - 1]
    if (!possible.includes(lastPart)) {
      parts.push('debug')
    }
    const levelPart = parts.pop()
    const level = getNumericLevel(levelPart!, undefined)
    if (parts.length === 0) {
      parts.push('*')
    }
    const channelId = parts.join('/')
    const channelName = parts.join(':')
    if (level >= 0) {
      channels.set(channelId, level)
      channelNames.set(channelName, channelId)
    }
  })
}

const subscribe = (channel: string, level?: string | number | undefined) => {
  const parts = channel.split(':').map((p) => p.trim())
  if ('undefined' === typeof level) {
    const lastPart = parts[parts.length - 1]
    if (!possible.includes(lastPart)) {
      parts.push('debug')
    }
    level = parts.pop()
  }
  if ('number' !== typeof level) {
    level = getNumericLevel(level!, undefined)
  }
  if (parts.length === 0) {
    parts.push('*')
  }
  const channelId = parts.join('/')
  const channelName = parts.join(':')
  if ('number' === typeof level && level >= 0) {
    channels.set(channelId, level)
    channelNames.set(channelName, channelId)
    seenUnloggedChannels.delete(channelName)
  }
}

const unsubscribe = (channel: string) => {
  const parts = channel.split(':').map((p) => p.trim())
  while (possible.includes(parts[parts.length - 1])) {
    parts.pop()
  }
  if (parts.length === 0) {
    parts.push('*')
  }
  const channelId = parts.join('/')
  const channelName = parts.join(':')
  channels.delete(channelId)
  channelNames.delete(channelName)
}

const getChannelXtermColor = (channel: string) => {
  let index = [...channelNames.keys()].indexOf(channel)
  while (index > 255) {
    index -= 255
  }
  return color.xterm(index)
}

const pandoLogFormat = winston.format.printf(({ level, message, label, timestamp }) => {
  if (levelColors[level]) {
    level = levelColors[level](level)
  } else {
    level = color.whiteBright(level)
  }
  return `[${color.greenBright(timestamp)}][${label}][${level}]: ${message}`
})

const consumer = async () => {
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
  const ipc = dgram.createSocket('udp4')
  const io = new Server(parseInt(PANDO_CLIENT_PORT), {
    serveClient: false,
    allowEIO3: true,
    cors: {
      origin: '*',
    },
  })
  const logStream = new Duplex({
    write(chunk, _encoding, callback) {
      io.emit('log', chunk.toString())
      callback()
    },
    read(_size) {
      return null
    },
  })
  const logger = winston.createLogger({
    level: 'debug',
    levels,
    format: winston.format.combine(winston.format.timestamp(), pandoLogFormat),
    transports: [
      new winston.transports.Stream({
        stream: fs.createWriteStream('/dev/stdout'),
      }),
      new winston.transports.Stream({
        stream: logStream,
      }),
    ],
    exitOnError: false,
  })
  const log = (channel: string, level: string, ...what: any[]) => {
    const channelLabel = channel
    if (!channel.includes(':')) {
      channel += ':*'
    }
    const matches = new Set<string>()
    const hasMatch = picomatch.isMatch(channel, [...channelNames.keys()], {
      basename: false,
      nonegate: true,
      cwd: '',
      onMatch: (match) => {
        matches.add(match.glob)
      },
    })
    if (hasMatch && matches.size > 0) {
      // find the best match by checking *how* exact the match is
      // i.e. a match of "foo:bar" is better than "foo:*"
      const channelParts = channel.split(':')
      const sortedMatches = [...matches].sort((a, b) => {
        const aParts = a.split(':')
        const bParts = b.split(':')
        const aIsExact = aParts.every((part, index) => part === channelParts[index])
        const bIsExact = bParts.every((part, index) => part === channelParts[index])
        if (aIsExact && !bIsExact) {
          return -1
        }
        if (!aIsExact && bIsExact) {
          return 1
        }
        return aParts.length - bParts.length
      })
      const bestMatch = sortedMatches.shift()
      const channelId = channelNames.get(bestMatch!)
      const channelLevel = channels.get(channelId!) || -1
      if (channelLevel >= 0) {
        const levelNumber = getNumericLevel(level, 'debug')
        if (levelNumber <= channelLevel) {
          const label = getChannelXtermColor(bestMatch!)(channelLabel)
          logger.log({
            label,
            level,
            message: what
              .map((i) => {
                if ('string' === typeof i) {
                  return i
                } else {
                  return inspect(i, false, 25, true)
                }
              })
              .join(' '),
          })
        }
      }
    } else {
      if (!seenUnloggedChannels.has(channel)) {
        seenUnloggedChannels.add(channel)
        log('pando', 'notice', `No log channel for "${channel}"`)
      }
    }
  }
  log(
    'pando',
    'debug',
    `Preloaded Channels: ${[...channelNames.keys()]
      .map((name) => {
        const channelId = channelNames.get(name)!
        const levelId = channels.get(channelId)!
        const levelText = getTextLevel(levelId)
        const colorizer = getChannelXtermColor(channelId)
        const label = colorizer(name)
        const level = levelColors[levelText](levelText)
        return `${label}=${level}`
      })
      .join(', ')}`
  )
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
    log('pando:client', 'info', `Listening for clients on ${address.address}:${PANDO_CLIENT_PORT}`)
  })
  ipc.bind(parseInt(PANDO_PORT))
  io.on('connection', (socket) => {
    log('pando:client', 'debug', `Client connected: ${socket.id}`)
    socket.on('disconnect', () => {
      log('pando:client', 'debug', `Client disconnected: ${socket.id}`)
    })
    socket.on('subscribe', subscribe)
    socket.on('unsubscribe', unsubscribe)
  })
}

export default consumer
