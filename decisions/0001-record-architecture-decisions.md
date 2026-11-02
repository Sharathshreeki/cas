# 1. Record architecture decisions

Status: Accepted

## Context

The capstone is evaluated against the SRS (`requirements/srs.md`). Several requirements leave
the concrete rule to the implementation ("configured rule", "selected model", "configured policy").
Evaluators need to see which rule was chosen and why.

## Decision

Record each significant decision as a numbered ADR in `decisions/`. Code that implements a decision
references the ADR in a comment. ADRs are tracked as ADCE `DECISION` artifacts.

## Consequences

- Every "configured rule" in the SRS maps to an ADR that states the configured value.
- Superseded decisions are kept and marked `Superseded by NNNN`.

## Index

| ADR | Decision |
|---|---|
| 0002 | Signed-cookie sessions with a Data Access Layer |
| 0003 | Slot capacity = max orders per 15-minute slot, atomic conditional booking |
| 0004 | Payments: cash at pickup + simulated online payment |
| 0005 | Order lifecycle and cancellation policy |
| 0006 | ML integration boundary and non-ML fallbacks |
| 0007 | Optional, non-persistent geofencing |
| 0008 | Single-stall cart |
| 0009 | Fresh `cas` database managed by Prisma migrations |
