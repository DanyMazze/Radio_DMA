const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
// Creiamo un server HTTP basato sulle impostazioni di Express
const server = http.createServer(app);

// Inizializziamo il server WebSocket agganciandolo allo stesso server HTTP (condivisione porta)
const wss = new WebSocket.Server({ server });

// SERVIZIO FILE STATICI (EXPRESS):
// Rende accessibili al browser tutti i file contenuti nella cartella 'public' (HTML, CSS, JS, file audio)
app.use(express.static(path.join(__dirname, 'public')));

// STATO DEL SERVER (IL SERVER FA DA DJ AUTOMATICO):
// Scaletta dei brani disponibili nella cartella 'public/music/'
const playlist = [
    { id: 1, title: "Traccia 1", file: "/music/musica1.mp3" },
    { id: 2, title: "Traccia 2", file: "/music/musica2.mp3" }
];

let currentTrackIndex = 0;   // Indice della canzone corrente
let trackStartTime = Date.now(); // Timestamp di inizio della canzone attuale per calcolare l'avanzamento

// FUNZIONE DI BROADCAST:
// Scorre tutti i client registrati in 'wss.clients' e invia loro il messaggio se sono nello stato OPEN
function broadcast(data) {
    const jsonMessage = JSON.stringify(data);
    
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(jsonMessage);
        }
    });
}

// TIMING/REGIA DEL DJ (TIMER DEL SERVER):
// Ogni secondo il server calcola la posizione attuale del brano e notifica i client
setInterval(() => {
    // Calcoliamo i secondi trascorsi dall'inizio del brano attuale
    const currentTimeInSeconds = (Date.now() - trackStartTime) / 1000;

    // Messaggio di aggiornamento sincronizzazione per tutti gli ascoltatori
    broadcast({
        type: 'sync',
        track: playlist[currentTrackIndex].file,
        title: playlist[currentTrackIndex].title,
        currentTime: currentTimeInSeconds
    });
}, 1000);

// GESTIONE CONNESSI E EVENTI WEBSOCKET:
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[SERVER] Nuovo ascoltatore connesso da: ${clientIp}`);

    // Invia subito allo stato iniziale al singolo client appena connesso (handshake completato)
    const initialTime = (Date.now() - trackStartTime) / 1000;
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Benvenuto nella Web Radio Sincronizzata!',
        track: playlist[currentTrackIndex].file,
        title: playlist[currentTrackIndex].title,
        currentTime: initialTime
    }));

    // Ricezione di messaggi inviati dal client (es. richieste, cambi di canale, feedback)
    ws.on('message', (message) => {
        try {
            const parsedData = JSON.parse(message);
            console.log(`[SERVER] Messaggio ricevuto dal client:`, parsedData);

            // Esempio: Il client richiede di saltare alla canzone successiva (bottone Next)
            if (parsedData.action === 'skip') {
                currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
                trackStartTime = Date.now(); // Resettiamo il tempo per il nuovo brano
                
                // Notifichiamo immediatamente il cambio brano in broadcast
                broadcast({
                    type: 'track_change',
                    track: playlist[currentTrackIndex].file,
                    title: playlist[currentTrackIndex].title,
                    currentTime: 0
                });
            }
        } catch (error) {
            console.error("[SERVER] Errore nel parsing del messaggio JSON:", error);
        }
    });

    // Gestione disconnessione
    ws.on('close', () => {
        console.log(`[SERVER] Ascoltatore disconnesso.`);
    });

    ws.on('error', (err) => {
        console.error(`[SERVER] Errore WebSocket:`, err);
    });
});

// AVVIO DEL SERVER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`📻 Server Radio attivo su http://localhost:${PORT}`);
    console.log(`=================================================`);
});