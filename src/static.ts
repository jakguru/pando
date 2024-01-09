import color from 'cli-color'
export const levels = {
  none: -1,
  emerg: 0,
  alert: 1,
  crit: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
}
export const aliases = {
  inf: 'info',
  fatal: 'crit',
  critical: 'crit',
  warning: 'warn',
  notice: 'info',
}
export const colors = {
  emerg: color.bgRedBright,
  alert: color.bgRed,
  crit: color.red,
  error: color.red,
  warning: color.yellow,
  notice: color.blue,
  info: color.blue,
  debug: color.magenta,
}
export function getLevel(level: string, defaultLevel = 'debug') {
  level = color.strip(level.toLowerCase().trim()).trim()
  if (parseInt(level).toString() === level) {
    const found = Object.keys(levels).find((l) => levels[l] === parseInt(level))
    if (found) {
      return found
    }
  }
  if ('number' === typeof level) {
    const found = Object.keys(levels).find((l) => levels[l] === level)
    if (found) {
      return found
    }
  }
  if (aliases[level]) {
    return aliases[level]
  }
  if (Object.keys(levels).includes(level)) {
    return level
  }
  return defaultLevel
}

export function getNumericLevel(level: string, defaultLevel = 'debug') {
  level = getLevel(level, defaultLevel)
  return levels[level] || levels[defaultLevel] || defaultLevel
}

export function getTextLevel(level: number, defaultLevel = 'debug') {
  level = getNumericLevel(level.toString(), defaultLevel)
  return Object.keys(levels).find((l) => levels[l] === level) || defaultLevel
}

export const possible = [
  ...new Set([
    ...Object.keys(levels),
    ...Object.keys(aliases),
    ...Object.values(levels),
    ...Object.values(levels).map((l) => l.toString()),
  ]),
]
