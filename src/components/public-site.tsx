import Link from "next/link";

export function Brand() {
  return <Link className="move-brand" href="/" aria-label="ProPlan Moves home">
    <svg width="38" height="38" viewBox="0 0 38 38" fill="none" aria-hidden="true"><path d="M4 29V14L19 5l15 9v15H23V18h-8v11H4Z" stroke="currentColor" strokeWidth="2.5"/><path d="M1 34h36" stroke="currentColor" strokeWidth="2.5"/></svg>
    <span>ProPlan<span className="brand-moves">Moves</span></span>
  </Link>;
}

export function PublicHeader({ quote = false }: { quote?: boolean }) {
  return <header className="move-header">
    <a className="move-skip" href="#main">Skip to content</a>
    <div className="move-container header-inner">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="/#services">Our services</Link>
        <Link href="/#service-areas">Service areas</Link>
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/#questions">FAQs</Link>
      </nav>
      <Link className={quote ? "move-back" : "move-button move-button-small"} href={quote ? "/" : "/quote-request"}>{quote ? "Back to home" : "Request a quote"}</Link>
    </div>
  </header>;
}

export function PublicFooter() {
  return <footer className="move-footer"><div className="move-container footer-inner">
    <div><Brand /><p>A little planning. A better move.</p></div>
    <div className="footer-links"><Link href="/#services">Our services</Link><Link href="/#service-areas">Service areas</Link><Link href="/quote-request">Request a quote</Link><Link href="/login">Staff sign in</Link></div>
    <p className="footer-note">© {new Date().getFullYear()} ProPlan Moves. Serving Dallas–Fort Worth.</p>
  </div></footer>;
}

export function Checkmark() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
