# CLAUDE.md

> Guidelines and context for AI assistants working in this repository.

## Project Overview

**Socky1** is a new project under initial setup. This file serves as the primary reference for AI assistants contributing to this codebase.

## Repository Structure

```
Socky1/
├── CLAUDE.md          # AI assistant guidelines (this file)
└── (project files TBD)
```

> **Note:** This repository is in its initial state. Update this section as the project structure evolves.

## Development Setup

### Prerequisites

- Git

### Getting Started

```bash
git clone <repo-url>
cd Socky1
```

> Update this section with language-specific setup instructions (e.g., `npm install`, `pip install -r requirements.txt`, `cargo build`) once the tech stack is established.

## Development Workflow

### Branching

- Feature branches follow the pattern: `claude/<description>` or `feature/<description>`
- Always develop on feature branches, never push directly to `main`

### Commits

- Write clear, descriptive commit messages
- Use conventional format: `type: short description` (e.g., `feat: add user authentication`, `fix: resolve connection timeout`)
- Keep commits focused — one logical change per commit

### Pull Requests

- PRs should have a clear title and summary
- Link related issues when applicable
- Ensure all checks pass before requesting review

## Code Conventions

> Update this section once the tech stack and coding standards are established. Include:
> - Language and framework versions
> - Formatting and linting tools (e.g., Prettier, ESLint, Black, Rustfmt)
> - Naming conventions (files, variables, functions, classes)
> - Import ordering rules
> - Error handling patterns

## Testing

> Update this section once a testing framework is chosen. Include:
> - How to run the full test suite
> - How to run individual tests
> - Test file naming and location conventions
> - Coverage requirements

## Build & Deployment

> Update this section once CI/CD is configured. Include:
> - Build commands
> - CI pipeline details
> - Deployment process

## AI Assistant Guidelines

When working in this repository:

1. **Read before writing** — Always read existing files before modifying them.
2. **Minimal changes** — Only change what is needed to complete the task. Do not refactor surrounding code or add unsolicited improvements.
3. **No guessing** — If the intent of existing code is unclear, investigate before changing it.
4. **Security first** — Never introduce credentials, secrets, or security vulnerabilities.
5. **Keep CLAUDE.md current** — When you add new tooling, frameworks, or conventions, update this file to reflect the changes.
