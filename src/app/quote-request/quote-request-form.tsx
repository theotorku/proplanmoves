"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore, type ComponentPropsWithoutRef, type ChangeEvent } from "react";
import { submitQuoteRequestAction, type QuoteRequestActionState } from "./actions";

const initialState: QuoteRequestActionState = {};
const subscribeToHydration = () => () => {};
type FieldValues = Record<string, string>;
type FieldErrors = Record<string, string[]>;

type FieldProps = ComponentPropsWithoutRef<"input"> & {
  name: string;
  label: string;
  errors?: FieldErrors;
  hint?: string;
};

function Field({ name, label, errors, hint, ...props }: FieldProps) {
  const error = errors?.[name]?.[0];
  return <div className="quote-field">
    <label htmlFor={name}>{label}{props.required ? <span aria-hidden="true"> *</span> : null}</label>
    <input {...props} id={name} name={name} aria-invalid={error ? true : undefined} aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined} />
    {hint ? <p id={`${name}-hint`} className="field-hint">{hint}</p> : null}
    {error ? <p id={`${name}-error`} className="field-error">{error}</p> : null}
  </div>;
}

export function QuoteRequestForm({ initialService = "residential" }: { initialService?: string }) {
  // Do not accept input until controlled fields can retain it during hydration.
  const isInteractive = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [state, formAction, isPending] = useActionState(submitQuoteRequestAction, initialState);
  // Controlled fields retain customer input when React resets a completed action.
  // Personal details stay in memory, never in browser storage.
  const [values, setValues] = useState<FieldValues>({ moveType: initialService, preferredContactMethod: "email" });
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.message || state.confirmation) resultRef.current?.focus();
  }, [state]);

  function changeValue(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.currentTarget;
    setValues((previous) => ({ ...previous, [name]: value }));
  }
  function field(name: string) {
    return { name, value: values[name] ?? "", onChange: changeValue, errors: state.fieldErrors };
  }
  function checkbox(name: string, label: string) {
    return <label className="quote-check"><input type="checkbox" name={name} checked={checks[name] ?? false} onChange={(event) => {
      const checked = event.currentTarget.checked;
      setChecks((previous) => ({ ...previous, [name]: checked }));
    }} />{label}</label>;
  }

  if (state.confirmation) {
    return <div className="quote-success" role="status" tabIndex={-1} ref={resultRef}>
      <span className="success-check" aria-hidden="true">✓</span>
      <p className="section-label">You’ve taken the first step</p>
      <h2>Request received</h2>
      <p>Your confirmation reference is <span className="font-mono">{state.confirmation.leadReference}</span>.</p>
      <div className="success-next"><h3>What happens next?</h3><p>Our team will review your move details and follow up using your preferred contact method to confirm coverage, availability, and your quote.</p><p>Your move is not booked yet. We’ll confirm a schedule with you after you accept a quote.</p></div>
      <Link href="/" className="move-button move-button-navy">Back to home</Link>
    </div>;
  }

  return <form action={formAction} className="quote-form" aria-label="Request a moving quote" aria-busy={isPending}>
    {state.message ? <div className="quote-alert" role="alert" tabIndex={-1} ref={resultRef}><strong>{state.message}</strong><p>Your details are still here. Check the messages below or try again shortly.</p></div> : null}
    <div hidden aria-hidden="true"><label>Company website<input autoComplete="off" name="companyWebsite" tabIndex={-1} /></label></div>
    <p className="form-required">Fields marked * are required. Optional details help us plan.</p>
    <noscript><p className="quote-alert">Please enable JavaScript to complete your quote request.</p></noscript>

    <fieldset id="contact" className="quote-group" disabled={!isInteractive || isPending}>
      <legend><span>01</span> Your contact details</legend>
      <p className="group-help">How should we get in touch about your move?</p>
      <div className="quote-grid">
        <Field {...field("firstName")} label="First name" required autoComplete="given-name" maxLength={80} />
        <Field {...field("lastName")} label="Last name" required autoComplete="family-name" maxLength={80} />
        <Field {...field("email")} label="Email" type="email" autoComplete="email" hint="Needed if you prefer email." />
        <Field {...field("phone")} label="Phone" type="tel" autoComplete="tel" minLength={7} maxLength={30} hint="Needed for phone or text contact." />
        <div className="quote-field"><label htmlFor="preferredContactMethod">Preferred contact</label><select id="preferredContactMethod" name="preferredContactMethod" value={values.preferredContactMethod} onChange={changeValue} aria-invalid={state.fieldErrors?.preferredContactMethod ? true : undefined} aria-describedby={state.fieldErrors?.preferredContactMethod ? "contact-method-error" : undefined}><option value="email">Email</option><option value="phone">Phone</option><option value="sms">SMS</option></select>{state.fieldErrors?.preferredContactMethod ? <p id="contact-method-error" className="field-error">{state.fieldErrors.preferredContactMethod[0]}</p> : null}</div>
      </div>
    </fieldset>

    <fieldset id="move-details" className="quote-group" disabled={!isInteractive || isPending}>
      <legend><span>02</span> Your move</legend>
      <p className="group-help">Tell us what you have in mind. It’s okay if some details aren’t final.</p>
      <div className="quote-grid">
        <div className="quote-field"><label htmlFor="moveType">Move type *</label><select id="moveType" name="moveType" required value={values.moveType} onChange={changeValue}><option value="residential">Residential</option><option value="apartment">Apartment</option><option value="office">Office</option><option value="labor_only">Labor only</option><option value="packing_service">Packing service</option></select></div>
        <Field {...field("requestedMoveDate")} label="Requested move date" type="date" hint="Leave blank if you’re still deciding." />
        <Field {...field("bedroomCount")} label="Number of bedrooms" type="number" min={0} max={10} hint="For non-home moves, describe the size in Notes." />
        <Field {...field("estimatedBoxes")} label="Estimated boxes" type="number" min={0} max={1000} hint="A rough count is fine." />
      </div>
      <div className="quote-checks">{checkbox("flexibleMoveDate", "Flexible date")}{checkbox("needsPacking", "Packing help")}{checkbox("needsStorage", "Discuss storage needs")}</div>
    </fieldset>

    <fieldset id="addresses" className="quote-group" disabled={!isInteractive || isPending}>
      <legend><span>03</span> From here to there</legend>
      <p className="group-help">We serve Dallas–Fort Worth. We’ll confirm coverage for your addresses.</p>
      <div className="quote-grid address-grid">
        {(["origin", "destination"] as const).map((prefix) => {
          const legend = prefix === "origin" ? "Origin" : "Destination";
          const addressError = state.fieldErrors?.[`${prefix}Address`]?.[0];
          return <fieldset key={prefix} className="address-fields" aria-describedby={addressError ? `${prefix}-error` : undefined}>
            <legend>{prefix === "origin" ? "Moving from" : "Moving to"}</legend>
            {addressError ? <p id={`${prefix}-error`} className="field-error">{legend}: {addressError}</p> : null}
            <Field {...field(`${prefix}Line1`)} label={`${legend} street address`} required minLength={3} maxLength={160} autoComplete={`section-${prefix} address-line1`} />
            <Field {...field(`${prefix}Line2`)} label={`${legend} apartment / suite`} autoComplete={`section-${prefix} address-line2`} />
            <Field {...field(`${prefix}City`)} label={`${legend} city`} required minLength={2} maxLength={80} autoComplete={`section-${prefix} address-level2`} />
            <div className="address-short-fields"><Field {...field(`${prefix}State`)} label={`${legend} state`} required minLength={2} maxLength={2} placeholder="TX" autoComplete={`section-${prefix} address-level1`} /><Field {...field(`${prefix}PostalCode`)} label={`${legend} postal code`} required minLength={5} maxLength={12} autoComplete={`section-${prefix} postal-code`} /></div>
            <Field {...field(`${prefix}Floor`)} label={`${legend} floor`} type="number" min={0} max={100} />
            {checkbox(`${prefix}HasElevator`, `${legend} elevator available`)}
          </fieldset>;
        })}
      </div>
      <div className="quote-field notes-field"><label htmlFor="notes">Notes <span>(optional)</span></label><textarea id="notes" name="notes" value={values.notes ?? ""} onChange={changeValue} rows={4} placeholder="Large or delicate items, parking, building access, or anything else we should know." /></div>
    </fieldset>
    <div className="quote-submit"><p>We’ll use these details to respond to your request and plan your move. Submitting does not book a date or commit you to a quote.</p><button className="move-button move-button-navy" disabled={!isInteractive || isPending} type="submit">{isPending ? "Sending your request…" : "Request a quote"}<span aria-hidden="true">↗</span></button><span className="submit-note">No payment required to request a quote.</span></div>
  </form>;
}
