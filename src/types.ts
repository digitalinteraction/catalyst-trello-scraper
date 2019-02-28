export type TagRelation = {
  name: string
  type: 'need' | 'category' | 'theme' | string
}

export type BrowsingMode = {
  id: string
  name: string
  projects: Project[]
}

export type TrelloBoard = {
  id: string
  name: string
  cards: TrelloCard[]
  labels: TrelloLabel[]
}

export type TrelloCard = {
  id: string
  name: string
  idList: string
  desc: string
  dateLastActivity: string
  descData: { emoji: { [idx: string]: string } }
  idLabels: string[]
}

export type TrelloLabel = {
  id: string
  idBoard: string
  name: string
  color: string
}

export type Project = TrelloCard & {
  dateCreated: Date
  needs: TagRelation[]
  themes: TagRelation[]
  category: TagRelation | null
}

export type StringObject = { [idx: string]: string }
