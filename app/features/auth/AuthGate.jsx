'use client';

import { createContext, useContext } from "react";
import { useAuthState } from "./useAuthState";

/**
 * AuthContext is intentionally lightweight.
 * It must NEVER block rendering.
 */
const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isGuest: true,
  status: "guest",
});

/**
 * AuthGate
 *
 * - Always renders children
 * - Never redirects
 * - Never overlays
 * - Never blocks clicks
 *
 * Auth is OPTIONAL.
 */
export default function AuthGate({ children }) {
  const auth = useAuthState();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Optional helper hook for child components
 * that want to *know* auth state, but not depend on it.
 */
export function useAuth() {
  return useContext(AuthContext);
}
