import type { Locale } from "@/lib/i18n"

export interface FaqItem {
  question: string
  /** Plain text: it is shown on the page and also sent as structured data. */
  answer: string
  /** Show a link to the security and privacy policy after the answer. */
  policyLink?: boolean
}

/**
 * Frequently asked questions. One source for the landing page, the
 * structured data (FAQPage) and llms.txt, so the three always agree. Answers
 * only state what the product does today.
 */
export const FAQ: Record<Locale, FaqItem[]> = {
  es: [
    {
      question: "¿Qué es Afrodita?",
      answer:
        "Afrodita es un estilista personal con inteligencia artificial. Guardas las prendas que ya tienes, le cuentas para qué ocasión te vistes y te propone combinaciones usando solo tu propia ropa.",
    },
    {
      question: "¿Cómo funciona?",
      answer:
        "Subes fotos de tus prendas a tu closet digital, describes lo que necesitas (por ejemplo, una cena casual o una reunión de trabajo) y el estilista te propone looks. Después puedes ver cada look sobre una foto tuya.",
    },
    {
      question: "¿Tengo que comprar ropa nueva?",
      answer:
        "No. Afrodita trabaja exclusivamente con lo que ya tienes en tu closet. No vende ropa ni te sugiere comprar prendas nuevas.",
    },
    {
      question: "¿Cómo veo cómo me queda un look?",
      answer:
        "Subes una foto tuya de cuerpo entero y la inteligencia artificial genera una imagen tuya con el outfit puesto. Es una aproximación: no garantiza talla ni ajuste real de las prendas.",
    },
    {
      question: "¿Qué pasa con mi foto?",
      answer:
        "Se guarda de forma privada. Antes de guardarla se revisa automáticamente que salga una sola persona, mayor de 18 años y vestida. Puedes eliminarla cuando quieras.",
      policyLink: true,
    },
    {
      question: "¿Puedo elegir qué prendas usar?",
      answer:
        "Sí. Puedes elegir hasta 2 prendas de tu closet como base y el estilista armará los looks alrededor de ellas.",
    },
    {
      question: "¿El estilista aprende mis gustos?",
      answer:
        "Sí. Puedes marcar «me gusta» o «no me gusta» en cada look. El estilista tiene en cuenta tus valoraciones y no vuelve a proponerte un look que descartaste.",
    },
    {
      question: "¿Hay una edad mínima?",
      answer: "Sí. Afrodita es solo para mayores de 18 años.",
    },
  ],
  en: [
    {
      question: "What is Afrodita?",
      answer:
        "Afrodita is a personal stylist powered by artificial intelligence. You save the clothes you already own, tell it what occasion you are dressing for, and it suggests combinations using only your own clothes.",
    },
    {
      question: "How does it work?",
      answer:
        "You upload photos of your garments to your digital closet, describe what you need (for example, a casual dinner or a work meeting) and the stylist proposes looks. Then you can see each look on a photo of yourself.",
    },
    {
      question: "Do I have to buy new clothes?",
      answer:
        "No. Afrodita works exclusively with what you already have in your closet. It does not sell clothes or suggest buying new ones.",
    },
    {
      question: "How do I see how a look fits me?",
      answer:
        "You upload a full-body photo of yourself and the artificial intelligence generates an image of you wearing the outfit. It is an approximation: it does not guarantee the real size or fit of the garments.",
    },
    {
      question: "What happens to my photo?",
      answer:
        "It is stored privately. Before it is saved, it is automatically checked to make sure it shows one person, over 18 and clothed. You can delete it at any time.",
      policyLink: true,
    },
    {
      question: "Can I choose which garments to use?",
      answer:
        "Yes. You can pick up to 2 garments from your closet as a base and the stylist will build the looks around them.",
    },
    {
      question: "Does the stylist learn my taste?",
      answer:
        "Yes. You can mark each look as liked or disliked. The stylist takes your ratings into account and never proposes a look you rejected again.",
    },
    {
      question: "Is there a minimum age?",
      answer: "Yes. Afrodita is for people over 18 only.",
    },
  ],
}
