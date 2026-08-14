# Deployment

## Environments

- Local: local Next.js plus local or development Supabase
- Preview: Vercel preview plus isolated non-production Supabase project/branch
- Production: Vercel production plus production Supabase

Never point preview deployments at the production database.

## Release process

1. Merge only after CI passes.
2. Run `npm run db:reset` and `npm run test:db` against the disposable local stack.
3. Review the exact ordered files under `supabase/migrations`.
4. Apply database migrations to the selected target environment.
5. Run Supabase database advisors and verify migration history and RLS.
6. Deploy application.
7. Run `npm run smoke -- <deployment-url>`.
8. Verify logs and error rate.
9. Record release notes and known limitations.

## Production smoke test

Automated, read-only, safe to run on every release:

```bash
npm run smoke -- https://app.example.com
```

It checks that the public pages serve, that the sign-in page renders, that
`/admin` redirects anonymous visitors to `/login`, that the security headers and
HSTS are present, and that the framework is not advertised. It exits non-zero on
the first failure so a pipeline can gate on it.

Manual pass after the automated one, on the first release and after any workflow
change:

- admin sign-in works
- a test lead can be submitted and is visible in the queue
- estimate calculation completes and can be approved
- quote preview renders and can be accepted
- job can be booked and scheduled
- dashboard reflects the new job

Use an explicitly marked test customer and remove or archive it afterward.

## Rollback

- Application: roll back to previous Vercel deployment.
- Database: prefer forward-fix migrations. For destructive migrations, document a tested rollback before release.
- Feature changes: use configuration flags for high-risk integrations added later.

## Backups

Enable Supabase production backups appropriate to the plan. Test restoration procedures before relying on the system for live operations.
