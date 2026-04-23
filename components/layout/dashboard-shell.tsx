"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  ChatVisibilityProvider,
  useChatVisibility,
} from "@/components/chat/chat-visibility-context";

function Inner({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { collapsed } = useChatVisibility();
  return (
    <div
      className={`flex flex-1 flex-col transition-[padding] duration-300 ease-out ${
        collapsed ? "" : "xl:pr-[420px]"
      }`}
      style={style}
    >
      {children}
    </div>
  );
}

export function DashboardShell({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <ChatVisibilityProvider>
      <Inner style={style}>{children}</Inner>
    </ChatVisibilityProvider>
  );
}
