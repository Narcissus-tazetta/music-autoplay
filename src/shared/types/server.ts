// Minimal server context type used by react-router loaders/actions
export type ServerContext = {
  // Socket server instance (kept generic to avoid circular imports)
  io: unknown;
};
