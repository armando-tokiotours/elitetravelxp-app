"use client";

import { createContext, useContext } from "react";

/** Widget / progress-bar edit targets for Builder M. */
export type BuilderEditModalId =
  | "duration"
  | "guests"
  | "transit"
  | "locations"
  | "hotels_transport"
  | "tours"
  | "drivers"
  | null;

type BuilderEditModalCtx = {
  activeEditModal: BuilderEditModalId;
  openEditModal: (id: Exclude<BuilderEditModalId, null>) => void;
  closeEditModal: () => void;
};

const Ctx = createContext<BuilderEditModalCtx | null>(null);

export function BuilderEditModalProvider({
  value,
  children,
}: {
  value: BuilderEditModalCtx;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBuilderEditModal() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useBuilderEditModal must be used within BuilderEditModalProvider"
    );
  }
  return ctx;
}

export function useBuilderEditModalOptional() {
  return useContext(Ctx);
}
