export const indexedDBManager = {
  get(key: string) {
    void key;
    return Promise.resolve<null>(null);
  },
  set(key: string, value: unknown) {
    void key;
    void value;
    return Promise.resolve(true);
  },
  delete(key: string) {
    void key;
    return Promise.resolve(true);
  },
  getImage(): Promise<{ data: string; fileName?: string } | null> {
    return Promise.resolve(null);
  },
  saveImage(data: string | ArrayBuffer, name?: string) {
    void data;
    void name;
    return Promise.resolve(true);
  },
  deleteImage() {
    return Promise.resolve(true);
  },
};
