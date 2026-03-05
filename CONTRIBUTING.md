# Contributing Guide

This repository is a capstone team project. The goal is to keep work organized and avoid breaking the demo.

---

## Branching Strategy
- `main`: stable demo-ready version (do not push directly)
- `dev`: integration branch (default target for PRs)
- Feature branches:
  - `feature/<short-title>` (code changes)
  - `docs/<short-title>` (documentation/report changes)
  - `fix/<short-title>` (bug fixes)

Examples:
- `feature/upload-api`
- `feature/dashboard-layout`
- `docs/proposal-v1`
- `fix/docker-compose`

---

## Basic Rules
1. **Do not push directly to `main`.**
2. Create a feature branch for your work.
3. Open a Pull Request (PR) to `dev`.
4. Keep PRs small and focused (one feature / one fix).
5. Avoid committing real/sensitive data (EHR files) to Git.

---

## How to Start a New Task
1) Sync latest `dev`:
```bash
git checkout dev
git pull
```

2) Create a branch:
```bash
git checkout -b feature/<short-title>
```

3) Work and commit:
```bash
git add .
git commit -m "feat: <short message>"
```

4) Push and open a PR:
```bash
git push -u origin feature/<short-title>
```
Then open a PR to `dev` in GitHub.

---

## Commit Message Style (Simple)
Use one of these prefixes:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation/report changes
- `chore:` tooling/config changes
- `refactor:` code refactor (no behavior change)

Examples:
- `feat: add dataset upload endpoint`
- `fix: handle missing values safely`
- `docs: update proposal scope`
- `chore: add docker compose services`

---

## Code Style (Lightweight)
- Keep code readable and simple.
- Add comments for non-obvious logic.
- Prefer clear names over short names.

Backend (Python):
- Use type hints where reasonable.
- Keep functions small.

Frontend (React):
- Keep components small and reusable.
- Avoid duplicated logic.

---

## Pull Request Checklist
Before requesting review:
- [ ] Code runs locally (or via Docker)
- [ ] No secrets or real datasets committed
- [ ] PR description explains what changed and why
- [ ] Screenshots added for UI changes (if applicable)

---

## Sensitive Data Policy
- Do not commit real patient data or private datasets.
- Use anonymized or small sample data only.
- Use `.env` for local settings and do not commit `.env` files.
