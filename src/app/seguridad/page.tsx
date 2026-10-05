import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Política de seguridad y privacidad",
  description:
    "Qué datos recopila Afrodita, para qué los usa, con quién los comparte y cómo los protege.",
  alternates: { canonical: "/seguridad" },
}

export default function SecurityPage() {
  return <LegalPage doc="security" />
}
