/**
 * IndexedDB 存储封装
 *
 * 提供简化的异步 API 替代 localStorage，突破 5-10MB 和同步阻塞的限制。
 * 存储格式：每个 store 使用 { key, value } 结构（keyPath: 'key'），
 * 外部调用方只需关心 key 和 value。
 */

/**
 * 打开/创建 IndexedDB 数据库
 *
 * @param {string} name - 数据库名称
 * @param {number} version - 版本号（递增以触发 onupgradeneeded）
 * @param {Record<string, object>} stores - { storeName: IDBObjectStoreParameters }
 * @returns {Promise<IDBDatabase>}
 */
export function openDB(name, version, stores) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not available'));
    }

    const request = indexedDB.open(name, version);

    request.onupgradeneeded = (event) => {
      const db = /** @type {IDBDatabase} */ (event.target.result);
      for (const [storeName, opts] of Object.entries(stores)) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, opts);
        }
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };

    request.onblocked = () => {
      reject(new Error('Database blocked — close other tabs using this DB'));
    };
  });
}

/**
 * 写入一条记录
 *
 * @param {IDBDatabase} db
 * @param {string} store - object store 名称
 * @param {string} key - 记录的 key
 * @param {*} value - 任意可序列化的值
 * @returns {Promise<void>}
 */
export function put(db, store, key, value) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      const objectStore = tx.objectStore(store);
      const request = objectStore.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 读取一条记录
 *
 * @param {IDBDatabase} db
 * @param {string} store - object store 名称
 * @param {string} key - 记录的 key
 * @returns {Promise<*>} 存储的 value，不存在时返回 undefined
 */
export function get(db, store, key) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store, 'readonly');
      const objectStore = tx.objectStore(store);
      const request = objectStore.get(key);

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : undefined);
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 读取 store 中所有记录的 value 数组
 *
 * @param {IDBDatabase} db
 * @param {string} store - object store 名称
 * @returns {Promise<Array<*>>}
 */
export function getAll(db, store) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store, 'readonly');
      const objectStore = tx.objectStore(store);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve((request.result || []).map((item) => item.value));
      };
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 清空整个 store
 *
 * @param {IDBDatabase} db
 * @param {string} store - object store 名称
 * @returns {Promise<void>}
 */
export function clearStore(db, store) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(store, 'readwrite');
      const objectStore = tx.objectStore(store);
      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}
