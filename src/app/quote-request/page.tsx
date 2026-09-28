import type { Metadata } from "next";
import { Checkmark, PublicFooter, PublicHeader } from "@/components/public-site";
import { resolvePublicService } from "@/lib/public-services";
import { QuoteRequestForm } from "./quote-request-form";
import "../public.css";

export const metadata: Metadata = { title: "Request a quote | ProPlan Moves", description: "Tell us about your Dallas–Fort Worth move. Request a reviewed quote from ProPlan Moves, with no booking commitment." };

export default async function QuoteRequestPage({ searchParams }: { searchParams: Promise<{ service?: string | string[] }> }) {
  const { service } = await searchParams;
  return <div className="public-site"><PublicHeader quote />
    <main id="main" className="move-container quote-layout">
      <aside className="quote-intro"><p className="section-label">Let’s make a plan</p><h1>Tell us about<br />your move.</h1><p>A few details now.<br />A smoother start to your next chapter.</p>
        <nav aria-label="Quote form sections" className="quote-steps"><a href="#contact"><span>01</span> Your contact details</a><a href="#move-details"><span>02</span> Your move</a><a href="#addresses"><span>03</span> From here to there</a></nav>
        <div className="quote-assurance"><Checkmark /><div><strong>A request, not a reservation.</strong><p>We’ll review your details and contact you about availability and a quote. Your date is confirmed separately.</p></div></div>
      </aside>
      <QuoteRequestForm key={resolvePublicService(service)} initialService={resolvePublicService(service)} />
    </main><PublicFooter /></div>;
}
