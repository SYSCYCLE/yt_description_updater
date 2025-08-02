const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');


const PORT = process.env.PORT || 3000;

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const CHECK_INTERVAL = 60000; 

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

let currentDescription = 'Henüz veri çekilmedi.';
let lastCheckStatus = 'Başlatılıyor...';

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

async function fetchAndCheckDescription() {
    try {
        const statusMessage = `[${new Date().toLocaleTimeString()}] Video sayfası kontrol ediliyor...`;
        console.log(statusMessage);
        lastCheckStatus = statusMessage;

        const { data } = await axios.get(VIDEO_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(data);
        
        const newDescription = $('#description-inner #description yt-formatted-string').text().trim();

        if (!newDescription) {
            console.warn('Açıklama metni bulunamadı. YouTube HTML yapısı değişmiş olabilir.');
            lastCheckStatus = 'Hata: Açıklama metni sayfada bulunamadı.';
            broadcast({ type: 'status', status: lastCheckStatus });
            return;
        }

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
            broadcast({ type: 'status', status: lastCheckStatus });
        }

    } catch (error) {
        console.error('Sayfa çekilirken bir hata oluştu:', error.message);
        lastCheckStatus = `Hata: Sayfa çekilemedi (${error.message})`;
        broadcast({ type: 'status', status: lastCheckStatus });
    }
}

server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde başlatıldı.`);
    
    fetchAndCheckDescription();
    
    setInterval(fetchAndCheckDescription, CHECK_INTERVAL);
});
