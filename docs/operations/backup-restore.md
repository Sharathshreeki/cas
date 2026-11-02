# Database backup and restore (NFR-20, TC-16)

## Backup

```bash
pg_dump --format=custom --no-owner --file=cas-$(date +%Y%m%d-%H%M).dump "$DATABASE_URL"
```

Schedule daily (e.g. cron at 02:00) and keep 14 days. Store dumps off the database host.

## Restore

```bash
createdb cas_restore
pg_restore --no-owner --dbname=cas_restore cas-YYYYMMDD-HHMM.dump
```

## Restore test (run monthly and before evaluation)

1. Restore the latest dump into `cas_restore` as above.
2. `DATABASE_URL=postgresql://…/cas_restore npx prisma migrate status` → "Database schema is up to date".
3. Compare row counts:
   ```sql
   SELECT 'orders', count(*) FROM orders UNION ALL
   SELECT 'order_item', count(*) FROM order_item UNION ALL
   SELECT 'app_user', count(*) FROM app_user;
   ```
   against the same query on the source database at dump time.
4. Start the app against `cas_restore` and open an existing order as its student.
5. Record the date, dump file and result in the project log.
