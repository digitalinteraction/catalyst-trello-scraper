import { TrelloListWithCards } from '@openlab/trello-client'

export function pack(data: any) {
  return JSON.stringify(data)
}

export function unpack(data: string) {
  return JSON.parse(data)
}

/** Output projects in a structured way */
export function logItems<T>(
  items: T[],
  name: string,
  logger: (v: T, i: number) => string | string[]
) {
  const pluralized = name + (items.length === 1 ? 's' : '')

  console.log(`Found ${items.length} ${pluralized}`)

  for (let i in items) {
    const toLog = logger(items[i], parseInt(i, 10))
    console.log(Array.isArray(toLog) ? toLog.join(' ') : toLog)
  }
}

export function logContent(content: Record<string, string> = {}) {
  if (Object.keys(content).length === 0) {
    console.log('No content found')
    return
  }

  console.log(`Found content:`)

  for (let key in content) {
    console.log(`[${key}] = "${content[key]}"\n`)
  }
}

export function extractContent(lists: TrelloListWithCards[]) {
  const contentRegex = /^\[(\S+)\]$/
  const content: Record<string, string> = {}

  for (let list of lists) {
    for (let card of list.cards) {
      let match = contentRegex.exec(card.name)
      if (!match) continue
      content[match[1]] = card.desc
    }
  }

  return content
}
