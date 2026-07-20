let peer = null;         
let connection = null;   
let myPeerId = null;     
let incomingFiles = {}; 

const ui = {
    myId: document.getElementById('my-peer-id'),
    btnCopyId: document.getElementById('btn-copy-id'),
    remoteIdInput: document.getElementById('remote-peer-id'),
    btnConnect: document.getElementById('btn-connect'),
    status: document.getElementById('connection-status'),
    transferPanel: document.getElementById('transfer-panel'),
    fileInput: document.getElementById('file-input'),
    btnSendFile: document.getElementById('btn-send-file'),
    progressWrapper: document.getElementById('send-progress'),
    progressBar: document.getElementById('send-progress-bar'),
    logContainer: document.getElementById('log-container'),
    filesList: document.getElementById('files-list'),
    noFilesMsg: document.getElementById('no-files-msg')
};

function initDistributedNode() {
    addLog("[SYSTEM] Menginisialisasi Jaringan WebRTC Peer-to-Peer...", "system");
    peer = new Peer({
        config: {
            'iceServers': [
                { url: 'stun:stun.l.google.com:19302' },
                { url: 'stun:stun1.l.google.com:19302' },
                { url: 'stun:stun2.l.google.com:19302' }
            ],
            'sdpSemantics': 'unified-plan'
        }
    });

    peer.on('open', (id) => {
        myPeerId = id;
        ui.myId.innerText = id;
        ui.myId.style.color = "var(--success)";
        ui.btnCopyId.disabled = false;
        addLog(`[SYSTEM] Node Anda aktif. ID: ${id}`, "success");
    });

    peer.on('error', (err) => {
        ui.status.innerText = "Status: Gagal Terhubung";
        ui.status.className = "status-text failed";
        addLog(`[ERROR] Jaringan WebRTC Error: ${err.type}`, "failed");
    });

    peer.on('connection', (conn) => {
        connection = conn;
        setupConnectionListeners();
        addLog(`[P2P] Ada node teman menghubungkan diri!`, "p2p");
        updateUiConnected(conn.peer);
    });
}

ui.btnConnect.addEventListener('click', () => {
    const remoteId = ui.remoteIdInput.value.trim();
    if (!remoteId || !peer) return;
    addLog(`[P2P] Mencoba menyambungkan ke: ${remoteId}...`, "p2p");
    ui.status.innerText = "Status: Menghubungkan...";
    ui.btnConnect.disabled = true;
    connection = peer.connect(remoteId, { reliable: true });
    setupConnectionListeners();
});

function setupConnectionListeners() {
    if (!connection) return;
    connection.on('open', () => {
        addLog(`[P2P] Terhubung langsung ke teman!`, "success");
        updateUiConnected(connection.peer);
    });
    
    connection.on('data', (rawData) => {
        try {
            const message = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            if (!message) return;

            if (message.type === 'file-start') {
                incomingFiles[message.filename] = {
                    fileType: message.fileType,
                    totalChunks: message.totalChunks,
                    chunks: new Array(message.totalChunks),
                    receivedCount: 0
                };
                addLog(`[P2P] Menerima paket file Teks JSON: "${message.filename}"`, "p2p");
            } 
            else if (message.type === 'file-chunk') {
                const fileState = incomingFiles[message.filename];
                if (fileState) {
                    const binaryString = atob(message.data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    fileState.chunks[message.index] = bytes.buffer;
                    fileState.receivedCount++;
                    
                    if (fileState.receivedCount === fileState.totalChunks) {
                        addLog(`[P2P] File "${message.filename}" selesai disusun!`, "success");
                        
                        const blob = new Blob(fileState.chunks, { type: fileState.fileType });
                        const downloadUrl = URL.createObjectURL(blob);
                        
                        if (ui.noFilesMsg) ui.noFilesMsg.style.display = 'none';

                        const row = document.createElement('div');
                        row.className = 'file-row received';
                        row.innerHTML = `
                            <div class="file-info">
                                <span class="file-icon">📥</span>
                                <div class="file-details">
                                    <span class="file-name">${message.filename}</span>
                                    <span class="file-meta">Diterima • Sukses</span>
                                </div>
                            </div>
                            <a href="${downloadUrl}" download="${message.filename}" class="btn-download-action">📥 Simpan Ke HP</a>
                        `;
                        ui.filesList.appendChild(row);
                        
                        delete incomingFiles[message.filename];
                    }
                }
            }
        } catch (err) {}
    });
    
    connection.on('close', () => {
        addLog(`[WARNING] Koneksi terputus.`, "system");
        resetUiConnection();
    });
}

ui.fileInput.addEventListener('change', (e) => {
    ui.btnSendFile.disabled = e.target.files.length === 0;
});

ui.btnSendFile.addEventListener('click', () => {
    if (!connection || !ui.fileInput.files.length) return;

    const file = ui.fileInput.files[0];
    addLog(`[SYSTEM] Mengirim berkas: "${file.name}"`, "system");
    ui.btnSendFile.disabled = true;
    ui.progressWrapper.style.display = "block";
    ui.progressBar.value = 0;
    
    const CHUNK_SIZE = 32768; 
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    connection.send(JSON.stringify({
        type: 'file-start',
        filename: file.name,
        fileType: file.type,
        totalChunks: totalChunks
    }));
    
    let offset = 0;
    let chunkIndex = 0;
    
    function readAndStreamNextChunk() {
        if (chunkIndex < totalChunks) {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const fileReader = new FileReader();
            
            fileReader.onload = function(e) {
                const base64Data = e.target.result.split(',')[1];
                connection.send(JSON.stringify({
                    type: 'file-chunk',
                    filename: file.name,
                    index: chunkIndex,
                    data: base64Data
                }));
                
                chunkIndex++;
                offset += CHUNK_SIZE;
                ui.progressBar.value = Math.round((chunkIndex / totalChunks) * 100);
                setTimeout(readAndStreamNextChunk, 15);
            };
            fileReader.readAsDataURL(slice);
        } else {
            addLog(`[SYSTEM] Berhasil mengirim "${file.name}"`, "success");
            
            if (ui.noFilesMsg) ui.noFilesMsg.style.display = 'none';
            const row = document.createElement('div');
            row.className = 'file-row sent';
            row.innerHTML = `
                <div class="file-info">
                    <span class="file-icon">📤</span>
                    <div class="file-details">
                        <span class="file-name">${file.name}</span>
                        <span class="file-meta">Terkirim • Sukses</span>
                    </div>
                </div>
                <span style="color: var(--primary); font-size: 0.85rem; font-weight: bold;">Terkirim</span>
            `;
            ui.filesList.appendChild(row);

            setTimeout(() => {
                ui.progressWrapper.style.display = "none";
                ui.btnSendFile.disabled = false;
                ui.fileInput.value = "";
            }, 1500);
        }
    }
    setTimeout(readAndStreamNextChunk, 200);
});

ui.btnCopyId.addEventListener('click', () => {
    if (!myPeerId) return;
    navigator.clipboard.writeText(myPeerId).then(() => {
        const originalText = ui.btnCopyId.innerHTML;
        ui.btnCopyId.innerHTML = "✅ Tersalin!";
        setTimeout(() => { ui.btnCopyId.innerHTML = originalText; }, 2000);
    });
});

function updateUiConnected(peerId) {
    ui.status.innerText = `Status: Terhubung -> ${peerId}`;
    ui.status.className = "status-text connected";
    ui.transferPanel.style.opacity = "1";
    ui.transferPanel.style.pointerEvents = "auto";
}

function resetUiConnection() {
    connection = null;
    ui.status.innerText = "Status: Belum Terhubung";
    ui.status.className = "status-text pending";
    ui.transferPanel.style.opacity = "0.5";
    ui.transferPanel.style.pointerEvents = "none";
}

function addLog(message, type) {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("p");
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `[${time}] ${message}`; 
    ui.logContainer.appendChild(entry);
}

window.addEventListener('load', initDistributedNode);