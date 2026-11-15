export interface TagSummary {
  name: string
  count: number
  total: number
  firstDate: string
  lastDate: string
}

export type GroupBy = "classification" | "tag"
