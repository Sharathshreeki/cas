# 9. Fresh `cas` database managed by Prisma migrations

Status: Accepted · Requirements: NFR-34, §8

## Context

A local `pes_canteen` database already existed with hand-created, empty tables (`student`, `stall`,
`menu_item`, `pickup_slot`, `orders`, …). That schema lacked an admin role, dated pickup slots and
stall/staff separation (the stall was itself the staff login), and was not managed by migrations.

## Decision

Leave `pes_canteen` untouched and use a new `cas` database whose schema is defined in
`prisma/schema.prisma` and created only through `prisma migrate`. Table names keep the original
snake_case naming (`stall`, `menu_item`, `pickup_slot`, `orders`, `order_item`, `payment`, …) via `@@map`.
A separate `cas_test` database is used by integration tests.

## Consequences

The old database can be dropped by the developer when no longer needed. All schema changes are
reproducible from version control.
