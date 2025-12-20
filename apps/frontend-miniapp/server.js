import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = join(__dirname, 'dist');

// Add CORS headers for TON Connect manifest (wallet needs to fetch this from walletbot.me)
app.use((req, res, next) => {
  if (req.path.includes('tonconnect-manifest.json')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  next();
});

// Handle OPTIONS preflight for manifest
app.options('/tonconnect-manifest.json', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

// Serve static files from dist directory
app.use(express.static(distPath, {
  // Don't set index: false, let it serve index.html for root
  etag: true,
  lastModified: true,
}));

// SPA fallback: serve index.html for all non-static routes
app.get('*', (req, res) => {
  const indexPath = join(distPath, 'index.html');
  
  if (existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found. Please build the frontend first.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log(`Serving static files from: ${distPath}`);
  console.log(`SPA fallback enabled: all routes serve index.html`);
});

