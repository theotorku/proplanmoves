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
7. Run smoke test.
8. Verify logs and error rate.
9. Record release notes and known limitations.

## Production smoke test

- homepage loads
- quote form validation works
- test lead can be submitted
- admin login works
- lead is visible
- estimate calculation completes
- quote preview renders
- job can be scheduled
- dashboard updates

Use an explicitly marked test customer and remove or archive it afterward.

## Rollback

- Application: roll back to previous Vercel deployment.
- Database: prefer forward-fix migrations. For destructive migrations, document a tested rollback before release.
- Feature changes: use configuration flags for high-risk integrations added later.

## Backups

Enable Supabase production backups appropriate to the plan. Test restoration procedures before relying on the system for live operations.
