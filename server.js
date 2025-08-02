const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
// Cheerio'ya artık ihtiyacımız yok, ancak kaldırmasanız da sorun olmaz.
// const cheerio = require('cheerio'); 
const path = require('path');

const PORT = process.env.PORT || 3000;

// DÜZELTME 1: Kısa youtu.be linki yerine tam www.youtube.com linkini kullanmak daha güvenilirdir.
const VIDEO_URL = 'https://www.youtube.com/watch?v=tydGAb6HCHA';

const CHECK_INTERVAL = 60000; // 60 saniye

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

let currentDescription = 'Henüz veri çekilmedi.';
let lastCheckStatus = 'Başlatılıyor...';

// --- WebSocket fonksiyonları (değişiklik yok) ---
wss.on('connection', (ws) => {
    console.log('Bir istemci bağlandı.');
    ws.send(JSON.stringify({ 
        type: 'update', 
        description: currentDescription,
        status: lastCheckStatus 
    }));
    
    ws.on('close', () => {
        console.log('Bir istemci bağlantısı kesildi.');
    });
});

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
// --- WebSocket fonksiyonları sonu ---


// DÜZELTME 2: Açıklamayı bulma fonksiyonu tamamen yeniden yazıldı.
async function fetchAndCheckDescription() {
    try {
        const statusMessage = `[${new Date().toLocaleTimeString()}] Video sayfası kontrol ediliyor...`;
        console.log(statusMessage);
        lastCheckStatus = statusMessage;

        const { data: pageHtml } = await axios.get(VIDEO_URL, {
            headers: {
                // Gerçek bir tarayıcı gibi davranmak için başlıkları güçlendirelim
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8'
            }
        });
        
        // 1. Sayfa içindeki script etiketlerinden doğru olanı bul.
        // YouTube, sayfa verilerini "ytInitialData" adlı bir JavaScript değişkenine yazar.
        const match = pageHtml.match(/var ytInitialData = (.*);<\/script>/);

        if (!match || !match[1]) {
            throw new Error('Sayfa yapısı değişmiş, "ytInitialData" bloğu bulunamadı.');
        }

        // 2. Bulunan bloğu temizleyip JSON olarak ayrıştır.
        const ytInitialData = JSON.parse(match[1]);

        // 3. Ayrıştırılan JSON verisi içinde açıklamanın olduğu yola git.
        // Bu yol, YouTube'un yapısına göre çok karmaşık görünebilir. Bu normaldir.
        // Opsiyonel zincirleme (?.) kullanarak, bir anahtar bulunamazsa kodun çökmesini engelliyoruz.
        const contents = ytInitialData?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
        
        if (!contents) {
            throw new Error('JSON yapısı değişmiş, "contents" bloğu bulunamadı.');
        }
        
        // 'videoSecondaryInfoRenderer' anahtarını içeren objeyi buluyoruz. Açıklama bunun içindedir.
        const secondaryInfo = contents.find(c => c.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;
        const newDescription = secondaryInfo?.attributedDescription?.content;
        
        if (newDescription === undefined || newDescription === null) {
            throw new Error('JSON yapısı değişmiş, açıklama metni bulunamadı.');
        }

        // 4. Açıklamayı karşılaştır ve yayınla
        if (newDescription !== currentDescription) {
            console.log('DEĞİŞİKLİK TESPİT EDİLDİ!');
            currentDescription = newDescription;
            lastCheckStatus = `Başarılı: Açıklama ${new Date().toLocaleTimeString()}'de güncellendi.`;
            broadcast({ 
                type: 'update', 
                description: currentDescription,
                status: lastCheckStatus
            }); 
        } else {
            console.log('Değişiklik yok.');
            lastCheckStatus = `Başarılı: Değişiklik yok. Son kontrol ${new Date().toLocaleTimeString()}`;
            // Durum güncellemesini yine de gönderelim
            broadcast({ type: 'status', status: lastCheckStatus });
        }

    } catch (error) {
        console.error('Veri işlenirken bir hata oluştu:', error.message);
        // Hatayı tarayıcıya da bildirelim ki sorunu görebilesiniz
        lastCheckStatus = `Hata: ${error.message}`;
        broadcast({ 
            type: 'update',
            description: `Açıklama alınırken bir sorun oluştu.\n\nDetaylar: ${error.message}\n\nLütfen sunucu loglarını kontrol edin.`,
            status: lastCheckStatus 
        });
    }
}

// Sunucuyu başlatma (değişiklik yok)
server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde başlatıldı.`);
    
    // Uygulama başlar başlamaz ilk kontrolü yap
    fetchAndCheckDescription();
    
    // Belirlenen aralıklarla kontrolü tekrarla
    setInterval(fetchAndCheckDescription, CHECK_INTERVAL);
});
