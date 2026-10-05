"use client"

import { WardrobeGrid } from "@/components/wardrobe/wardrobe-grid"
import {
  useWardrobe,
  useCreateWardrobe,
  useUpdateWardrobe,
  useDeleteWardrobe,
} from "@/hooks/use-wardrobe"

export default function WardrobePage() {
  const { data: items = [], isLoading: loading } = useWardrobe()
  const createItem = useCreateWardrobe()
  const updateItem = useUpdateWardrobe()
  const deleteItem = useDeleteWardrobe()

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
        />
      )}
    </main>
  )
}
