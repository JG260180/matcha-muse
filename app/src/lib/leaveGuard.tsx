import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

// In-app navigation guard for half-finished reviews (owner request 2026-07-17).
// A page with unsaved work registers an interceptor; guarded links ask it
// before navigating. Returns true = intercepted (the page shows its own
// save/draft/delete dialog), false = navigate normally. Plain BrowserRouter
// has no useBlocker, hence this small context instead of a data router.

type Interceptor = (to: string) => boolean;

interface GuardContext {
  intercept: (to: string) => boolean;
  register: (fn: Interceptor | null) => void;
}

const Ctx = createContext<GuardContext>({ intercept: () => false, register: () => {} });

export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Interceptor | null>(null);
  const register = useCallback((fn: Interceptor | null) => { ref.current = fn; }, []);
  const intercept = useCallback((to: string) => ref.current?.(to) ?? false, []);
  return <Ctx.Provider value={{ intercept, register }}>{children}</Ctx.Provider>;
}

// Register while `fn` is non-null; pass null when there's nothing to guard.
// Re-registers every render (a ref assignment) so the interceptor never
// closes over stale state.
export function useLeaveGuard(fn: Interceptor | null) {
  const { register } = useContext(Ctx);
  useEffect(() => {
    register(fn);
    return () => register(null);
  });
}

// onClick for Links that must respect the guard. preventDefault stops the
// router navigation; the guarding page takes it from there.
export function useGuardedClick() {
  const { intercept } = useContext(Ctx);
  return (to: string) => (e: React.MouseEvent) => {
    if (intercept(to)) e.preventDefault();
  };
}
