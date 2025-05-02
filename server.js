const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '10mb' })); // parse JSON with large payloads

app.get('/', (req, res) => {
  res.send('Welcome to File Upload Middleware API! Use POST /upload to upload files.');
});

app.post('/upload', (req, res) => {
  try {
    const { fileName, fileContent } = req.body;

    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    const buffer = Buffer.from(fileContent, 'base64');
    const uploadPath = path.join(__dirname, 'uploads', fileName);

    fs.writeFileSync(uploadPath, buffer);
    console.log(`✅ File saved: ${uploadPath}`);

    res.status(200).json({ message: 'File uploaded successfully', fileName });
  } catch (err) {
    console.error('❌ Upload failed:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
