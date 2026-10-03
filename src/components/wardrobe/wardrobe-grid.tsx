"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { WardrobeCard } from "./wardrobe-card"
import { WardrobeForm } from "./wardrobe-form"
import { WARDROBE_CATEGORIES } from "@/lib/constants"
import { useTranslation } from "@/lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { WardrobeItem, WardrobeInput } from "@/hooks/use-wardrobe"

interface WardrobeGridProps {
  items: WardrobeItem[]
  onAdd: (item: WardrobeInput) => void
  onUpdate: (id: string, item: Partial<WardrobeInput>) => void
  onDelete: (id: string) => void
  onGenerate3D?: (id: string) => void
}

export function WardrobeGrid({
  items,
  onAdd,
  onUpdate,
  onDelete,
  onGenerate3D,
}: WardrobeGridProps) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null)
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")

  const filteredItems = items.filter((item) => {
    const name = item.name ?? ""
    const color = item.color ?? ""
    const brand = item.brand ?? ""
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      color.toLowerCase().includes(search.toLowerCase()) ||
      brand.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      filterCategory === "all" || item.category === filterCategory
    return matchesSearch && matchesCategory
  })

  const handleEdit = (item: WardrobeItem) => {
    setEditingItem(item)
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditingItem(null)
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12">
      {/* Header - Editorial Style */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-3">
            Your Collection
          </p>
          <h1 className="font-editorial text-5xl md:text-6xl font-light">
            {t("wardrobe.title")}
          </h1>
          <p className="text-sm text-[#6B6B6B] mt-3">
            {t("wardrobe.subtitle", { count: items.length, plural: items.length !== 1 ? "s" : "" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start">
          <button
            onClick={() => setShowForm(true)}
            className="btn-fashion inline-flex items-center gap-3"
          >
            <Plus className="w-4 h-4" />
            {t("wardrobe.add")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-12 pb-8 border-b border-[#E0D9CF]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B] pointer-events-none" />
          <input
            type="text"
            placeholder={t("wardrobe.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-elegant w-full !pl-12"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t("wardrobe.filter")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("wardrobe.filter")}</SelectItem>
            {WARDROBE_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {t(`categories.${cat.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-[#6B6B6B] mb-6">
            {items.length === 0
              ? t("wardrobe.empty")
              : t("wardrobe.emptyFiltered")}
          </p>
          {items.length === 0 && (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => setShowForm(true)}
                className="text-[11px] tracking-[0.15em] uppercase font-medium border-b border-[#1A1A1A] pb-1 hover:opacity-60 transition-opacity"
              >
                {t("wardrobe.add")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredItems.map((item, index) => (
            <WardrobeCard
              key={item.id}
              item={item}
              priority={index < 4}
              onEdit={() => handleEdit(item)}
              onDelete={() => onDelete(item.id)}
              onGenerate3D={
                onGenerate3D ? () => onGenerate3D(item.id) : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <WardrobeForm
          item={editingItem}
          onClose={handleClose}
          onSubmit={(data) => {
            if (editingItem) {
              onUpdate(editingItem.id, data)
            } else {
              onAdd(data as WardrobeInput)
            }
            handleClose()
          }}
        />
      )}
    </div>
  )
}
