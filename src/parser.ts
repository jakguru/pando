import { inspect } from 'util'
import { getLevel } from './static'

export default function parser(input: string) {
  let level = 'info'
  input = input.trimEnd()
  if (input.startsWith('{') && input.endsWith('}')) {
    try {
      const obj = JSON.parse(input)
      if (obj.level || obj.message) {
        if (obj.level) {
          level = obj.level
        }
        if (obj.message) {
          input = obj.message
        }
      } else {
        input = inspect(obj, false, 25, true)
      }
    } catch {
      // it's not a JSON object
    }
  }
  /**
   * PulseAudio Style Logger
   */
  if (
    /\(\s+\d+\.\d+\|\s+\d+\.\d+\)\s([A-Z]):\s\[([a-z]+)\]\[([a-zA-Z0-9\s\.\/\:\(\)]+)\]\s+(.*)$/gm.test(
      input
    )
  ) {
    const regex =
      /\(\s+\d+\.\d+\|\s+\d+\.\d+\)\s([A-Z]):\s\[([a-z]+)\]\[([a-zA-Z0-9\s\.\/\:\(\)]+)\]\s+(.*)$/gm
    let m
    while ((m = regex.exec(input)) !== null) {
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }
      m.forEach((match, groupIndex) => {
        switch (groupIndex) {
          case 4:
            input = match
            break
        }
      })
    }
  }
  /**
   * Supervisord Style Logger
   */
  if (/\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2},\d{3}\s([A-Z]+)\s+(.*)$/gm.test(input)) {
    const regex = /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2},\d{3}\s([A-Z]+)\s+(.*)$/gm
    let m
    while ((m = regex.exec(input)) !== null) {
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }
      m.forEach((match, groupIndex) => {
        switch (groupIndex) {
          case 1:
            level = getLevel(match)
            break

          case 2:
            input = match
            break
        }
      })
    }
  }
  /**
   * MediaMTX Style Logger
   */
  if (/\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}:\d{2}\s([A-Z]+)\s+(.*)$/gm.test(input)) {
    const regex = /\d{4}\/\d{2}\/\d{2}\s\d{2}:\d{2}:\d{2}\s([A-Z]+)\s+(.*)$/gm
    let m
    while ((m = regex.exec(input)) !== null) {
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }
      m.forEach((match, groupIndex) => {
        switch (groupIndex) {
          case 1:
            level = getLevel(match)
            break

          case 2:
            input = match
            break
        }
      })
    }
  }
  /**
   * AdonisJS Style Pretty Logs
   */
  if (/\[\s+(trace|debug|info|warn|error|fatal)\s+\]\s+(.*)$/gm.test(input)) {
    const regex = /\[\s+(trace|debug|info|warn|error|fatal)\s+\]\s+(.*)$/gm
    let m
    while ((m = regex.exec(input)) !== null) {
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }
      m.forEach((match, groupIndex) => {
        switch (groupIndex) {
          case 1:
            level = getLevel(match)
            break

          case 2:
            input = match
            break
        }
      })
    }
  }
  /**
   * AdonisJS Child Logger Logs
   */
  if (/\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s+([A-Z]+)\s\([a-z-\/0-9]+\):\s(.*)$/gm.test(input)) {
    const regex = /\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s+([A-Z]+)\s\([a-z-\/0-9]+\):\s(.*)$/gm
    let m
    while ((m = regex.exec(input)) !== null) {
      if (m.index === regex.lastIndex) {
        regex.lastIndex++
      }
      m.forEach((match, groupIndex) => {
        switch (groupIndex) {
          case 1:
            level = getLevel(match)
            break

          case 2:
            input = match
            break
        }
      })
    }
  }
  return {
    level,
    input,
  }
}
