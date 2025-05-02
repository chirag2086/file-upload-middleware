const express = require('express');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mime = require('mime-types');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '20mb' }));

// ✅ SAP Login
async function loginToSAP() {
  const loginResponse = await axios.post(
    'https://sap.uneecopscloud.com:50000/b1s/v1/Login',
    {
      UserName: 'salesforce',
      Password: 'utl1662',
      CompanyDB: 'sftest'
    },
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );

  const cookies = loginResponse.headers['set-cookie'];
  const b1session = cookies.find(c => c.includes('B1SESSION'));
  const routeId = cookies.find(c => c.includes('ROUTEID'));

  return `${b1session}; ${routeId}`;
}

// ✅ Health Check (GET /)
app.get('/', (req, res) => {
  res.send('✅ Middleware is running and ready to accept uploads.');
});

// ✅ Upload Endpoint
app.post('/upload', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;
    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    console.log(`📥 Received file: ${fileName}`);
    const buffer = Buffer.from(fileContent, 'base64');

    const tempPath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempPath, buffer);
    console.log(`📝 File written to: ${tempPath}`);

    const mimeType = mime.lookup(fileName) || 'application/octet-stream';
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const eol = '\r\n';

    // 🔧 Manual multipart body (like Postman)
    const head =
      `--${boundary}${eol}` +
      `Content-Disposition: form-data; name=""; filename="${fileName}"${eol}` +
      `Content-Type: ${mimeType}${eol}${eol}`;
    const tail = `${eol}--${boundary}--${eol}`;

    const fileBuffer = fs.readFileSync(tempPath);
    const bodyBuffer = Buffer.concat([
      Buffer.from(head, 'utf8'),
      fileBuffer,
      Buffer.from(tail, 'utf8')
    ]);

    const sapCookie = await loginToSAP();
    console.log('🚀 Uploading to SAP /Attachments2...');

    const response = await axios.post(
      'https://sap.uneecopscloud.com:50000/b1s/v1/Attachments2',
      bodyBuffer,
      {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length,
          'Cookie': sapCookie
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    fs.unlinkSync(tempPath);
    console.log('✅ Upload successful:', response.data);
    res.status(200).json(response.data);

  } catch (err) {
    console.error('❌ Upload Error');
    if (err.response) {
      console.error('📛 SAP Status:', err.response.status);
      console.error('📄 SAP Error:', err.response.data);
    }
    res.status(500).json({
      error: 'Upload failed',
      details: err.response?.data || err.message
    });
  }
});

// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Middleware listening on port ${port}`);
});
