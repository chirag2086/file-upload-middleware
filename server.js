const express = require('express');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mime = require('mime-types');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '20mb' }));

// SAP Login Function
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

// Upload Route
app.post('/upload', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;
    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    const buffer = Buffer.from(fileContent, 'base64');
    const tempPath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempPath, buffer);

    const mimeType = mime.lookup(fileName) || 'application/octet-stream';
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const eol = '\r\n';

    const head =
      `--${boundary}${eol}` +
      `Content-Disposition: form-data; name=""; filename="${fileName}"${eol}` +
      `Content-Type: ${mimeType}${eol}${eol}`;

    const tail = `${eol}--${boundary}--${eol}`;

    const fileStream = fs.readFileSync(tempPath);
    const bodyBuffer = Buffer.concat([
      Buffer.from(head, 'utf8'),
      fileStream,
      Buffer.from(tail, 'utf8')
    ]);

    const sapCookie = await loginToSAP();

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

app.listen(port, () => {
  console.log(`🚀 Middleware running on port ${port}`);
});
