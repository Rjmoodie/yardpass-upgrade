# Testing Guide

## Overview

This directory contains tests for YardPass utilities and hooks. Tests use Vitest as the test runner.

## Setup

Tests are run using Vitest. To run tests:

```bash
npm test
```

To run tests in watch mode:

```bash
npm test -- --watch
```

## Test Structure

```
tests/
├── utils/              # Utility function tests
│   ├── logger.test.ts
│   ├── messaging.test.ts
│   └── errorMessages.test.ts
└── hooks/              # React hook tests (using @testing-library/react-hooks)
    ├── useFollowBatch.test.ts
    └── useFollowCountsCached.test.ts
```

## Writing Tests

### Utility Function Tests

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from '@/utils/functionToTest';

describe('functionToTest', () => {
  it('should handle basic case', () => {
    const result = functionToTest(input);
    expect(result).toBe(expected);
  });
});
```

### Hook Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { useHookToTest } from '@/hooks/useHookToTest';

describe('useHookToTest', () => {
  it('should return expected initial state', () => {
    const { result } = renderHook(() => useHookToTest());
    expect(result.current).toEqual(expected);
  });
});
```

## Coverage Goals

- **Utilities**: 80%+ coverage for critical functions
- **Hooks**: Basic smoke tests for public APIs
- **Components**: Visual regression tests (future)

## Notes

- Edge function tests (Deno) are separate and use Deno's test runner
- Integration tests should use MSW for API mocking
- Test utilities are in `tests/utils/`

