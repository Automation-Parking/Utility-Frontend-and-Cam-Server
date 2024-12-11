const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = [];

// Middleware to parse JSON bodies
app.use(compression());
app.use(bodyParser.json({ limit: '10mb' })); // Increase limit if needed
app.use(cors());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Root route (optional, can be removed if not needed)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Replace 'index.html' with main HTML file
});

// Route for the camera page
app.get('/camera/masuk', (req, res) => {
  res.sendFile(path.join(__dirname, 'camera-site', 'masuk.html'));
});

app.get('/camera-keluar', (req, res) => {
  res.sendFile(path.join(__dirname, 'camera-site', 'keluar.html'));
});

// Route for the camera monitoring page
app.get('/camera/monitoring', (req, res) => {
  res.sendFile(path.join(__dirname, 'camera-monitoring', 'index.html'));
});

// Route for the user display page
app.get('/userdisplay/masuk', (req, res) => {
  res.sendFile(path.join(__dirname, 'user-display', 'masuk.html'));
});

app.get('/userdisplay/keluar', (req, res) => {
  res.sendFile(path.join(__dirname, 'user-display', 'keluar.html'));
});

// Route for the front-end monitoring page
app.get('/monitoring', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend-monitoring', 'index.html'));
});

// Create a directory for saving images if it doesn't exist
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

// REST API endpoint to receive image data
app.post('/upload', (req, res) => {
  const { type, image } = req.body;

  // Broadcast the image data to all WebSocket clients
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, image }));
    }
  });

  res.status(200).send({ message: 'Image received' });
});

// REST API endpoint to receive image data for capturing
app.post('/capture', (req, res) => {
  const { image } = req.body;
  console.log("Received capture image data");
  console.log("Received image data:", req.body);

  // Save the image to the local folder
  const base64Data = image.replace(/^data:image\/png;base64,/, "");
  const fileName = `capture_${Date.now()}.png`;
  fs.writeFile(path.join(imagesDir, fileName), base64Data, 'base64', (err) => {
    if (err) {
      console.error("Error saving image:", err);
      return res.status(500).send({ message: 'Error saving image' });
    }

    res.status(200).send({ message: 'Image saved', fileName });
  });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  clients.push(ws);
  console.log('New client connected');

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'trigger') {
      const targetClients = clients.filter(client => client !== ws && client.readyState === WebSocket.OPEN);
      targetClients.forEach(client => client.send(JSON.stringify({ type: 'capture' })));
    } else if (data.type === 'toggle') {
      // Broadcast the toggle state to all clients
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'toggle', state: data.state }));
        }
      });
      // Handle camera toggle state
      console.log(`Camera state changed: ${data.state}`);
      // Here can implement logic to actually start/stop the camera
    }
  });

  ws.on('close', () => {
    clients = clients.filter(client => client !== ws);
    console.log('Client disconnected');
  });
});

server.listen(3001, () => {
  console.log('Server is listening on port 3001');
});