// Data State
let peer = null;         // Objek Node PeerJS kita
let connection = null;   // Objek koneksi ke peer lain
let myPeerId = null;     // ID kita

// Elemen UI
const ui = {
    myId: document.getElementById('my-peer-id'),
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

// ========================================================
// 1. Inisialisasi Jaringan Terdistribusi (Node Startup)
// ========================================================
function initDistributedNode() {
    addLog("[SYSTEM] Menginisialisasi Jaringan WebRTC Peer-to-Peer...", "system");
    
    // Membuat Node baru di jaringan. Jaringan PeerJS akan memberikan ID otomatis.
    peer = new Peer();

    // Event: Node berhasil terhubung ke server penemu jaringan
    peer.on('open', (id) => {
        myPeerId = id;
        ui.myId.innerText = id;
        ui.myId.style.color = "var(--success)";
        addLog(`[SYSTEM] Node Anda aktif. ID terdistribusi Anda: ${id}`, "success");
        addLog(`[SYSTEM] Bagikan ID ini ke teman kampus Anda.`, "system");
    });

    // Event: Kegagalan koneksi jaringan
    peer.on('error', (err) => {
        ui.status.innerText = "Status: Gagal Terhubung Jaringan";
        ui.status.className = "status-text failed";
        addLog(`[ERROR] Masalah jaringan WebRTC: ${err.type}`, "failed");
    });

    // ========================================================
    // 3. Menerima Koneksi Masuk (Bertindak Sebagai Server)
    // ========================================================
    peer.on('connection', (conn) => {
        // Menerima data stream dari peer lain
        connection = conn;
        setupConnectionListeners();
        addLog(`[P2P] Ada node teman (${conn.peer}) menghubungkan diri ke Anda!`, "p2p");
        updateUiConnected(conn.peer);
    });
}

// ========================================================
// 2. Menghubungkan ke Node Lain (Bertindak Sebagai Client)
// ========================================================
ui.btnConnect.addEventListener('click', () => {
    const remoteId = ui.remoteIdInput.value.trim();
    if (!remoteId || !peer) return;

    addLog(`[P2P] Mencoba menghubungkan langsung ke ID: ${remoteId}...`, "p2p");
    ui.status.innerText = "Status: Mencoba Menghubungkan...";
    ui.btnConnect.disabled = true;

    // Membuka koneksi data langsung (P2P) ke peer target
    connection = peer.connect(remoteId);
    
    // Jika koneksi gagal terbuka dalam 10 detik
    const failTimeout = setTimeout(() => {
        if (ui.status.className !== "status-text connected") {
            addLog("[ERROR] Koneksi P2P gagal. Teman mungkin offline atau ID salah.", "failed");
            resetUiConnection();
        }
    }, 10000);

    setupConnectionListeners();
});

// ========================================================
// 4. Logika Komunikasi Data Setelah Terhubung
// ========================================================
function setupConnectionListeners() {
    if (!connection) return;

    // Event: Koneksi P2P terbuka dan siap kirim data
    connection.on('open', () => {
        clearTimeout(); // Hapus timeout gagal jika ada
        addLog(`[P2P] Terhubung langsung ke node teman: ${connection.peer}`, "success");
        updateUiConnected(connection.peer);
    });

    // Event: MENERIMA DATA (Bisa berupa File atau Text)
    connection.on('data', (data) => {
        // JIKA DATA YANG DITERIMA ADALAH FILE (BLOB)
        if (data && data.file instanceof ArrayBuffer) {
            addLog(`[P2P] Menerima file materi kuliah: "${data.filename}"`, "p2p");
            
            // Konversi ArrayBuffer kembali menjadi File (Blob)
            const blob = new Blob([data.file], { type: data.fileType });
            const url = URL.createObjectURL(blob);
            
            // Tambahkan ke log sebagai link download nyata
            addLog(`[FILE-GET] Berhasil menerima file! -> <a href="${url}" download="${data.filename}" class="btn-download">Klik untuk Simpan ke Laptop (${data.filename})</a>`, "file-get");
        }
    });

    // Event: Koneksi P2P ditutup oleh pihak lawan
    connection.on('close', () => {
        addLog(`[WARNING] Teman kampus Anda (${connection.peer}) telah memutus koneksi.`, "system");
        resetUiConnection();
    });
}

// ========================================================
// 5. Mengirim File Nyata (tanpa server pusat)
// ========================================================
ui.fileInput.addEventListener('change', (e) => {
    ui.btnSendFile.disabled = e.target.files.length === 0;
});

ui.btnSendFile.addEventListener('click', async () => {
    if (!connection || !ui.fileInput.files.length) return;

    const file = ui.fileInput.files[0];
    addLog(`[SYSTEM] Mulai mengirim file: "${file.name}" via P2P...`, "system");
    
    ui.btnSendFile.disabled = true;
    ui.progressWrapper.style.display = "block";
    ui.progressBar.value = 0;

    // Kita harus membaca file menjadi ArrayBuffer agar bisa dikirim lewat WebRTC
    const fileReader = new FileReader();
    
    fileReader.onload = (e) => {
        const buffer = e.target.result;
        
        // Membuat objek data file untuk dikirim
        const dataToSend = {
            filename: file.name,
            fileType: file.type,
            file: buffer // Buffer biner file nyata
        };

        // KIRIM DATA LANGSUNG (P2P) Lewat Jaringan Terdistribusi WebRTC
        connection.send(dataToSend);
        
        // Simulasi progres sukses (WebRTC Data Channel tidak memberikan progres native)
        ui.progressBar.value = 100;
        addLog(`[SYSTEM] Berhasil mengirim file "${file.name}" ke browser teman!`, "success");
        
        // Reset UI setelah kirim
        setTimeout(() => {
            ui.progressWrapper.style.display = "none";
            ui.btnSendFile.disabled = false;
            ui.fileInput.value = "";
        }, 1500);
    };

    fileReader.onerror = () => {
        addLog(`[ERROR] Gagal membaca file untuk pengiriman.`, "failed");
    };

    // Mulai membaca file
    fileReader.readAsArrayBuffer(file);
});


// Helper UI
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
    entry.innerHTML = `[${time}] ${message}`; // Gunakan innerHTML agar bisa merender link download
    logContainer.appendChild(entry);
}

// Jalankan Node Terdistribusi Kelompok 4
window.addEventListener('load', initDistributedNode);