import { createContext, useContext, useMemo, useState } from "react";

interface QueueSearchState {
  /** Current queue search term, shared between the sidebar and the overview. */
  query: string;
  setQuery: (query: string) => void;
}

const QueueSearchContext = createContext<QueueSearchState | undefined>(
  undefined,
);

/**
 * Provides the shared queue-search term. The search input lives in the sidebar
 * but the overview reads the same term, so both filter against one source.
 *
 * @param children - Subtree that can read/update the search term.
 */
export function QueueSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);

  return (
    <QueueSearchContext.Provider value={value}>
      {children}
    </QueueSearchContext.Provider>
  );
}

/** Access the shared queue-search term. Must be used within QueueSearchProvider. */
export const useQueueSearch = () => {
  const context = useContext(QueueSearchContext);
  if (context === undefined) {
    throw new Error("useQueueSearch must be used within a QueueSearchProvider");
  }
  return context;
};
