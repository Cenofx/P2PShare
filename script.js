let peer = null;         
let connection = null;   
let myPeerId = null;     
let incomingFiles = {}; // Tempat menampung serpihan teks berkas yang masuk

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
    logContainer: document.getElementById('log-container')
};

function initDistributedNode() {
    addLog("[SYSTEM] Menginisialisasi Jaringan WebRTC Peer-to-Peer...", "system");
    
    // Konfigurasi STUN Server global agar bisa menembus batas jaringan Wi-Fi lokal
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
        addLog(`[SYSTEM] Node Anda aktif. ID terdistribusi Anda: ${id}`, "success");
    });

    peer.on('error', (err) => {
        ui.status.innerText = "Status: Gagal Terhubung Jaringan";
        ui.status.className = "status-text failed";
        addLog(`[ERROR] Masalah jaringan WebRTC: ${err.type}`, "failed");
    });

    peer.on('connection', (conn) => {
        connection = conn;
        setupConnectionListeners();
        addLog(`[P2P] Ada node teman (${conn.peer}) menghubungkan diri ke Anda!`, "p2p");
        updateUiConnected(conn.peer);
    });
}

ui.btnConnect.addEventListener('click', () => {
    const remoteId = ui.remoteIdInput.value.trim();
    if (!remoteId || !peer) return;
    addLog(`[P2P] Mencoba menghubungkan langsung ke ID: ${remoteId}...`, "p2p");
    ui.status.innerText = "Status: Mencoba Menghubungkan...";
    ui.btnConnect.disabled = true;
    
    // Mengaktifkan fitur reliable transfer agar paket teks tidak ada yang hilang di jalan
    connection = peer.connect(remoteId, { reliable: true });
    
    setTimeout(() => {
        if (ui.status.className !== "status-text connected") {
            addLog("[ERROR] Koneksi P2P gagal. Teman mungkin offline atau ID salah.", "failed");
            resetUiConnection();
        }
    }, 10000);
    setupConnectionListeners();
});

function setupConnectionListeners() {
    if (!connection) return;
    connection.on('open', () => {
        addLog(`[P2P] Terhubung langsung ke node teman: ${connection.peer}`, "success");
        updateUiConnected(connection.peer);
    });
    
    // RECEIVER: Protokol membaca aliran teks JSON yang sangat stabil
    connection.on('data', (rawData) => {
        try {
            // Deteksi dan terjemahkan bungkusan teks string kembali menjadi objek
            const message = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            
            if (!message) return;

            // 1. Menerima Header Informasi File
            if (message.type === 'file-start') {
                incomingFiles[message.filename] = {
                    fileType: message.fileType,
                    totalChunks: message.totalChunks,
                    chunks: new Array(message.totalChunks),
                    receivedCount: 0
                };
                addLog(`[P2P] Sinyal masuk teks berkas: "${message.filename}" (${message.totalChunks} paket)...`, "p2p");
            } 
            // 2. Menerima Serpihan Teks Base64 dan Menyusunnya Kembali
            else if (message.type === 'file-chunk') {
                const fileState = incomingFiles[message.filename];
                if (fileState) {
                    // Konversi Teks Base64 kembali menjadi biner murni secara aman di dalam HP
                    const binaryString = atob(message.data);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    fileState.chunks[message.index] = bytes.buffer;
                    fileState.receivedCount++;
                    
                    if (fileState.receivedCount === fileState.totalChunks) {
                        addLog(`[P2P] Sukses menerima seluruh paket berkas "${message.filename}"!`, "success");
                        
                        const blob = new Blob(fileState.chunks, { type: fileState.fileType });
                        const downloadUrl = URL.createObjectURL(blob);
                        
                        addLog(`[FILE-GET] Berhasil! -> <a href="${downloadUrl}" download="${message.filename}" class="btn-download">Klik untuk Simpan ke HP (${message.filename})</a>`, "file-get");
                        
                        delete incomingFiles[message.filename]; // Hapus memori tampungan agar HP tidak lag
                    }
                }
            }
        } catch (err) {
            // Mengabaikan jika ada kiriman teks non-JSON yang tidak sengaja masuk
        }
    });
    
    connection.on('close', () => {
        addLog(`[WARNING] Koneksi terputus.`, "system");
        resetUiConnection();
    });
}

ui.fileInput.addEventListener('change', (e) => {
    ui.btnSendFile.disabled = e.target.files.length === 0;
});

// SENDER: Protokol pemotong file menjadi teks string JSON berkelanjutan
ui.btnSendFile.addEventListener('click', () => {
    if (!connection) return;
    
    if (!ui.fileInput.files.length) {
        alert("Pilih file materi kuliahnya dulu, King!");
        return;
    }

    const file = ui.fileInput.files[0];
    addLog(`[SYSTEM] Membaca berkas kuliah: "${file.name}"`, "system");
    ui.btnSendFile.disabled = true;
    ui.progressWrapper.style.display = "block";
    ui.progressBar.value = 0;
    
    const CHUNK_SIZE = 32768; // Potongan teks aman berukuran 32KB
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Langkah 1: Kirim sinyal pembuka dalam bentuk teks string JSON
    connection.send(JSON.stringify({
        type: 'file-start',
        filename: file.name,
        fileType: file.type,
        totalChunks: totalChunks
    }));
    
    let offset = 0;
    let chunkIndex = 0;
    
    // Langkah 2: Alirkan serpihan berkas yang dikonversi ke teks secara bertahap
    function readAndStreamNextChunk() {
        if (chunkIndex < totalChunks) {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const fileReader = new FileReader();
            
            fileReader.onload = function(e) {
                // Ambil string mentah teks Base64
                const base64Data = e.target.result.split(',')[1];
                
                // Kirim paket berupa string JSON utuh
                connection.send(JSON.stringify({
                    type: 'file-chunk',
                    filename: file.name,
                    index: chunkIndex,
                    data: base64Data
                }));
                
                chunkIndex++;
                offset += CHUNK_SIZE;
                ui.progressBar.value = Math.round((chunkIndex / totalChunks) * 100);
                
                // Beri jeda 15 milidetik agar CPU handphone sempat memproses teksnya
                setTimeout(readAndStreamNextChunk, 15);
            };
            
            fileReader.readAsDataURL(slice);
        } else {
            addLog(`[SYSTEM] Sukses mengirim berkas "${file.name}" ke browser teman!`, "success");
            setTimeout(() => {
                ui.progressWrapper.style.display = "none";
                ui.btnSendFile.disabled = false;
                ui.fileInput.value = "";
            }, 1500);
        }
    }
    
    // Mulai proses aliran teks
    setTimeout(readAndStreamNextChunk, 200);
});

ui.btnCopyId.addEventListener('click', () => {
    if (!myPeerId) return;
    navigator.clipboard.writeText(myPeerId).then(() => {
        const originalText = ui.btnCopyId.innerHTML;
        ui.btnCopyId.innerHTML = "✅ Tersalin!";
        ui.btnCopyId.style.backgroundColor = "var(--success)";
        ui.btnCopyId.style.color = "#0f172a";
        addLog("[SYSTEM] ID Unik Anda berhasil disalin ke clipboard.", "success");
        setTimeout(() => {
            ui.btnCopyId.innerHTML = originalText;
            ui.btnCopyId.style.backgroundColor = "";
            ui.btnCopyId.style.color = "";
        }, 2000);
    }).catch(err => {
        addLog("[ERROR] Gagal menyalin ID otomatis.", "failed");
    });
});

function updateUiConnected(peerId) {
    ui.status.innerText = `Status: Terhubung P2P -> ${peerId}`;
    ui.status.className = "status-text connected";
    ui.transferPanel.style.opacity = "1";
    ui.transferPanel.style.pointerEvents = "auto";
    ui.remoteIdInput.disabled = true;
    ui.btnConnect.disabled = true;
}

function resetUiConnection() {
    connection = null;
    ui.status.innerText = "Status: Belum Terhubung";
    ui.status.className = "status-text pending";
    ui.transferPanel.style.opacity = "0.5";
    ui.transferPanel.style.pointerEvents = "none";
    ui.remoteIdInput.disabled = false;
    ui.remoteIdInput.value = "";
    ui.btnConnect.disabled = false;
}

function addLog(message, type) {
    const logContainer = ui.logContainer;
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("p");
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `[${time}] ${message}`; 
    logContainer.appendChild(entry);
}

window.addEventListener('load', initDistributedNode);
