let peer = null;         
let connection = null;   
let myPeerId = null;     

// State terdistribusi untuk menampung serpihan berkas (chunks) yang masuk
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
    logContainer: document.getElementById('log-container')
};

function initDistributedNode() {
    addLog("[SYSTEM] Menginisialisasi Jaringan WebRTC Peer-to-Peer...", "system");
    
    // OPTIMASI JARINGAN: Menggunakan Google STUN Server agar tembus blokir antar jaringan (Wi-Fi vs Seluler)
    peer = new Peer({
        config: {
            'iceServers': [
                { url: 'stun:stun.l.google.com:19302' },
                { url: 'stun:stun1.l.google.com:19302' },
                { url: 'stun:stun2.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', (id) => {
        myPeerId = id;
        ui.myId.innerText = id;
        ui.myId.style.color = "var(--success)";
        ui.btnCopyId.disabled = false;
        addLog(`[SYSTEM] Node Anda aktif. ID terdistribusi Anda: ${id}`, "success");
        addLog(`[SYSTEM] Bagikan ID ini ke teman kampus Anda.`, "system");
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
    connection = peer.connect(remoteId);
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
    
    // PROTOKOL PENERIMAAN PAKET DATA (CHUNK ASSEMBLY)
    connection.on('data', (data) => {
        if (!data) return;

        // Langkah 1: Menerima Informasi Awal Berkas (Header)
        if (data.type === 'file-start') {
            incomingFiles[data.filename] = {
                fileType: data.fileType,
                totalChunks: data.totalChunks,
                chunks: new Array(data.totalChunks),
                receivedCount: 0
            };
            addLog(`[P2P] Sinyal masuk berkas: "${data.filename}" (${data.totalChunks} paket data)...`, "p2p");
        } 
        // Langkah 2: Menerima Serpihan Berkas dan Menjahitnya Kembali
        else if (data.type === 'file-chunk') {
            const fileState = incomingFiles[data.filename];
            if (fileState) {
                fileState.chunks[data.index] = data.data;
                fileState.receivedCount++;
                
                // Jika semua paket serpihan sudah lengkap terkumpul
                if (fileState.receivedCount === fileState.totalChunks) {
                    addLog(`[P2P] Semua paket berkas "${data.filename}" sukses diterima! Menyusun file...`, "p2p");
                    
                    // Satukan serpihan biner murni menjadi Blob tunggal siap unduh
                    const blob = new Blob(fileState.chunks, { type: fileState.fileType });
                    const downloadUrl = URL.createObjectURL(blob);
                    
                    addLog(`[FILE-GET] Berhasil! -> <a href="${downloadUrl}" download="${data.filename}" class="btn-download">Klik untuk Simpan (${data.filename})</a>`, "file-get");
                    
                    // Bersihkan memori RAM dari state tampungan
                    delete incomingFiles[data.filename];
                }
            }
        }
    });
    
    connection.on('close', () => {
        addLog(`[WARNING] Teman kampus Anda (${connection.peer}) telah memutus koneksi.`, "system");
        resetUiConnection();
    });
}

ui.fileInput.addEventListener('change', (e) => {
    ui.btnSendFile.disabled = e.target.files.length === 0;
});

// PROTOKOL PENGIRIMAN DATA BERTAHAP (DATA CHUNKING STREAM)
ui.btnSendFile.addEventListener('click', () => {
    if (!connection) return;
    
    if (!ui.fileInput.files.length) {
        addLog("[WARNING] Gagal mengirim: Silakan pilih file terlebih dahulu!", "system");
        alert("Pilih file materi kuliahnya dulu, King!");
        return;
    }

    const file = ui.fileInput.files[0];
    addLog(`[SYSTEM] Membaca berkas kuliah: "${file.name}"`, "system");
    ui.btnSendFile.disabled = true;
    ui.progressWrapper.style.display = "block";
    ui.progressBar.value = 0;
    
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
        const arrayBuffer = e.target.result;
        const CHUNK_SIZE = 16384; // Potong berkas menjadi serpihan aman sebesar 16KB per paket
        const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
        
        addLog(`[SYSTEM] Memecah berkas menjadi ${totalChunks} paket data...`, "system");
        
        // KIRIM HEADER: Beritahu penerima nama berkas dan jumlah paketnya
        connection.send({
            type: 'file-start',
            filename: file.name,
            fileType: file.type,
            totalChunks: totalChunks
        });
        
        let chunkIndex = 0;
        
        // Fungsi rekursif untuk mengalirkan paket satu per satu dengan jeda aman
        function streamNextChunk() {
            if (chunkIndex < totalChunks) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(arrayBuffer.byteLength, start + CHUNK_SIZE);
                const chunk = arrayBuffer.slice(start, end);
                
                // Kirim serpihan paket ke-n
                connection.send({
                    type: 'file-chunk',
                    filename: file.name,
                    index: chunkIndex,
                    data: chunk
                });
                
                chunkIndex++;
                ui.progressBar.value = Math.round((chunkIndex / totalChunks) * 100);
                
                // Jeda rahasia 5ms agar buffer jaringan HP tidak meluap (overflow)
                setTimeout(streamNextChunk, 5);
            } else {
                addLog(`[SYSTEM] Sukses mengalirkan seluruh paket berkas "${file.name}"!`, "success");
                setTimeout(() => {
                    ui.progressWrapper.style.display = "none";
                    ui.btnSendFile.disabled = false;
                    ui.fileInput.value = "";
                }, 1500);
            }
        }
        
        // Mulai aliran streaming data
        setTimeout(streamNextChunk, 200);
    };
    
    fileReader.onerror = () => {
        addLog(`[ERROR] Gagal membaca berkas kuliah.`, "failed");
        ui.btnSendFile.disabled = false;
        ui.progressWrapper.style.display = "none";
    };
    fileReader.readAsArrayBuffer(file);
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
