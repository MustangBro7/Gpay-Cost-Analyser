"use client"

import * as React from "react"
import {
  GripVertical,
  ListFilter,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  TextCursorInput,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  buildClassificationRulesText,
  categoriesFromEditorText,
  categoriesToEditorText,
  createEmptyClassificationRuleRow,
  getDefaultClassificationSettings,
  getDefaultClassificationRuleRows,
  parseClassificationRulesText,
} from "@/lib/classificationSettings"
import {
  ClassificationRuleRow,
  ClassificationSettings,
  UpdateClassificationSettingsRequest,
} from "@/types/ClassificationSettings"

interface ClassificationSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: ClassificationSettings
  onSave: (payload: UpdateClassificationSettingsRequest) => Promise<void>
}

export function ClassificationSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: ClassificationSettingsDialogProps) {
  const [categoriesText, setCategoriesText] = React.useState("")
  const [ruleRows, setRuleRows] = React.useState<ClassificationRuleRow[]>([])
  const [isSaving, setIsSaving] = React.useState(false)
  const dialogContentRef = React.useRef<HTMLDivElement>(null)
  const dialogBodyScrollContainerRef = React.useRef<HTMLDivElement>(null)
  const ruleRowRefs = React.useRef(new Map<string, HTMLDivElement>())
  const rulesScrollContainerRef = React.useRef<HTMLDivElement>(null)
  const dragStateRef = React.useRef<{
    id: string
    currentClientY: number
    targetIndex: number
  } | null>(null)
  const [dragState, setDragState] = React.useState<{
    id: string
    startClientY: number
    currentClientY: number
    offsetY: number
    height: number
    width: number
    left: number
    top: number
    sourceIndex: number
    targetIndex: number
  } | null>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }

    setCategoriesText(categoriesToEditorText(settings.categories))
    setRuleRows(parseClassificationRulesText(settings.rulesText))
  }, [open, settings])

  const defaultSettings = React.useMemo(() => getDefaultClassificationSettings(), [])
  const categoryCount = React.useMemo(() => categoriesFromEditorText(categoriesText).length, [categoriesText])
  const rulesLineCount = React.useMemo(
    () => ruleRows.filter((row) => row.condition.trim() && row.classification.trim()).length,
    [ruleRows]
  )
  const activeDragRule = React.useMemo(
    () => (dragState ? ruleRows.find((row) => row.id === dragState.id) ?? null : null),
    [dragState, ruleRows]
  )
  const nonDraggedRuleRows = React.useMemo(
    () => (dragState ? ruleRows.filter((row) => row.id !== dragState.id) : ruleRows),
    [dragState, ruleRows]
  )

  const reorderRuleRows = React.useCallback((rows: ClassificationRuleRow[], sourceId: string, targetIndex: number) => {
    const sourceIndex = rows.findIndex((row) => row.id === sourceId)
    if (sourceIndex === -1) {
      return rows
    }

    const withoutSource = rows.filter((row) => row.id !== sourceId)
    const clampedTargetIndex = Math.max(0, Math.min(targetIndex, withoutSource.length))
    const sourceRow = rows[sourceIndex]
    const nextRows = [...withoutSource]
    nextRows.splice(clampedTargetIndex, 0, sourceRow)
    return nextRows
  }, [])

  const findTargetIndex = React.useCallback(
    (clientY: number, draggingId: string) => {
      const remainingRows = ruleRows.filter((row) => row.id !== draggingId)

      for (let index = 0; index < remainingRows.length; index += 1) {
        const row = remainingRows[index]
        const element = ruleRowRefs.current.get(row.id)
        if (!element) {
          continue
        }

        const rect = element.getBoundingClientRect()
        if (clientY < rect.top + rect.height / 2) {
          return index
        }
      }

      return remainingRows.length
    },
    [ruleRows]
  )

  const stopDragging = React.useCallback(() => {
    dragStateRef.current = null
    setDragState(null)
    document.body.style.userSelect = ""
  }, [])

  const commitDrag = React.useCallback(() => {
    setDragState((currentState) => {
      if (!currentState) {
        return null
      }

      dragStateRef.current = null
      setRuleRows((currentRows) =>
        reorderRuleRows(currentRows, currentState.id, currentState.targetIndex)
      )

      return null
    })
    document.body.style.userSelect = ""
  }, [reorderRuleRows])

  const handleRulePointerMove = React.useCallback((event: PointerEvent) => {
    setDragState((currentState) => {
      if (!currentState) {
        return null
      }

      const nextTargetIndex = findTargetIndex(event.clientY, currentState.id)
      dragStateRef.current = {
        id: currentState.id,
        currentClientY: event.clientY,
        targetIndex: nextTargetIndex,
      }

      return {
        ...currentState,
        currentClientY: event.clientY,
        targetIndex: nextTargetIndex,
      }
    })
  }, [findTargetIndex])

  const handleRulePointerUp = React.useCallback(() => {
    commitDrag()
  }, [commitDrag])

  const scrollContainerBy = React.useCallback((container: HTMLDivElement | null, delta: number) => {
    if (!container || delta === 0) {
      return false
    }

    const previousScrollTop = container.scrollTop
    container.scrollTop += delta
    return container.scrollTop !== previousScrollTop
  }, [])

  React.useEffect(() => {
    if (!dragState) {
      return
    }

    window.addEventListener("pointermove", handleRulePointerMove)
    window.addEventListener("pointerup", handleRulePointerUp)
    window.addEventListener("pointercancel", stopDragging)

    return () => {
      window.removeEventListener("pointermove", handleRulePointerMove)
      window.removeEventListener("pointerup", handleRulePointerUp)
      window.removeEventListener("pointercancel", stopDragging)
    }
  }, [dragState, handleRulePointerMove, handleRulePointerUp, stopDragging])

  React.useEffect(() => {
    if (!dragState) {
      return
    }

    let frameId = 0

    const tick = () => {
      const currentDrag = dragStateRef.current

      if (currentDrag) {
        const dialogRect = dialogContentRef.current?.getBoundingClientRect()
        const triggerRect = dialogRect ?? rulesScrollContainerRef.current?.getBoundingClientRect()

        if (!triggerRect) {
          frameId = window.requestAnimationFrame(tick)
          return
        }

        const threshold = 120
        const pointerY = currentDrag.currentClientY
        let scrollDelta = 0

        if (pointerY < triggerRect.top + threshold) {
          const distance = triggerRect.top + threshold - pointerY
          scrollDelta = -Math.max(12, Math.min(36, distance / 2.4))
        } else if (pointerY > triggerRect.bottom - threshold) {
          const distance = pointerY - (triggerRect.bottom - threshold)
          scrollDelta = Math.max(12, Math.min(36, distance / 2.4))
        }

        if (scrollDelta !== 0) {
          const scrollTargets = [
            rulesScrollContainerRef.current,
            dialogBodyScrollContainerRef.current,
          ]

          const didScroll = scrollTargets.some((container) => scrollContainerBy(container, scrollDelta))

          if (didScroll) {
            const nextTargetIndex = findTargetIndex(currentDrag.currentClientY, currentDrag.id)
            dragStateRef.current = {
              ...currentDrag,
              targetIndex: nextTargetIndex,
            }
            setDragState((currentState) =>
              currentState
                ? {
                    ...currentState,
                    targetIndex: nextTargetIndex,
                  }
                : null
            )
          }
        }
      }

      frameId = window.requestAnimationFrame(tick)
    }

    frameId = window.requestAnimationFrame(tick)

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [dragState, findTargetIndex, scrollContainerBy])

  const handleReset = React.useCallback(() => {
    setCategoriesText(categoriesToEditorText(defaultSettings.categories))
    setRuleRows(getDefaultClassificationRuleRows())
  }, [defaultSettings.categories])

  const updateRuleRow = React.useCallback(
    (id: string, field: "condition" | "classification", value: string) => {
      setRuleRows((currentRows) =>
        currentRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
      )
    },
    []
  )

  const handleRulePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, ruleId: string) => {
      if (event.button !== 0 && event.pointerType !== "touch") {
        return
      }

      const cardElement = ruleRowRefs.current.get(ruleId)
      if (!cardElement) {
        return
      }

      event.preventDefault()

      const rect = cardElement.getBoundingClientRect()
      const dialogRect = dialogContentRef.current?.getBoundingClientRect()
      const sourceIndex = ruleRows.findIndex((row) => row.id === ruleId)
      const targetIndex = Math.max(0, sourceIndex)

      document.body.style.userSelect = "none"
      setDragState({
        id: ruleId,
        startClientY: event.clientY,
        currentClientY: event.clientY,
        offsetY: event.clientY - rect.top,
        height: rect.height,
        width: rect.width,
        left: rect.left - (dialogRect?.left ?? 0),
        top: rect.top - (dialogRect?.top ?? 0),
        sourceIndex,
        targetIndex,
      })
      dragStateRef.current = {
        id: ruleId,
        currentClientY: event.clientY,
        targetIndex,
      }
    },
    [ruleRows]
  )

  const removeRuleRow = React.useCallback((id: string) => {
    setRuleRows((currentRows) => {
      if (currentRows.length === 1) {
        return [createEmptyClassificationRuleRow()]
      }

      return currentRows.filter((row) => row.id !== id)
    })
  }, [])

  const addRuleRow = React.useCallback(() => {
    setRuleRows((currentRows) => [...currentRows, createEmptyClassificationRuleRow()])
  }, [])

  const handleSave = React.useCallback(async () => {
    const categories = categoriesFromEditorText(categoriesText)
    const completeRuleRows = ruleRows.filter((row) => row.condition.trim() && row.classification.trim())
    const hasPartialRule = ruleRows.some(
      (row) =>
        (row.condition.trim() && !row.classification.trim()) ||
        (!row.condition.trim() && row.classification.trim())
    )

    if (categories.length === 0) {
      toast.error("Add at least one category")
      return
    }

    if (hasPartialRule) {
      toast.error("Each rule needs both a condition and a classification")
      return
    }

    if (completeRuleRows.length === 0) {
      toast.error("Add at least one classification rule")
      return
    }

    const nextRulesText = buildClassificationRulesText(completeRuleRows)

    setIsSaving(true)
    try {
      await onSave({
        categories,
        rulesText: nextRulesText,
      })
      toast.success("Classification rules saved")
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save classification rules:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save classification rules")
    } finally {
      setIsSaving(false)
    }
  }, [categoriesText, onOpenChange, onSave, ruleRows])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogContentRef}
        showCloseButton={false}
        className="left-0 top-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-background/98 p-0 shadow-2xl ring-0 supports-backdrop-filter:backdrop-blur-xl sm:left-1/2 sm:top-1/2 sm:h-[92vh] sm:max-h-[92vh] sm:w-[min(94vw,88rem)] sm:max-w-[min(94vw,88rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] sm:border sm:border-border/70 sm:bg-background/96 sm:ring-1 sm:ring-white/8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_26%),radial-gradient(circle_at_76%_20%,color-mix(in_oklch,var(--chart-2)_14%,transparent),transparent_22%),linear-gradient(180deg,color-mix(in_oklch,var(--background)_92%,transparent),color-mix(in_oklch,var(--background)_98%,transparent))]" />

        <div className="relative grid h-full min-h-0 grid-rows-[auto_1fr_auto]">
          <div className="border-b border-border/60 px-5 py-5 sm:px-8 sm:py-7">
            <div className="flex items-start justify-between gap-4">
              <DialogHeader className="gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    <Sparkles className="mr-1 size-3.5" />
                    Per-user classifier
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">
                    {settings.usesDefault ? "Using defaults" : "Custom rules saved"}
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">
                    {categoryCount} categories
                  </Badge>
                </div>

                <div className="space-y-3">
                  <DialogTitle className="text-3xl font-semibold tracking-tight sm:text-4xl">
                    Classification rules
                  </DialogTitle>
                  <DialogDescription className="max-w-3xl text-sm leading-6 sm:text-base">
                    Edit the category set and the guidance used for future AI classifications. This
                    changes incoming classification behavior only; it does not reprocess existing
                    transactions.
                  </DialogDescription>
                </div>
              </DialogHeader>

              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="mt-0.5 shrink-0 rounded-full border border-border/70 bg-background/70"
                >
                  <X className="size-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>
            </div>
          </div>

          <div ref={dialogBodyScrollContainerRef} className="min-h-0 overflow-auto px-4 py-4 sm:px-8 sm:py-6">
            <div className="grid min-h-full gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
              <section className="flex min-h-[20rem] flex-col overflow-hidden rounded-[1.6rem] border border-border/70 bg-card/72 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.45)]">
                <div className="border-b border-border/60 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground">
                      <ListFilter className="size-4" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">Categories</h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        One category per line. These appear as suggestions in add and reclassify.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 px-5 py-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Count
                      </div>
                      <div className="mt-1 text-2xl font-semibold">{categoryCount}</div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        Mode
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {settings.usesDefault ? "Default rules" : "Custom rules"}
                      </div>
                    </div>
                  </div>

                  <Textarea
                    value={categoriesText}
                    onChange={(event) => setCategoriesText(event.target.value)}
                    placeholder={"Quick Commerce\nEcommerce\nFuel"}
                    className="min-h-[20rem] resize-none rounded-[1.35rem] border-border/70 bg-background/80 px-4 py-4 font-medium leading-7 shadow-inner sm:min-h-[24rem] lg:min-h-[30rem]"
                  />
                </div>
              </section>

              <section className="flex min-h-[24rem] flex-col overflow-hidden rounded-[1.6rem] border border-border/70 bg-card/72 shadow-[0_20px_60px_-28px_rgba(0,0,0,0.45)]">
                <div className="border-b border-border/60 px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full border border-border/70 bg-background/80 p-2 text-muted-foreground">
                        <TextCursorInput className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold">Classification guidance</h3>
                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                          Keep the instructions explicit. The extraction wrapper stays fixed in code;
                          only the guidance below is user-editable.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:min-w-64">
                      <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Rule lines
                        </div>
                        <div className="mt-1 text-xl font-semibold">{rulesLineCount}</div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Affects
                        </div>
                        <div className="mt-1 text-sm font-medium">Future ingestion</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col px-5 py-5">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {settings.categories.slice(0, 5).map((category) => (
                      <Badge key={category} variant="outline" className="rounded-full bg-background/70 px-3 py-1 text-muted-foreground">
                        {category}
                      </Badge>
                    ))}
                    {settings.categories.length > 5 ? (
                      <Badge variant="outline" className="rounded-full bg-background/70 px-3 py-1 text-muted-foreground">
                        +{settings.categories.length - 5} more
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex min-h-[24rem] flex-1 flex-col overflow-hidden rounded-[1.35rem] border border-border/70 bg-background/82 shadow-inner sm:min-h-[28rem] lg:min-h-[34rem]">
                    <div className="border-b border-border/60 px-4 py-3 text-sm text-muted-foreground">
                      Drag a rule card by its grip to reorder it. Higher rules run first. Anything unmatched still falls back to intelligent classification.
                    </div>

                    <div ref={rulesScrollContainerRef} className="min-h-0 flex-1 overflow-auto px-3 py-3">
                      <div className="space-y-3">
                        {nonDraggedRuleRows.map((row, index) => (
                          <React.Fragment key={row.id}>
                            {dragState && dragState.targetIndex === index ? (
                              <div
                                className="rounded-2xl border border-dashed border-primary/45 bg-primary/7 transition-all"
                                style={{ height: dragState.height }}
                              />
                            ) : null}

                            <div
                              ref={(element) => {
                                if (element) {
                                  ruleRowRefs.current.set(row.id, element)
                                } else {
                                  ruleRowRefs.current.delete(row.id)
                                }
                              }}
                              className="rounded-2xl border border-border/70 bg-card/55 p-3 transition-all sm:p-4"
                            >
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
                                <div className="flex items-center gap-3 xl:w-16 xl:flex-col xl:items-start">
                                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/80 text-sm font-semibold">
                                    {dragState ? index + (dragState.targetIndex <= index ? 2 : 1) : index + 1}
                                  </div>
                                  <button
                                    type="button"
                                    aria-label={`Drag rule ${dragState ? index + 1 : index + 1} to reorder`}
                                    onPointerDown={(event) => handleRulePointerDown(event, row.id)}
                                    className="cursor-grab touch-none rounded-full border border-border/70 bg-background/75 p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground active:cursor-grabbing"
                                  >
                                    <GripVertical className="size-4" />
                                  </button>
                                </div>

                                <div className="grid flex-1 gap-3">
                                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(14rem,0.9fr)]">
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                        If
                                      </label>
                                      <Input
                                        value={row.condition}
                                        onChange={(event) => updateRuleRow(row.id, "condition", event.target.value)}
                                        placeholder="the receiver is Blinkit or Zepto"
                                        className="h-12 rounded-xl border-border/70 bg-background/80 px-4"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                        Classify as
                                      </label>
                                      <Input
                                        value={row.classification}
                                        onChange={(event) => updateRuleRow(row.id, "classification", event.target.value)}
                                        placeholder="Quick Commerce"
                                        className="h-12 rounded-xl border-border/70 bg-background/80 px-4"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                      Drag the card with the grip to reorder
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeRuleRow(row.id)}
                                      className="rounded-full text-muted-foreground"
                                    >
                                      <Trash2 className="size-4" />
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        ))}

                        {dragState && dragState.targetIndex === nonDraggedRuleRows.length ? (
                          <div
                            className="rounded-2xl border border-dashed border-primary/45 bg-primary/7 transition-all"
                            style={{ height: dragState.height }}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="border-t border-border/60 px-4 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addRuleRow}
                        className="h-11 rounded-full"
                      >
                        <Plus className="size-4" />
                        Add rule
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {dragState && activeDragRule ? (
            <div
              className="pointer-events-none absolute z-[60]"
              style={{
                left: dragState.left,
                top: dragState.top + (dragState.currentClientY - dragState.startClientY),
                width: dragState.width,
              }}
            >
              <div className="rounded-2xl border border-primary/45 bg-card/96 p-3 shadow-[0_28px_80px_-30px_rgba(0,0,0,0.6)] ring-2 ring-primary/22 sm:p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
                  <div className="flex items-center gap-3 xl:w-16 xl:flex-col xl:items-start">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/85 text-sm font-semibold">
                      {dragState.targetIndex + 1}
                    </div>
                    <div className="rounded-full border border-border/70 bg-background/75 p-1.5 text-foreground">
                      <GripVertical className="size-4" />
                    </div>
                  </div>

                  <div className="grid flex-1 gap-3">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(14rem,0.9fr)]">
                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          If
                        </label>
                        <div className="flex min-h-12 items-center rounded-xl border border-border/70 bg-background/80 px-4 text-sm">
                          {activeDragRule.condition || "Empty condition"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Classify as
                        </label>
                        <div className="flex min-h-12 items-center rounded-xl border border-border/70 bg-background/80 px-4 text-sm">
                          {activeDragRule.classification || "Empty classification"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Release to drop in this position
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="border-t border-border/60 px-5 py-4 sm:px-8 sm:py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Applies to future incoming classifications only. Manual add and reclassify will use
                your saved category list as suggestions.
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSaving}
                  className="h-11 rounded-full border-border/70 bg-background/70 px-5"
                >
                  <RotateCcw className="size-4" />
                  Reset to default
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-11 rounded-full px-6"
                >
                  <Save className="size-4" />
                  {isSaving ? "Saving..." : "Save rules"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
