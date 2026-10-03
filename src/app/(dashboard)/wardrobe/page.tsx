"use client"

import { useEffect, useRef } from "react"
import { sileo } from "sileo"
import { useTranslation } from "@/lib/i18n"
import { WardrobeGrid } from "@/components/wardrobe/wardrobe-grid"
import {
  useWardrobe,
  useCreateWardrobe,
  useUpdateWardrobe,
  useDeleteWardrobe,
  useGenerateWardrobe3D,
} from "@/hooks/use-wardrobe"

export default function WardrobePage() {
  const { t } = useTranslation()
  const { data: items = [], isLoading: loading } = useWardrobe()
  const createItem = useCreateWardrobe()
  const updateItem = useUpdateWardrobe()
  const deleteItem = useDeleteWardrobe()
  const generate3D = useGenerateWardrobe3D()
  const notifiedFailedRef = useRef<Set<string>>(new Set())

  // Avisa cuando la generación automática falla (via polling)
  useEffect(() => {
    if (!items.length) return
    for (const item of items) {
      if (item.model3dStatus !== "failed") continue
      if (notifiedFailedRef.current.has(item.id)) continue
      notifiedFailedRef.current.add(item.id)
      sileo.error({
        title: item.model3dError || t("wardrobe.model3dFailed"),
      })
    }
  }, [items, t])

  return (
    <main className="pt-16">
      {loading ? (
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="w-8 h-8 border border-[#C9B99A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <WardrobeGrid
          items={items}
          onAdd={(item) => createItem.mutate(item)}
          onUpdate={(id, updates) => updateItem.mutate({ id, updates })}
          onDelete={(id) => deleteItem.mutate(id)}
          onGenerate3D={(id) => generate3D.mutate(id)}
        />
      )}
    </main>
  )
}
