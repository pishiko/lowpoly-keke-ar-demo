// Only the most recent photo is retained locally; no camera data leaves the device.
async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('keke-pocket', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function lastPhoto(blob) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('photos', blob ? 'readwrite' : 'readonly');
      const request = blob ? tx.objectStore('photos').put(blob, 'last') : tx.objectStore('photos').get('last');
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
