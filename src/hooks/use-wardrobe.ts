"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sileo } from "sileo"
import { useTranslation } from "@/lib/i18n"

export type WardrobeItem = {
  id: string
  name: string
  category: string
  color: string
  material?: string
  brand?: string
  season?: string
  imageUrl: string
  modelUrl?: string | null
  model3dStatus?: string | null
  model3dError?: string | null
}

export type WardrobeInput = Omit<WardrobeItem, "id" | "modelUrl" | "model3dStatus">

function normalizeWardrobeItem(raw: unknown): WardrobeItem | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Partial<WardrobeItem>
  if (!item.id || !item.imageUrl) return null
  return {
    id: item.id,
    name: item.name ?? "",
    category: item.category ?? "",
    color: item.color ?? "",
    material: item.material ?? undefined,
    brand: item.brand ?? undefined,
    season: item.season ?? undefined,
    imageUrl: item.imageUrl,
    modelUrl: item.modelUrl ?? null,
    model3dStatus: item.model3dStatus ?? null,
    model3dError: item.model3dError ?? null,
  }
}

async function fetchWardrobe(): Promise<WardrobeItem[]> {
  const res = await fetch("/api/wardrobe")
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || "Error al obtener el wardrobe")
  if (!Array.isArray(data)) {
    throw new Error("Respuesta inválida del servidor")
  }
  return data
    .map(normalizeWardrobeItem)
    .filter((item): item is WardrobeItem => item !== null)
}

export function useWardrobe() {
  return useQuery<WardrobeItem[]>({
    queryKey: ["wardrobe"],
    queryFn: fetchWardrobe,
    refetchInterval: (query) => {
      const items = query.state.data ?? []
      return items.some((item) => item.model3dStatus === "generating")
        ? 5000
        : false
    },
  })
}

export function useCreateWardrobe() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async (input: WardrobeInput) => {
      const res = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Error al crear la prenda")
      const created = normalizeWardrobeItem(data)
      if (!created) throw new Error("Respuesta inválida del servidor")
      return created
    },
    onSuccess: (created) => {
      queryClient.setQueryData<WardrobeItem[]>(["wardrobe"], (old) => [
        created,
        ...(old ?? []),
      ])
      sileo.success({ title: t("wardrobe.model3dGenerating") })
    },
    onError: (error) => {
      sileo.error({
        title:
          error instanceof Error ? error.message : "Error al crear la prenda",
      })
    },
  })
}

export function useUpdateWardrobe() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<WardrobeInput>
    }) => {
      const res = await fetch(`/api/wardrobe/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(data?.error || "Error al actualizar la prenda")
      const updated = normalizeWardrobeItem(data)
      if (!updated) throw new Error("Respuesta inválida del servidor")
      return updated
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<WardrobeItem[]>(["wardrobe"], (old) =>
        (old ?? []).map((item) => (item.id === updated.id ? updated : item)),
      )
      if (updated.model3dStatus === "generating") {
        sileo.success({ title: t("wardrobe.model3dGenerating") })
      }
    },
    onError: (error) => {
      sileo.error({
        title:
          error instanceof Error ? error.message : "Error al actualizar la prenda",
      })
    },
  })
}

export function useDeleteWardrobe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wardrobe/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al eliminar la prenda")
      return id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<WardrobeItem[]>(["wardrobe"], (old) =>
        (old ?? []).filter((item) => item.id !== id),
      )
    },
    onError: (error) => {
      sileo.error({
        title:
          error instanceof Error ? error.message : "Error al eliminar la prenda",
      })
    },
  })
}

export function useGenerateWardrobe3D() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/wardrobe/${id}/generate-3d`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(data?.error || "Error al generar modelo 3D")
      const updated = normalizeWardrobeItem(data)
      if (!updated) throw new Error("Respuesta inválida del servidor")
      return updated
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["wardrobe"] })
      const previous = queryClient.getQueryData<WardrobeItem[]>(["wardrobe"])
      queryClient.setQueryData<WardrobeItem[]>(["wardrobe"], (old) =>
        (old ?? []).map((item) =>
          item.id === id
            ? { ...item, model3dStatus: "generating" as const }
            : item,
        ),
      )
      return { previous }
    },
    onError: (error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["wardrobe"], context.previous)
      }
      queryClient.invalidateQueries({ queryKey: ["wardrobe"] })
      sileo.error({
        title:
          error instanceof Error ? error.message : "Error al generar modelo 3D",
      })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<WardrobeItem[]>(["wardrobe"], (old) =>
        (old ?? []).map((item) => (item.id === updated.id ? updated : item)),
      )
      if (updated.model3dStatus === "ready") {
        sileo.success({ title: t("wardrobe.model3dGenerated") })
      } else if (updated.model3dStatus === "failed") {
        sileo.error({
          title: updated.model3dError || t("wardrobe.model3dFailed"),
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wardrobe"] })
    },
  })
}
