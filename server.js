const express = require('express');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '20mb' }));

// 🔐 SAP Login
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

// 🌐 GET /
app.get('/', (req, res) => {
  res.send('✅ Middleware is running.');
});

// 📤 File Upload
app.post('/upload', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;

    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    const buffer = Buffer.from(fileContent, 'base64');
    const tempPath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempPath, buffer);

    const form = new FormData();
    form.append('', fs.createReadStream(tempPath), { filename: fileName }); // 👈 Explicit filename is critical

    const cookie = await loginToSAP();
    await new Promise(resolve => setTimeout(resolve, 1000)); // ⏳ Give SAP session time to settle

    const response = await axios.post(
      'https://sap.uneecopscloud.com:50000/b1s/v1/Attachments2',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Cookie: cookie
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    fs.unlinkSync(tempPath);
    res.status(200).json(response.data);
  } catch (err) {
    console.error('❌ Upload failed');
    if (err.response) {
      console.error('SAP Error:', err.response.status, err.response.data);
      res.status(500).json({
        error: 'Upload failed',
        details: err.response.data
      });
    } else {
      res.status(500).json({
        error: 'Upload failed',
        details: err.message
      });
    }
  }
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`✅ Middleware server running at http://localhost:${port}`);
});
