import { auth } from "@/auth";
import { LandingHeader } from "@/components/landing/header";
import { LandingHero } from "@/components/landing/hero";
import { LandingInteractiveDemo } from "@/components/landing/interactive-demo";
import { LandingFeatures } from "@/components/landing/features";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingFAQ } from "@/components/landing/faq";
import { LandingFooter } from "@/components/landing/footer";

export const metadata = {
  title: "Marcou! Arena — Sistema Completo de Gestão para Arenas Esportivas",
  description:
    "Reservou · Jogou · Faturou. O sistema definitivo de gestão de quadras para qualquer modalidade, comandas de PDV, clube de filiação e CRM no WhatsApp.",
};

export default async function Home() {
  let isLoggedIn = false;

  try {
    const session = await auth();
    isLoggedIn = Boolean(session?.user);
  } catch (_err) {
    // Fallback gracioso caso o banco de dados não esteja conectado localmente
    isLoggedIn = false;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-1)] font-sans antialiased selection:bg-[var(--accent-tint)] selection:text-[var(--accent)]">
      {/* Header */}
      <LandingHeader isLoggedIn={isLoggedIn} />

      {/* Main Content */}
      <main id="main-content">
        <LandingHero />
        <LandingInteractiveDemo />
        <LandingFeatures />
        <LandingPricing />
        <LandingFAQ />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
