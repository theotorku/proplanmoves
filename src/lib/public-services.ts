export const publicServices = [
  { value: "residential", title: "Home moves", description: "A new address. A fresh start. Tell us about your home, your belongings, and what your move needs." },
  { value: "apartment", title: "Apartment moves", description: "Stairs, elevators, and tight hallways. Share the details so we can plan around your building." },
  { value: "office", title: "Office moves", description: "Make room for your next chapter. Plan a local move for your workspace, furniture, and equipment." },
  { value: "labor_only", title: "Loading & unloading", description: "Have the transportation sorted? Request moving help for the heavy lifting at either end." },
  { value: "packing_service", title: "Packing help", description: "A little extra help before moving day. Tell us what needs packing and we’ll include it in your plan." }
] as const;

export function resolvePublicService(value: unknown): string {
  return publicServices.find((service) => service.value === value)?.value ?? "residential";
}
