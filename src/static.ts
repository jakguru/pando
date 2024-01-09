import color from 'cli-color'
export const levels = {
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
  'inf': 'info',
  'fatal': 'crit',
  'critical': 'crit',
  'warning': 'warn',
  '*': 'trace',
  'notice': 'info',
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
export function getLevel(level: string) {
  level = color.strip(level.toLowerCase().trim()).trim()
  if (aliases[level]) {
    return aliases[level]
  } else if (Object.keys(levels).includes(level)) {
    return level
  } else {
    return 'trace'
  }
}
