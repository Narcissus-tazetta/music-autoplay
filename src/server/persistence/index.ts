// Only the store contracts live here. The concrete backends are NOT re-exported: this
// barrel used to drag the mongodb driver into every consumer. Load them through ./provider,
// which imports each backend only when PERSISTENCE_PROVIDER selects it.
export * from './types';
