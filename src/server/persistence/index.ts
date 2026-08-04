export { FileStore } from './file';
export * from './types';

// The mongo store and its hybrid are intentionally NOT re-exported here: importing this
// barrel used to drag the mongodb driver into every consumer. Load it through ./provider,
// which imports each backend only when PERSISTENCE_PROVIDER selects it.
import { FileStore } from './file';
export default FileStore;
