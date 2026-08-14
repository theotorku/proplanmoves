"use client";

import { useActionState } from "react";
import { submitQuoteRequestAction, type QuoteRequestActionState } from "./actions";

const initialState: QuoteRequestActionState = {};

function FieldError({ name, errors }: { name: string; errors?: Record<string, string[]> }) {
  const message = errors?.[name]?.[0];
  return message ? <p className="mt-1 text-sm text-red-700">{message}</p> : null;
}

export function QuoteRequestForm() {
  const [state, formAction, isPending] = useActionState(
    submitQuoteRequestAction,
    initialState
  );

  if (state.confirmation) {
    return (
      <div className="rounded-md border border-teal-200 bg-white p-5">
        <h2 className="text-xl font-semibold">Request received</h2>
        <p className="mt-2 text-neutral-700">
          Your confirmation reference is{" "}
          <span className="font-mono font-semibold">{state.confirmation.leadReference}</span>.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-6">
      {state.message ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{state.message}</p> : null}
      <div className="hidden" aria-hidden="true">
        <label>
          Company website
          <input
            autoComplete="off"
            name="companyWebsite"
            tabIndex={-1}
            type="text"
          />
        </label>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="text-sm font-medium">First name</span>
          <input className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" name="firstName" required />
          <FieldError errors={state.fieldErrors} name="firstName" />
        </label>
        <label>
          <span className="text-sm font-medium">Last name</span>
          <input className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" name="lastName" required />
          <FieldError errors={state.fieldErrors} name="lastName" />
        </label>
        <label>
          <span className="text-sm font-medium">Email</span>
          <input className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" name="email" type="email" />
          <FieldError errors={state.fieldErrors} name="email" />
        </label>
        <label>
          <span className="text-sm font-medium">Phone</span>
          <input className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" name="phone" type="tel" />
          <FieldError errors={state.fieldErrors} name="phone" />
        </label>
        <label>
          <span className="text-sm font-medium">Preferred contact</span>
          <select className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" name="preferredContactMethod">
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="sms">SMS</option>
          </select>
          <FieldError errors={state.fieldErrors} name="preferredContactMethod" />
        </label>
        <label>
          <span className="text-sm font-medium">Move type</span>
          <select className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" name="moveType" required>
            <option value="residential">Residential</option>
            <option value="apartment">Apartment</option>
            <option value="office">Office</option>
            <option value="labor_only">Labor only</option>
            <option value="packing_service">Packing service</option>
          </select>
          <FieldError errors={state.fieldErrors} name="moveType" />
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="text-sm font-medium">Requested move date</span>
          <input className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" name="requestedMoveDate" type="date" />
        </label>
        <label>
          <span className="text-sm font-medium">Bedrooms or size proxy</span>
          <input className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" min={0} max={10} name="bedroomCount" type="number" />
        </label>
        <label>
          <span className="text-sm font-medium">Estimated boxes</span>
          <input className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2" min={0} name="estimatedBoxes" type="number" />
        </label>
        <div className="flex flex-wrap gap-4 pt-6">
          <label className="flex items-center gap-2"><input name="flexibleMoveDate" type="checkbox" /> Flexible date</label>
          <label className="flex items-center gap-2"><input name="needsPacking" type="checkbox" /> Packing help</label>
          <label className="flex items-center gap-2"><input name="needsStorage" type="checkbox" /> Storage</label>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AddressFields legend="Origin" prefix="origin" />
        <AddressFields legend="Destination" prefix="destination" />
      </section>

      <label>
        <span className="text-sm font-medium">Notes</span>
        <textarea className="mt-1 min-h-28 w-full rounded-md border border-neutral-300 px-3 py-2" name="notes" />
      </label>

      <button className="w-fit rounded-md bg-teal-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={isPending} type="submit">
        {isPending ? "Submitting..." : "Request a quote"}
      </button>
    </form>
  );
}

/**
 * Every field carries a real label rather than relying on its placeholder. A
 * placeholder is announced once and then vanishes as soon as the customer types,
 * which leaves anyone reviewing their answers — on a screen reader or not —
 * without a name for the box they are looking at.
 */
function AddressFields({ legend, prefix }: { legend: string; prefix: "origin" | "destination" }) {
  const fields = [
    { name: "Line1", label: "Street address", required: true, type: "text" as const },
    { name: "City", label: "City", required: true, type: "text" as const },
    { name: "State", label: "State", required: true, type: "text" as const },
    { name: "PostalCode", label: "Postal code", required: true, type: "text" as const },
    { name: "Floor", label: "Floor", required: false, type: "number" as const }
  ];

  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">{legend}</legend>
      {fields.map((field) => (
        <label className="block" key={field.name}>
          <span className="text-sm font-medium">
            {legend} {field.label.toLowerCase()}
          </span>
          <input
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
            maxLength={field.name === "State" ? 2 : undefined}
            min={field.type === "number" ? 0 : undefined}
            name={`${prefix}${field.name}`}
            placeholder={field.label}
            required={field.required}
            type={field.type}
          />
        </label>
      ))}
      <label className="flex items-center gap-2">
        <input name={`${prefix}HasElevator`} type="checkbox" /> Elevator available
      </label>
    </fieldset>
  );
}
