import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Checkmark, PublicFooter, PublicHeader } from "@/components/public-site";
import { publicServices } from "@/lib/public-services";
import "./public.css";

export const metadata: Metadata = {
  title: "ProPlan Moves | Local moving in Dallas–Fort Worth",
  description: "A little planning. A better move. Local home, apartment, and office moving in Dallas–Fort Worth. Request a reviewed quote for your next move."
};

const questions = [
  ["What happens after I request a quote?", "We review your move details, confirm service availability, and follow up using your preferred contact method. You’ll receive a quote to review before you decide to move forward."],
  ["Does requesting a quote book my move?", "No. Your request starts the conversation. Your move is booked only after you accept a quote and we confirm the schedule with you."],
  ["Can I request help with just packing or loading?", "Yes. Choose Packing service or Labor only on the quote form and tell us what you need help with."],
  ["What if I don’t know my moving date yet?", "That’s fine. Leave the date blank or select Flexible date. Include any timing preferences in your notes so we can discuss the options."],
  ["Which areas do you serve?", "We focus on local moves in Dallas–Fort Worth and surrounding DFW communities. Share your pickup and destination addresses so our team can confirm coverage. Interstate moves are not currently offered."]
];

export default function HomePage() {
  return <div className="public-site">
    <PublicHeader />
    <main id="main">
      <section className="move-hero" aria-labelledby="hero-title">
        <Image className="hero-photo" src="/images/home-exterior.jpg" alt="A welcoming home with warm lights and a garden at dusk" fill sizes="100vw" preload />
        <div className="hero-shade" />
        <div className="move-container hero-content">
          <p className="hero-intro"><span /> Your local move. Dallas–Fort Worth.</p>
          <h1 id="hero-title">A little planning.<br />A better move.</h1>
          <p className="hero-description">From the first box to your new front door.<br className="desktop-break" /> Moving help, with a plan built around you.</p>
          <Link href="/quote-request" className="move-button">Request a quote <span aria-hidden="true">↗</span></Link>
          <p className="hero-note">Tell us your plans. We’ll help with the next step.</p>
        </div>
        <div className="hero-bottom move-container"><span>Home. Apartment. Office. Your next beginning.</span><a href="#services">Explore our services <span aria-hidden="true">↓</span></a></div>
      </section>

      <div className="move-reassurance"><div className="move-container reassurance-inner">
        <p><Checkmark /> A quote you can review</p><p><Checkmark /> Help that fits your move</p><p><Checkmark /> Scheduling confirmed with you</p>
      </div></div>

      <section id="services" className="move-container move-section services-section">
        <div className="section-intro"><p className="section-label">Our services</p><h2>Big changes.<br />Thoughtful help.</h2><p>A whole home or just the heavy lifting. Start with the help you need, and we’ll work through the details together.</p><Link className="text-link" href="/quote-request">Let’s plan your move <span aria-hidden="true">↗</span></Link></div>
        <div className="service-list">{publicServices.map((service) => <Link key={service.value} href={`/quote-request?service=${service.value}`} className="service-row">
          <div><h3>{service.title}</h3><p>{service.description}</p></div><span className="service-arrow" aria-hidden="true">↗</span>
        </Link>)}</div>
      </section>

      <section id="how-it-works" className="process-section"><div className="move-container move-section">
        <div className="section-heading"><div><p className="section-label">A clear path to moving day</p><h2>Good moves start<br />with a good plan.</h2></div><p>No guessing what comes next.<br />Just three steps to get things moving.</p></div>
        <ol className="process-list">
          <li><span className="step-number">01</span><h3>Tell us about your move</h3><p>Share where you’re headed, what you’re moving, and the help you have in mind.</p></li>
          <li><span className="step-number">02</span><h3>Review your quote</h3><p>We’ll confirm the details and prepare a quote for you to review before accepting.</p></li>
          <li><span className="step-number">03</span><h3>Get your date confirmed</h3><p>Once you accept, we’ll coordinate your schedule and confirm the moving-day plan.</p></li>
        </ol>
      </div></section>

      <section id="service-areas" className="move-container move-section coverage-section">
        <div className="coverage-visual" aria-hidden="true"><div className="coverage-ring ring-one"/><div className="coverage-ring ring-two"/><div className="coverage-ring ring-three"/><div className="coverage-route"/><div className="location-dot location-start"/><div className="location-dot location-end"/><span className="location-label label-start">Fort Worth</span><span className="location-label label-end">Dallas</span><div className="coverage-word">Our kind<br />of hometown.</div><span className="coverage-caption">Dallas–Fort Worth, Texas</span></div>
        <div className="coverage-copy"><p className="section-label">At home in DFW</p><h2>Around the corner.<br />Across the Metroplex.</h2><p>From Dallas to Fort Worth and the communities in between, we help you plan your next local move.</p><div className="coverage-places"><span>Dallas</span><span>Fort Worth</span><span>Surrounding DFW communities</span></div><p className="coverage-small">Share your pickup and destination addresses. We’ll confirm service coverage and availability for your move.</p><Link className="move-button move-button-navy" href="/quote-request">Ask about your move <span aria-hidden="true">↗</span></Link></div>
      </section>

      <section id="questions" className="faq-section"><div className="move-container move-section faq-layout"><div className="section-intro"><p className="section-label">A few helpful answers</p><h2>Before you<br />make your move.</h2><p>A little clarity goes a long way.</p></div><div className="faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="move-final"><div className="move-container final-inner"><div><p>Your next chapter is waiting.</p><h2>Let’s get you moving.</h2></div><Link className="move-button" href="/quote-request">Request a quote <span aria-hidden="true">↗</span></Link></div></section>
    </main>
    <PublicFooter />
  </div>;
}
