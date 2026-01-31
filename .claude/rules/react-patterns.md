# React Patterns

## State Management

### Shared Connections (WebSocket, Relay)
Use React Context for managing shared WebSocket/relay connections. Never create separate connections per component.

```tsx
// CORRECT: Single shared connection via context
const RelayProvider = ({ children }) => {
  const client = useMemo(() => createRelayClient(), []);
  return <RelayContext.Provider value={client}>{children}</RelayContext.Provider>;
};

// WRONG: Per-component connection instantiation
const useMyComponent = () => {
  const client = new RelayClient(); // Creates duplicate connections
};
```

### User Identity Persistence
For WebSocket connections, user identity should persist across navigation:
- Use `sessionStorage` for anonymous users
- Integrate with `useCurrentUser` for authenticated users
- Pass `userId` param in WebSocket URL for identity

### Cross-Component State Sync
For state synchronization across disconnected components (e.g., updating sidebar after initiative creation):
- Use global event listeners (`window.addEventListener`) to trigger refetches
- Alternatively, use React Query's `invalidateQueries` if using that library

## Component Patterns

### Modular Hooks
Break complex UI logic into reusable hooks:
- `useQuestionNotifications` - notification state management
- `useActiveChannels` - channel subscription handling

This improves testability and organization.

### Idempotent Initialization
Ensure initialization logic (relay connections, agent setup) handles being called multiple times without side effects.

## Type Safety

### Backend/Frontend Contract
Maintain strict type consistency between backend API responses and frontend data models:
- Watch for mismatches like `Initiative` vs. `InitiativeWithPlanCounts`
- Check field naming: `msg.body` vs. `msg.content`
- Use `Omit` or `Pick` for precise typing where needed

Type mismatches cause silent failures in data display.

### Preserve API Data
Avoid client-side transformations that overwrite or zero out backend data:

```typescript
// WRONG: Overwrites plan_counts from API
const plans = apiResponse.plans.map(p => ({
  ...p,
  plan_counts: { draft: 0, approved: 0 }, // Destroys real data
}));

// CORRECT: Use API data as-is, transform only when necessary
const plans = apiResponse.plans;
```

If you need to add defaults for missing fields, use nullish coalescing:
```typescript
const count = plan.plan_counts?.draft ?? 0;
```

## Agent Identity

### Stable Agent IDs
When creating relay clients or agent services, use stable `agentId` values:
- Backend relay client should match process name (e.g., `planner-core`)
- Avoid dynamic IDs like `planner-lead-{timestamp}` which cause duplicate agent appearances

```typescript
// CORRECT: Stable agent ID
const agentId = 'planner-lead';

// WRONG: Dynamic ID causing duplicates
const agentId = `planner-lead-${Date.now()}`;
```
