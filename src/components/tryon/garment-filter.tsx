"use client"

import Image from "next/image"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

export interface FilterGarment {
  id: string
  name: string
  imageUrl: string
}

/**
 * Multi-select of garments, each with its picture. Styled like the app's
 * single Select; the menu stays open while options are toggled.
 */
export function GarmentFilter({
  garments,
  selected,
  onChange,
  className = "",
  max,
  placeholder,
  showAll = true,
}: {
  garments: FilterGarment[]
  selected: string[]
  onChange: (ids: string[]) => void
  className?: string
  /** Most garments that can be selected; the rest are disabled once reached. */
  max?: number
  /** Button text while nothing is selected (default: "All garments"). */
  placeholder?: string
  /** Show the "All garments" option that clears the selection. */
  showAll?: boolean
}) {
  const { t } = useTranslation()

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : max !== undefined && selected.length >= max
          ? selected
          : [...selected, id],
    )

  const label =
    selected.length === 0
      ? (placeholder ?? t("looks.allGarments"))
      : selected.length === 1
        ? (garments.find((garment) => garment.id === selected[0])?.name ?? "")
        : t("looks.garmentsSelected", { count: selected.length })

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={`flex h-12 items-center justify-between gap-3 border border-[#E0D9CF] bg-transparent px-4 py-3 text-sm focus:border-[#1A1A1A] focus:outline-none data-[state=open]:border-[#1A1A1A] ${className}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#6B6B6B]" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-96 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto border border-[#E0D9CF] bg-[#F8F5F0] p-1 shadow-md"
        >
          {showAll && (
            <>
              <DropdownMenu.Item
                // Clearing is a single action, so this one does close the menu
                onSelect={() => onChange([])}
                className="relative flex cursor-pointer select-none items-center py-3 pl-10 pr-4 text-sm text-[#1A1A1A] outline-none data-[highlighted]:bg-[#EDE8E1]"
              >
                {selected.length === 0 && (
                  <Check className="absolute left-3 h-4 w-4 text-[#1A1A1A]" />
                )}
                {t("looks.allGarments")}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-[#E0D9CF]" />
            </>
          )}

          {garments.map((garment) => (
            <DropdownMenu.CheckboxItem
              key={garment.id}
              checked={selected.includes(garment.id)}
              onCheckedChange={() => toggle(garment.id)}
              disabled={
                max !== undefined &&
                selected.length >= max &&
                !selected.includes(garment.id)
              }
              // Keep the menu open to pick several
              onSelect={(event) => event.preventDefault()}
              className="relative flex cursor-pointer select-none items-center gap-3 py-2 pl-10 pr-4 text-sm text-[#1A1A1A] outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-[#EDE8E1]"
            >
              <DropdownMenu.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center">
                <Check className="h-4 w-4 text-[#1A1A1A]" />
              </DropdownMenu.ItemIndicator>
              <span className="relative h-10 w-8 shrink-0 overflow-hidden bg-white">
                <Image
                  src={garment.imageUrl}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </span>
              <span className="truncate">{garment.name}</span>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
