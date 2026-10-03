"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Sparkles, Loader2 } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatInterfaceProps {
  onSendMessage: (messages: Message[]) => Promise<{
    type: "message" | "outfit"
    message?: string
  }>
  isGenerating: boolean
}

export function ChatInterface({ onSendMessage, isGenerating }: ChatInterfaceProps) {
  const { t, locale } = useTranslation()
  const idCounter = useRef(0)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("chat.welcome"),
    },
  ])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync welcome message with locale; only updates if conversation hasn't started
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [{ ...prev[0], content: t("chat.welcome") }]
      }
      return prev
    })
  }, [locale, t])

  const generateId = () => {
    idCounter.current += 1
    return `msg-${idCounter.current}`
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isGenerating])

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isGenerating) return

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")

    const response = await onSendMessage(nextMessages)

    if (response.message) {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: response.message!,
        },
      ])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const userMessageCount = messages.filter((m) => m.role === "user").length
  const lastMessage = messages[messages.length - 1]
  const isAskingForOccasion =
    lastMessage?.role === "assistant" &&
    (lastMessage.content.includes("ocasión") ||
      lastMessage.content.includes("occasion") ||
      lastMessage.content.includes("¿para qué"))

  let quickPrompts: string[]
  if (userMessageCount === 0) {
    quickPrompts = [
      t("chat.quickPrompts.hello"),
      t("chat.quickPrompts.whatToWear"),
      t("chat.quickPrompts.help"),
    ]
  } else if (isAskingForOccasion) {
    quickPrompts = [
      t("chat.quickPrompts.work"),
      t("chat.quickPrompts.date"),
      t("chat.quickPrompts.gym"),
      t("chat.quickPrompts.casual"),
    ]
  } else {
    quickPrompts = []
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-[1000px] mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] ${
                  message.role === "user"
                    ? "bg-[#1A1A1A] text-white px-6 py-4"
                    : "bg-[#EDE8E1] text-[#1A1A1A] px-6 py-4"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3 h-3 text-[#C9B99A]" />
                    <span className="text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B]">
                      {t("chat.personalStylist")}
                    </span>
                  </div>
                )}
                <p className="text-sm leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-[#EDE8E1] px-6 py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-[#C9B99A] animate-spin" />
                  <span className="text-sm text-[#6B6B6B]">
                    {t("chat.thinking")}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick prompts */}
      {quickPrompts.length > 0 && !isGenerating && (
        <div className="px-6 pb-4">
          <div className="max-w-[1000px] mx-auto">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#6B6B6B] mb-3">
              {t("chat.try")}
            </p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="text-xs border border-[#E0D9CF] px-4 py-2 hover:bg-[#EDE8E1] transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-6 border-t border-[#E0D9CF]">
        <div className="max-w-[1000px] mx-auto flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            className="input-elegant flex-1"
            disabled={isGenerating}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isGenerating}
            className="btn-fashion px-8 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
