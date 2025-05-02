// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '20mb' })); // To handle large file payloads

app.get('/', (req, res) => {
  res.send('✅ Middleware ready to upload files from Salesforce to SAP.');
});

// POST /upload - from Salesforce
app.post('/upload', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;

    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    // 1. Decode the base64 content
    const buffer = Buffer.from(fileContent, 'base64');

    // 2. Write to temporary path
    const tempPath = path.join(__dirname, 'temp', fileName);
    fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
    fs.writeFileSync(tempPath, buffer);

    // 3. Prepare form-data
    const form = new FormData();
    form.append('file', fs.createReadStream(tempPath), fileName);

    // 4. Send to SAP (with your SAP session cookie)
    const sapResponse = await axios.post(
      'https://sap.uneecopscloud.com:50000/b1s/v1/Attachments2',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Cookie: 'B1SESSION=your-session-id; ROUTEID=.node8' // Replace with your real session
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    // 5. Clean up
    fs.unlinkSync(tempPath);

    // 6. Return SAP response to Salesforce
    res.status(200).json(sapResponse.data);
  } catch (err) {
    console.error('❌ Upload Error:', err.message);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Middleware listening on port ${port}`);
});
