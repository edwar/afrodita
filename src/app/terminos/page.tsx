import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Las reglas para usar Afrodita: tu cuenta, tu contenido, las reglas de la foto base y el contenido generado con IA.",
  // The site-wide canonical points at the home page; this page is its own
  alternates: { canonical: "/terminos" },
}

export default function TermsPage() {
  return <LegalPage doc="terms" />
}
