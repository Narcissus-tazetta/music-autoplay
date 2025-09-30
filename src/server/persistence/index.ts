export * from "./file";
export * from "./hybrid";
export * from "./pg";
export * from "./types";

import { FileStore } from "./file";
const defaultFileStore = new FileStore();
export { defaultFileStore };
export default FileStore;
