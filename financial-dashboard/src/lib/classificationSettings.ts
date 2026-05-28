import { ClassificationRuleRow, ClassificationSettings } from "@/types/ClassificationSettings"

export const defaultClassificationCategories = [
  "Quick Commerce",
  "Ecommerce",
  "Subscriptions",
  "Public Transport",
  "Office Lunch",
  "Grocery",
  "Eating Out",
  "Personal Transfer",
  "Fuel",
  "Personal Contact",
  "Entertainment",
  "Healthcare",
  "Shopping",
  "Utilities",
  "Other",
]

export const defaultClassificationRulesText = `1. If there is no receiver, classify it as Personal Contact.
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

const defaultClassificationRuleTemplates = [
  { condition: "there is no receiver", classification: "Personal Contact" },
  { condition: "the receiver is Blinkit or Zepto", classification: "Quick Commerce" },
  { condition: "the receiver is Amazon or Flipkart", classification: "Ecommerce" },
  { condition: "the receiver is Spotify, Netflix, Hotstar, or Google Play", classification: "Subscriptions" },
  {
    condition: "the receiver has BMTC BUS or Bangalore Metro Rail Corporation Ltd",
    classification: "Public Transport",
  },
  { condition: "the receiver is Hungerbox", classification: "Office Lunch" },
  {
    condition: "the receiver has super market, supermarket, store, or mart in its name",
    classification: "Grocery",
  },
  {
    condition: "the receiver is a restaurant, food chain, or includes Zomato",
    classification: "Eating Out",
  },
  { condition: "the receiver is just a person's name", classification: "Personal Transfer" },
  { condition: "the receiver has Fuel in its name", classification: "Fuel" },
]

function dedupeCategories(categories: string[]) {
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

export function getDefaultClassificationSettings(): ClassificationSettings {
  return {
    categories: [...defaultClassificationCategories],
    rulesText: defaultClassificationRulesText,
    usesDefault: true,
    updatedAt: null,
  }
}

export function normalizeClassificationSettings(payload: unknown): ClassificationSettings {
  if (!payload || typeof payload !== "object") {
    return getDefaultClassificationSettings()
  }

  const candidate = payload as Partial<ClassificationSettings>
  if (!Array.isArray(candidate.categories) || typeof candidate.rulesText !== "string") {
    return getDefaultClassificationSettings()
  }

  const categories = dedupeCategories(
    candidate.categories.filter((value): value is string => typeof value === "string")
  )
  const rulesText = candidate.rulesText.trim()

  if (categories.length === 0 || !rulesText) {
    return getDefaultClassificationSettings()
  }

  return {
    categories,
    rulesText,
    usesDefault: Boolean(candidate.usesDefault),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
  }
}

export function categoriesToEditorText(categories: string[]) {
  return categories.join("\n")
}

export function categoriesFromEditorText(value: string) {
  return dedupeCategories(value.split("\n"))
}

function createRuleId() {
  return `rule-${Math.random().toString(36).slice(2, 10)}`
}

function createRuleRow(condition = "", classification = ""): ClassificationRuleRow {
  return {
    id: createRuleId(),
    condition,
    classification,
  }
}

export function getDefaultClassificationRuleRows(): ClassificationRuleRow[] {
  return defaultClassificationRuleTemplates.map((rule) => createRuleRow(rule.condition, rule.classification))
}

export function createEmptyClassificationRuleRow(): ClassificationRuleRow {
  return createRuleRow()
}

function normalizeSentenceValue(value: string) {
  return value.trim().replace(/\.$/, "")
}

export function parseClassificationRulesText(rulesText: string): ClassificationRuleRow[] {
  const lines = rulesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const rows = lines.flatMap((line) => {
    const withoutNumber = line.replace(/^\d+\.\s*/, "").trim()
    if (!withoutNumber) {
      return []
    }

    if (/^otherwise\b/i.test(withoutNumber)) {
      return []
    }

    const standardMatch = withoutNumber.match(/^if\s+(.+?),\s*classify(?:\s+it)?\s+as\s+(.+?)\.?$/i)
    if (standardMatch) {
      return [createRuleRow(normalizeSentenceValue(standardMatch[1]), normalizeSentenceValue(standardMatch[2]))]
    }

    const looseMatch = withoutNumber.match(/^if\s+(.+?)\s+classify(?:\s+it)?\s+as\s+(.+?)\.?$/i)
    if (looseMatch) {
      return [createRuleRow(normalizeSentenceValue(looseMatch[1]), normalizeSentenceValue(looseMatch[2]))]
    }

    const fallbackMatch = withoutNumber.match(/^(.+?)\s*=>\s*(.+)$/)
    if (fallbackMatch) {
      return [createRuleRow(normalizeSentenceValue(fallbackMatch[1]), normalizeSentenceValue(fallbackMatch[2]))]
    }

    return [createRuleRow(normalizeSentenceValue(withoutNumber), "")]
  })

  return rows.length > 0 ? rows : getDefaultClassificationRuleRows()
}

export function buildClassificationRulesText(rows: ClassificationRuleRow[]): string {
  const completeRows = rows.filter((row) => row.condition.trim() && row.classification.trim())

  const numberedRules = completeRows.map((row, index) => {
    const condition = normalizeSentenceValue(row.condition)
    const classification = normalizeSentenceValue(row.classification)
    return `${index + 1}. If ${condition}, classify it as ${classification}.`
  })

  numberedRules.push(
    `${numberedRules.length + 1}. Otherwise classify intelligently based on the merchant name.`
  )

  return numberedRules.join("\n")
}
