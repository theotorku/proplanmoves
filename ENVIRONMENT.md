# Environment Configuration

## Required variables

```dotenv
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BOOTSTRAP_OWNER_EMAIL=
BUSINESS_TIMEZONE=America/Chicago
DEFAULT_CURRENCY=USD
LOG_LEVEL=info
```

`BOOTSTRAP_OWNER_EMAIL` is required only for first-run owner bootstrap. Remove it
after the initial owner profile and role assignment are created.

## Optional future variables

```dotenv
RESEND_API_KEY=
EMAIL_FROM=
MAPS_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
AI_PROVIDER_API_KEY=
```

## Validation

Create a typed environment module that validates required variables on startup. Public variables and server-only variables must be separated. The service-role key must never be imported into client code.

## Local setup

Provide `.env.example` containing names and safe descriptions only. Never include live secrets.
