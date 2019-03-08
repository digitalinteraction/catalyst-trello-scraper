import axios from 'axios'
import { TrelloBoard, Project, TagRelation, StringObject } from './types'

export type LabelRelationMap = {
  [idx: string]: TagRelation | undefined
}

export function extractDate(id: string): Date {
  let hexTimestamp = id.substring(0, 8)
  return new Date(parseInt(hexTimestamp, 16) * 1000)
}

/** A client to read cards from trello transform them into catalyst projects */
export class TrelloClient {
  client = axios.create({
    baseURL: 'https://api.trello.com/1',
    params: { key: this.appKey, token: this.token }
  })

  constructor(public appKey: string, public token: string) {}

  /** Fetch a trello board with the fields needed to process projects */
  async fetchBoard(id: string): Promise<TrelloBoard> {
    try {
      const { data } = await this.client.get<TrelloBoard>(`/boards/${id}`, {
        params: {
          fields: 'name',
          labels: 'all',
          cards: 'open',
          card_fields: 'id,name,idList,desc,descData,idLabels,dateLastActivity'
        }
      })
      return data
    } catch (error) {
      console.log(error.message)
      throw new Error(`Couldn't fetch board ${id}`)
    }
  }

  /** Process projects from a board's cards in a specific list */
  fetchProjects(board: TrelloBoard, publicListId: string) {
    const labels = {} as LabelRelationMap
    const findRelation = /^\s*(.+)\s*:\s*(.+)\s*$/

    // Find relationships from the cards using a regex
    for (let label of board.labels) {
      let match = findRelation.exec(label.name)
      if (!match) continue
      const [type, name] = match.slice(1)
      labels[label.id] = { name, type }
    }

    // A utility to map a card's labels to relations
    const mapLabels = (ids: string[], type: string) =>
      ids
        .filter(id => labels[id] && labels[id]!.type === type)
        .map(id => labels[id]!)

    const publicCards = board.cards.filter(card => card.idList === publicListId)
    const projects = new Array<Project>()

    // Map the cards in the public list to projects with relations
    for (let card of publicCards) {
      projects.push({
        ...card,
        dateCreated: extractDate(card.id),
        needs: mapLabels(card.idLabels, 'needs'),
        themes: mapLabels(card.idLabels, 'theme'),
        category: mapLabels(card.idLabels, 'category')[0] || null
      })
    }

    return projects
  }

  /** Process content from a board's cards in a specific list */
  fetchContent(board: TrelloBoard) {
    const contentRegex = /^\[(\S+)\]$/

    const content: StringObject = {}

    for (let card of board.cards) {
      let match = contentRegex.exec(card.name)
      if (!match) continue
      content[match[1]] = card.desc
    }

    return content
  }
}
