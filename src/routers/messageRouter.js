const express = require('express');
const router = new express.Router();
const fs = require('fs');
const { Client, LocalAuth } = require("whatsapp-web.js")
const { createCanvas } = require('canvas');
const uuid = require('uuid');
const QRCode = require('qrcode');

const clients = {}

function startClient() {
  const id = uuid.v4(); // Generate a random ID
  const canvas = createCanvas(250, 250); // Create a canvas for QR code
  const ctx = canvas.getContext('2d');

  const qrCode = new Promise((resolve, reject) => {
    clients[id] = new Client({
      authStrategy: new LocalAuth({
        clientId: id
      }),
      webVersionCache: {
        type: 'remote',
        remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2407.3.html`
      }
    });

    clients[id].initialize().catch(err => console.log(err));

    clients[id].on("qr", async (qr) => {
      console.log(qr);
      await QRCode.toCanvas(canvas, qr); // Generate QR code to canvas
      resolve(canvas.toBuffer()); // Resolve with QR code as image buffer
    });

    clients[id].on("ready", () => console.log("Client is ready!"));

    let lastSentIndex = -1; 
    clients[id].on("message", async (msg) => {
      try {
        const contact = await msg.getContact();
        if (contact.number === '918001026098') {
          const repliesData = fs.readFileSync('src\\routers\\replies.json');
          const replies = JSON.parse(repliesData);
          const messageContent = msg.body.toLowerCase(); // convert message to lowercase for case-insensitive matching
          let sendStatus = false;
          replies.messages.forEach(message => {
            if (messageContent.includes(message.check)) {
              sendStatus = true;
              clients[id].sendMessage(msg.from, message.reply);
            }
          });

          if (!sendStatus) {
            lastSentIndex = (lastSentIndex + 1) % replies.default.length;
            const nextMessage = replies.default[lastSentIndex];
            clients[id].sendMessage(msg.from, nextMessage);
          }
        }
      } catch (error) {
        console.error(error);
      }
    });

  });

  return qrCode.then(buffer => ({
    id,
    qr: buffer
  }));
}


router.get('/', async (req, res) => {
  try {
    const { id, qr } = await startClient();
    res.set('Content-Type', 'image/png'); // Set response content type as image/png
    res.send(qr); // Send the QR code buffer as response
  } catch (error) {
    console.error(error);
    res.status(500).send('Error occurred');
  }
});


module.exports = router