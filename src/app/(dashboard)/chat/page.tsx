"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { ChatInterface } from "@/components/chat/chat-interface"
import { useWardrobe } from "@/hooks/use-wardrobe"

interface GeneratedOutfit {
  id: string
  options: { id: string; title: string; description: string }[]
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

export default function ChatPage() {
  const { t, locale } = useTranslation()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedOutfit, setGeneratedOutfit] =
    useState<GeneratedOutfit | null>(null)
  const { data: wardrobe = [] } = useWardrobe()
  const [anchorIds, setAnchorIds] = useState<string[]>([])

  const handleSendMessage = async (
    messages: ChatMessage[],
  ): Promise<{ type: "message" | "outfit"; message?: string }> => {
    setIsGenerating(true)
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map(({ role, content }) => ({ role, content })),
          locale,
          anchorIds,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      if (data.type === "outfit" && data.outfit) {
        setGeneratedOutfit(data.outfit)
        return { type: "outfit", message: data.message }
      }

      return { type: "message", message: data.message }
    } catch (error) {
      console.error("Error in chat:", error)
      return {
        type: "message",
        message: "Ups, hubo un error. ¿Puedes intentar de nuevo?",
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] pt-16">
      {/* Header */}
      <header className="border-b border-[#E0D9CF]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-6 flex items-center gap-6">
          <Link
            href="/wardrobe"
            className="p-2 hover:bg-[#EDE8E1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#6B6B6B] mb-1">
              {t("chat.aiAssistant")}
            </p>
            <h1 className="font-editorial text-3xl font-light">
              {t("chat.title")}
            </h1>
          </div>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          garments={wardrobe}
          anchorIds={anchorIds}
          onAnchorsChange={setAnchorIds}
        />
      </div>

      {/* Generated outfit result */}
      {generatedOutfit && (
        <div className="border-t border-[#E0D9CF] p-6 bg-[#EDE8E1]/30">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#C9B99A]/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-[#C9B99A]" />
              </div>
              <div>
                <p className="font-medium">{t("chat.generated")}</p>
                <p className="text-xs text-[#6B6B6B]">
                  {generatedOutfit.options.length} {t("chat.optionsAvailable")}
                </p>
              </div>
            </div>
            {generatedOutfit.options.length === 3 ? (
              <Link
                href="/preview"
                className="btn-fashion inline-flex items-center gap-3"
              >
                {t("chat.tryOnLive")}
              </Link>
            ) : (
              <p className="text-xs text-[#6B6B6B] max-w-xs text-right">
                {t("chat.threeOptionsNeeded")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
