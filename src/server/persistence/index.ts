export { FileStore } from './file';
export * from './types';

// The mongo/pg stores and their hybrids are intentionally NOT re-exported here: importing
// this barrel used to drag the mongodb and pg drivers into every consumer. Load them through
// ./provider, which imports each backend only when PERSISTENCE_PROVIDER selects it.
import { FileStore } from './file';
export default FileStore;
