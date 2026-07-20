let peer = null;         
let connection = null;   
let myPeerId = null;     
let currentTransferHeader = null; // State terdistribusi untuk menyimpan informasi file yang akan datang

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
    peer = new Peer();
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
    
    // LISTENER PROTOKOL BARU
    connection.on('data', (data) => {
        // Cek jika yang masuk adalah Paket 1: Sinyal Metadata Control
        if (data && data.type === 'metadata') {
            currentTransferHeader = data;
            addLog(`[P2P] Sinyal masuk terdeteksi untuk berkas: "${data.filename}"`, "p2p");
        } 
        // Cek jika data yang masuk setelahnya adalah Paket 2: Data Biner Mentah
        else if (data) {
            const isBinary = data instanceof ArrayBuffer || data instanceof Blob || data.byteLength !== undefined || data.size !== undefined;
            
            if (isBinary && currentTransferHeader) {
                addLog(`[P2P] Menjahit paket biner untuk berkas "${currentTransferHeader.filename}"...`, "p2p");
                
                // Konversi aman biner murni lintas platform menjadi Blob lokal siap unduh
                const blob = new Blob([data], { type: currentTransferHeader.fileType });
                const downloadUrl = URL.createObjectURL(blob);
                
                addLog(`[FILE-GET] Berhasil menerima file! -> <a href="${downloadUrl}" download="${currentTransferHeader.filename}" class="btn-download">Klik untuk Simpan (${currentTransferHeader.filename})</a>`, "file-get");
                
                // Reset state untuk mengosongkan antrean file berikutnya
                currentTransferHeader = null;
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

ui.btnSendFile.addEventListener('click', () => {
    if (!connection) return;
    
    if (!ui.fileInput.files.length) {
        addLog("[WARNING] Gagal mengirim: Silakan pilih file terlebih dahulu!", "system");
        alert("Pilih file materi kuliahnya dulu, King!");
        return;
    }

    const file = ui.fileInput.files[0];
    addLog(`[SYSTEM] Mempersiapkan pengiriman berkas: "${file.name}"`, "system");
    ui.btnSendFile.disabled = true;
    ui.progressWrapper.style.display = "block";
    ui.progressBar.value = 20;
    
    // LANGKAH 1: Kirim Metadata Kontrol Terlebih Dahulu
    connection.send({
        type: 'metadata',
        filename: file.name,
        fileType: file.type
    });
    
    ui.progressBar.value = 50;
    
    // LANGKAH 2: Baca berkas sebagai ArrayBuffer (Biner murni level rendah) dan langsung alirkan
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
        addLog(`[SYSTEM] Mengalirkan payload biner via WebRTC DataChannel...`, "system");
        try {
            // Kirim langsung biner tingkat atas tanpa dibungkus objek JSON kustom
            connection.send(e.target.result);
            
            ui.progressBar.value = 100;
            addLog(`[SYSTEM] Berhasil mengirim file "${file.name}" ke browser teman!`, "success");
            setTimeout(() => {
                ui.progressWrapper.style.display = "none";
                ui.btnSendFile.disabled = false;
                ui.fileInput.value = "";
            }, 1500);
        } catch (err) {
            addLog(`[ERROR] Gagal transfer biner murni: ${err.message}`, "failed");
            ui.btnSendFile.disabled = false;
            ui.progressWrapper.style.display = "none";
        }
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
    currentTransferHeader = null;
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
