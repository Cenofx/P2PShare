# ⚡ KampusP2PShare — Kelompok 4

Aplikasi berbagi file berbasis **Peer-to-Peer (P2P) Real-time** terdistribusi menggunakan teknologi **WebRTC** melalui library **PeerJS**. Dikembangkan khusus untuk mempermudah berbagi berkas kuliah secara langsung antar-browser (*Direct Node-to-Node Transfer*) tanpa melalui penyimpanan server pihak ketiga.

🔗 **Live Demo:** [p2-p-share-sigma.vercel.app](https://p2-p-share-sigma.vercel.app)

---

## 👥 Anggota Kelompok 4
*   **M.Aksan. R**(105841123024)
*   **Jabal**(1058411---24)
*   **Husain Abdulloh**(105841121524)
*   **Aulan**(105841114824)

---

## ✨ Fitur Utama
1.  **Koneksi P2P Jarak Jauh (STUN Engine):** Menggunakan Google STUN Server untuk menembus batasan jaringan (*NAT Traversal*) sehingga perangkat tetap bisa terhubung secara langsung meskipun berbeda provider internet (misal: Wi-Fi Rumah vs Paket Data HP).
2.  **Kotak Unduhan Khusus (Mobile-Friendly UX):** Memisahkan berkas masuk ke dalam kartu (*Card*) tersendiri dengan tombol unduh berukuran besar yang sangat nyaman ditekan lewat layar smartphone.
3.  **Konsol Log Sistem Real-time:** Menampilkan status *handshake*, transmisi *packet chunk*, hingga notifikasi eror secara visual dan interaktif.
4.  **Pengiriman Chunked Binary (Base64 Stream):** File dipecah menjadi bagian-bagian kecil berukuran 32KB sebelum dikirim agar transfer berjalan stabil tanpa membebani memori browser.
5.  **Zero Server Storage:** File langsung mengalir dari memori pengirim ke memori penerima, menjamin privasi penuh dan kecepatan maksimal.

---

## 🛠️ Teknologi yang Digunakan
*   **HTML5** & **CSS3** (Variabel Root Kustom, Tata Letak Grid, Pendekatan Responsif Mobile)
*   **JavaScript (Vanilla)** (Asynchronous Stream, FileReader API, Blob Object Constructor)
*   **PeerJS Library** (Abstraksi WebRTC Data Channel, Peer Connection Management)
*   **Google STUN Infrastructure** (`stun.l.google.com:19302`)

---

## 📂 Struktur Repositori
```text
├── index.html   # Struktur antarmuka dan panel kontrol node P2P
├── style.css    # Desain tema gelap modern (Modern Slate Dark theme)
├── script.js    # Logika WebRTC, chunk streaming, dan manajemen state UI
└── README.md    # Dokumentasi project utama
