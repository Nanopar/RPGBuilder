// 1. Force the Service Worker to take control immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// 2. The helper function to talk to IndexedDB (must be inside sw.js)
async function getHandleFromDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("EditorStorage", 1);
        request.onsuccess = () => {
            const db = request.result;
            // Make sure these names match what you used in your main.js!
            const tx = db.transaction("handles", "readonly");
            const store = tx.objectStore("handles");
            const getRequest = store.get("projectRoot");
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => reject();
        };
        request.onerror = () => reject();
    });
}

// 3. The main interceptor
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.pathname.startsWith('/RPGBuilder/preview/')) {
        event.respondWith(async function() {
            try {
                const handle = await getHandleFromDB();
                if (!handle) {
                    return new Response("No folder handle found in IndexedDB. Please pick a folder in the editor first.", { status: 404 });
                }

                let pathStr = url.pathname.replace('/RPGBuilder/preview/', '');
                
                if (pathStr === '' || pathStr.endsWith('/')) {
                    pathStr += '/preview/index.html';
                }

                const path = pathStr.split('/');
                
                let currentHandle = handle;
                for (let i = 0; i < path.length - 1; i++) {
                    currentHandle = await currentHandle.getDirectoryHandle(path[i]);
                }

                const fileHandle = await currentHandle.getFileHandle(path[path.length - 1]);
                const file = await fileHandle.getFile();

                return new Response(file, {
                    headers: { 'Content-Type': getMimeType(path[path.length - 1]) }
                });
            } catch (err) {
                console.error("Virtual Server Error:", err);
                return new Response("File not found in local project: " + url.pathname, { status: 404 });
            }
        }());
    }
});

function getMimeType(filename) {
    if (filename.endsWith('.html')) return 'text/html';
    if (filename.endsWith('.js')) return 'application/javascript';
    if (filename.endsWith('.css')) return 'text/css';
    if (filename.endsWith('.png')) return 'image/png';
    if (filename.endsWith('.json')) return 'application/json';
    return 'application/octet-stream';
}