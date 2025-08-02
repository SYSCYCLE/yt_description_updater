const statusDiv = document.getElementById('status');
const descriptionDisplay = document.getElementById('descriptionDisplay');

const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const wsUrl = `${wsProtocol}${window.location.host}`;

console.log(`Sunucuya bağlanılıyor: ${wsUrl}`);
const socket = new WebSocket(wsUrl);

socket.onopen = () => {
    console.log('Sunucuya başarıyla bağlandı!');
    statusDiv.textContent = 'Durum: Sunucuya bağlı. İlk veri bekleniyor...';
};

socket.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);

        if (data.status) {
            statusDiv.textContent = `Durum: ${data.status}`;
        }
        
        if (data.type === 'update') {
            console.log('Açıklama güncellemesi alındı.');
            const displayText = data.description || "[Açıklama bulunamadı veya boş]";
            descriptionDisplay.textContent = displayText;
        }

    } catch (error) {
        console.error('Gelen veri işlenirken hata oluştu:', error);
        descriptionDisplay.textContent = 'Sunucudan gelen veri işlenemedi.';
    }
};

socket.onclose = () => {
    console.error('Sunucu bağlantısı koptu!');
    statusDiv.textContent = 'Hata: Sunucu bağlantısı kesildi. Sayfa birkaç saniye içinde yeniden bağlanmayı deneyecek.';
    statusDiv.style.color = '#ff6b6b';
    setTimeout(() => window.location.reload(), 5000);
};

socket.onerror = (error) => {
    console.error('WebSocket Hatası:', error);
    statusDiv.textContent = 'Hata: Bağlantı kurulamadı. Sunucunun çalıştığından emin olun.';
    statusDiv.style.color = '#ff6b6b';
};
