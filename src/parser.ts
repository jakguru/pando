import { inspect } from 'util'

export default function parser(input: string) {
  let level = 'info'
  input = input.trim()
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
  return {
    level,
    input,
  }
}
