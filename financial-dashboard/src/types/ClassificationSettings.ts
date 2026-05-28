export interface ClassificationSettings {
  categories: string[]
  rulesText: string
  usesDefault: boolean
  updatedAt: string | null
}

export interface ClassificationRuleRow {
  id: string
  condition: string
  classification: string
}

export interface UpdateClassificationSettingsRequest {
  categories: string[]
  rulesText: string
}
