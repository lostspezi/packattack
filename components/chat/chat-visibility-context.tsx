"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "pa:chat:collapsed";

interface ChatVisibilityValue {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
}

const ChatVisibilityContext = createContext<ChatVisibilityValue>({
  collapsed: false,
  setCollapsed: () => {},
  toggle: () => {},
});

export function useChatVisibility(): ChatVisibilityValue {
  return useContext(ChatVisibilityContext);
}

export function ChatVisibilityProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- hydrate persisted preference once on mount */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setCollapsedState(true);
      }
    } catch {
      // ignore storage access errors
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // ignore storage write errors
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage write errors
      }
      return next;
    });
  }, []);

  return (
    <ChatVisibilityContext.Provider value={{ collapsed, setCollapsed, toggle }}>
      {children}
    </ChatVisibilityContext.Provider>
  );
}
