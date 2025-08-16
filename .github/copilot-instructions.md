# Copilot Instructions

This is a **public npm package**.
All code, APIs, and documentation must prioritize usability for external users.

## Code Style

- Use **strict TypeScript types** everywhere.
- Prefer `type` aliases and `interface` for public APIs.
- Avoid `any` and implicit `any`.n
- Use named exports unless default export is required.
- Follow the formatting enforced by Prettier and ESLint.

## API Design

- All public APIs must be documented in `README.md`.
- Favor composable, minimal, and predictable APIs.
- Use clear, descriptive names for functions, types, and variables.
- Avoid breaking changes; use semantic versioning.

## Documentation

- Every exported function/type must have a JSDoc comment.
- Update `README.md` for any public API change.
- Add usage examples for main APIs.

## Testing

- Use **Vitest** for all tests (`tests/` directory).
- Aim for **100% coverage** of public APIs.
- Write tests for edge cases and error handling.
- Keep tests readable and maintainable.

## Misc

- Do not add contribution guidelines here; they will be created later.
- Keep internal notes and TODOs out of this file.
