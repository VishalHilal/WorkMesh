## Summary

Closes #<!-- issue number -->

<!-- Describe what this PR does and why. One short paragraph is enough. -->

## What changed

<!-- List the key changes. Be specific — what files, what behaviour. -->

-
-

## Checks run locally

<!-- Tick every check you actually ran for the services you touched. Remove rows that don't apply. -->

| Service | Check | Result |
|---------|-------|--------|
| Frontend | `npm run lint` | ✅ / ❌ |
| Frontend | `npm test` | ✅ / ❌ |
| Frontend | `npm run build` | ✅ / ❌ |
| Backend | `npm run typecheck` | ✅ / ❌ |
| Backend | `npm test` | ✅ / ❌ |
| Backend | `npm run build` | ✅ / ❌ |
| AI service | `ruff check .` | ✅ / ❌ |
| AI service | `pytest` | ✅ / ❌ |

## Self-review checklist

- [ ] I read the full diff as if someone else wrote it
- [ ] No unrelated changes are included
- [ ] No debug code, `console.log`, or commented-out code is left in
- [ ] No `.env`, `venv/`, `node_modules/`, or build output is staged
- [ ] Tests cover the behaviour added or changed
- [ ] Authorization and company scope are enforced where relevant
- [ ] `.env.example` is updated if new environment variables were added
- [ ] Documentation is updated if API contracts, schema, or commands changed
- [ ] CI is green

## Migration or deployment notes

<!-- Describe any database migrations, new env variables, or deployment steps needed. -->
<!-- Write "None" if not applicable. -->

None

## Screenshots (UI changes only)

<!-- Add screenshots or delete this section. -->
