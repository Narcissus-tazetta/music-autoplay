const DB_NAME = 'MusicAutoPlayDB';
const DB_VERSION = 1;
const STORE_NAME = 'backgroundImages';

interface ImageData {
    id: string;
    data: string;
    fileName?: string;
    timestamp: number;
}

class IndexedDBManager {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(new Error('IndexedDBの初期化に失敗しました'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async saveImage(imageData: string, fileName?: string): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('データベースが初期化されていません'));
                return;
            }

            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const data: ImageData = {
                id: 'backgroundImage',
                data: imageData,
                fileName: fileName,
                timestamp: Date.now(),
            };

            const request = store.put(data);

            request.onerror = () => {
                reject(new Error('画像の保存に失敗しました'));
            };

            request.onsuccess = () => {
                resolve();
            };
        });
    }

    async getImage(): Promise<{ data: string; fileName?: string } | null> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('データベースが初期化されていません'));
                return;
            }

            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('backgroundImage');

            request.onerror = () => {
                reject(new Error('画像の取得に失敗しました'));
            };

            request.onsuccess = () => {
                const result = request.result as ImageData | undefined;
                resolve(result ? { data: result.data, fileName: result.fileName } : null);
            };
        });
    }

    async deleteImage(): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('データベースが初期化されていません'));
                return;
            }

            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete('backgroundImage');

            request.onerror = () => {
                reject(new Error('画像の削除に失敗しました'));
            };

            request.onsuccess = () => {
                resolve();
            };
        });
    }
}

export const indexedDBManager = new IndexedDBManager();
