# Database Schema and Migrations

## Current Schema

The canonical schema is **`schema_v3_final.sql`**. This is the source of truth for new database installations.

## Migration Order

Migrations should be applied in the following order after the base schema:

1. `migration_tracking.sql` - Sets up migration tracking (run this first for new installs)
2. `migration_add_activity_tracking.sql` - Work order activity timeline
3. `migration_multi_worker_dates.sql` - Multi-worker scheduling
4. `migration_add_time_tracking_fixed.sql` - Time tracking (use _fixed version)
5. `migration_schedule_contradictions.sql` - Schedule conflict detection
6. `migration_add_reporting_views.sql` - Reporting dashboard views
7. `migration_add_financial_reports_v3.sql` - Financial reports (use v3)
8. `migration_scope_to_tasks.sql` - Work order tasks
9. `migration_work_order_photos_compat.sql` - Photo storage
10. `migration_missing_core_tables.sql` - Missing tables
11. `migration_photo_notes.sql` - Photo captions
12. `migration_notifications.sql` - User notifications
13. `migration_purchase_order_items.sql` - PO line items
14. `migration_quotes_system.sql` - Quotes/estimates
15. `migration_communication_settings.sql` - Email/SMS config
16. `migration_add_variance_reporting.sql` - Cost variance
17. `migration_account_lockout.sql` - Account security

## Deprecated Files (DO NOT USE)

The following files are deprecated and should not be used:

- `schema.sql` - Old version, use schema_v3_final.sql instead
- `schema_v2_enhanced.sql` - Old version, use schema_v3_final.sql instead
- `migration_add_financial_reports.sql` - Use migration_add_financial_reports_v3.sql
- `migration_add_financial_reports_fixed.sql` - Use migration_add_financial_reports_v3.sql
- `migration_add_time_tracking.sql` - Use migration_add_time_tracking_fixed.sql

## Seed Data

For development/testing:
- `seed_test_data.sql` - Minimal test data
- `seed_mock_data_corrected.sql` - More comprehensive mock data

## How to Check Migration Status

```sql
SELECT * FROM migration_status;
```

## How to Record a New Migration

```sql
SELECT record_migration('018_my_new_migration', 'Description of what this does');
```
