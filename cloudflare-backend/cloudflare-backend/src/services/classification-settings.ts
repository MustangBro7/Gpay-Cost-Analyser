import { ClassificationSettings, ClassificationSettingsRecord, UpdateClassificationSettingsRequest } from '../types'
import { HttpError } from '../utils/http'

export const DEFAULT_CLASSIFICATION_CATEGORIES = [
  'Quick Commerce',
  'Ecommerce',
  'Subscriptions',
  'Public Transport',
  'Office Lunch',
  'Grocery',
  'Eating Out',
  'Personal Transfer',
  'Fuel',
  'Personal Contact',
  'Entertainment',
  'Healthcare',
  'Shopping',
  'Utilities',
  'Other',
]

export const DEFAULT_CLASSIFICATION_RULES_TEXT = `1. If there is no receiver, classify it as Personal Contact.
2. If the receiver is Blinkit or Zepto, classify it as Quick Commerce.
3. If the receiver is Amazon or Flipkart, classify it as Ecommerce.
4. If the receiver is Spotify, Netflix, Hotstar, or Google Play, classify it as Subscriptions.
5. If the receiver has BMTC BUS or Bangalore Metro Rail Corporation Ltd, classify it as Public Transport.
6. If the receiver is Hungerbox, classify it as Office Lunch.
7. If the receiver has super market, supermarket, store, or mart in its name, classify it as Grocery.
8. If the receiver is a restaurant, food chain, or includes Zomato, classify it as Eating Out.
9. If the receiver is just a person's name, classify it as Personal Transfer.
10. If the receiver has Fuel in its name, classify it as Fuel.
11. Otherwise classify intelligently based on the merchant name.`

export const MAX_CLASSIFICATION_CATEGORIES = 100
export const MAX_CLASSIFICATION_RULES_TEXT_LENGTH = 10_000

export function hasDefaultClassificationSettingsContent(categories: string[], rulesText: string): boolean {
  if (rulesText.trim() !== DEFAULT_CLASSIFICATION_RULES_TEXT) {
    return false
  }

  if (categories.length !== DEFAULT_CLASSIFICATION_CATEGORIES.length) {
    return false
  }

  return categories.every((category, index) => category === DEFAULT_CLASSIFICATION_CATEGORIES[index])
}

function dedupeCategories(categories: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const category of categories) {
    const normalized = category.trim()
    if (!normalized) {
      continue
    }

    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(normalized)
  }

  return deduped
}

function parseStoredCategories(categoriesJson: string): string[] | null {
  try {
    const parsed = JSON.parse(categoriesJson) as unknown
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string')) {
      return null
    }

    const categories = dedupeCategories(parsed)
    return categories.length > 0 ? categories : null
  } catch {
    return null
  }
}

export function serializeCategories(categories: string[]): string {
  return JSON.stringify(categories)
}

export function getDefaultClassificationSettings(): ClassificationSettings {
  return {
    categories: [...DEFAULT_CLASSIFICATION_CATEGORIES],
    rulesText: DEFAULT_CLASSIFICATION_RULES_TEXT,
    usesDefault: true,
    updatedAt: null,
  }
}

export function resolveClassificationSettings(record: ClassificationSettingsRecord | null): ClassificationSettings {
  if (!record) {
    return getDefaultClassificationSettings()
  }

  const categories = parseStoredCategories(record.categories_json)
  const rulesText = record.rules_text.trim()

  if (!categories || !rulesText) {
    return getDefaultClassificationSettings()
  }

  const usesDefault = hasDefaultClassificationSettingsContent(categories, rulesText)

  return {
    categories,
    rulesText,
    usesDefault,
    updatedAt: record.updated_at,
  }
}

export function normalizeClassificationSettingsInput(payload: UpdateClassificationSettingsRequest): {
  categories: string[]
  rulesText: string
} {
  if (!payload || typeof payload !== 'object') {
    throw new HttpError(400, 'Invalid classification settings payload.')
  }

  if (!Array.isArray(payload.categories)) {
    throw new HttpError(400, 'categories must be an array of strings.')
  }

  if (payload.categories.some((value) => typeof value !== 'string')) {
    throw new HttpError(400, 'categories must contain only strings.')
  }

  if (typeof payload.rulesText !== 'string') {
    throw new HttpError(400, 'rulesText must be a string.')
  }

  const categories = dedupeCategories(payload.categories)
  if (categories.length === 0) {
    throw new HttpError(400, 'At least one category is required.')
  }

  if (categories.length > MAX_CLASSIFICATION_CATEGORIES) {
    throw new HttpError(400, `A maximum of ${MAX_CLASSIFICATION_CATEGORIES} categories is allowed.`)
  }

  const rulesText = payload.rulesText.trim()
  if (!rulesText) {
    throw new HttpError(400, 'rulesText cannot be empty.')
  }

  if (rulesText.length > MAX_CLASSIFICATION_RULES_TEXT_LENGTH) {
    throw new HttpError(400, `rulesText cannot exceed ${MAX_CLASSIFICATION_RULES_TEXT_LENGTH} characters.`)
  }

  return {
    categories,
    rulesText,
  }
}
