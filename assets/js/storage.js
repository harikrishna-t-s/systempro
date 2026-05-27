class SystemProStorage {
    constructor() {
        this.dbName = 'SystemProDB';
        this.version = 2; // Incremented schema iteration
        this.db = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { this.db = request.result; resolve(); };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('entries')) {
                    db.createObjectStore('entries', { keyPath: 'id' });
                }
            };
        });
    }

    getAllEntries() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['entries'], 'readonly');
            const store = transaction.objectStore(['entries']);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    saveEntry(entry) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['entries'], 'readwrite');
            const store = transaction.objectStore(['entries']);
            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    deleteEntry(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['entries'], 'readwrite');
            const store = transaction.objectStore(['entries']);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
window.storageEngine = new SystemProStorage();
