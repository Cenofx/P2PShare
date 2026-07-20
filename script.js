let peer = null;         
let connection = null;   
let myPeerId = null;     

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
    connection.on('data', (data) => {
        if (data && data.type === 'file-transfer') {
            addLog(`[P2P] Menerima file materi kuliah: "${data.filename}"`, "p2p");
            addLog(`[FILE-GET] Berhasil menerima file! -> <a href="${data.fileData}" download="${data.filename}" class="btn-download">Klik untuk Simpan ke Laptop (${data.filename})</a>`, "file-get");
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
    if (!connection || !ui.fileInput.files.length) return;
    const file = ui.fileInput.files[0];
    addLog(`[SYSTEM] Mulai mengirim file: "${file.name}" via P2P...`, "system");
    ui.btnSendFile.disabled = true;
    ui.progressWrapper.style.display = "block";
    ui.progressBar.value = 0;
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
        const base64Data = e.target.result; 
        const dataToSend = {
            type: 'file-transfer',
            filename: file.name,
            fileData: base64Data
        };
        connection.send(dataToSend);
        ui.progressBar.value = 100;
        addLog(`[SYSTEM] Berhasil mengirim file "${file.name}" ke browser teman!`, "success");
        setTimeout(() => {
            ui.progressWrapper.style.display = "none";
            ui.btnSendFile.disabled = false;
            ui.fileInput.value = "";
        }, 1500);
    };
    fileReader.onerror = () => {
        addLog(`[ERROR] Gagal membaca file untuk pengiriman.`, "failed");
    };
    fileReader.readAsDataURL(file);
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
