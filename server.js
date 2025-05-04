const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '20mb' }));

// SAP Login
async function loginToSAP() {
  const loginRes = await axios.post('https://sap.uneecopscloud.com:50000/b1s/v1/Login', {
    UserName: 'salesforce',
    Password: 'utl1662',
    CompanyDB: 'sftest'
  }, {
    headers: { 'Content-Type': 'application/json' }
  });

  const cookies = loginRes.headers['set-cookie'];
  const session = cookies.find(c => c.includes('B1SESSION'));
  const route = cookies.find(c => c.includes('ROUTEID'));
  return `${session}; ${route}`;
}

// Health check
app.get('/', (req, res) => {
  res.send('✅ Middleware alive');
});

// Upload route
app.post('/upload', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;
    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    // Write base64 file to disk
    const buffer = Buffer.from(fileContent, 'base64');
    const tempPath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempPath, buffer);

    // FormData setup
    const form = new FormData();
    form.append('', fs.createReadStream(tempPath)); // No name or content-type just like Postman

    const cookie = await loginToSAP();

    const sapRes = await axios.post(
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

    fs.unlinkSync(tempPath); // Clean up
    res.status(200).json(sapRes.data);
  } catch (err) {
    console.error('❌ Upload Failed');
    if (err.response) {
      console.error(err.response.data);
      res.status(500).json({ error: 'Upload failed', details: err.response.data });
    } else {
      res.status(500).json({ error: 'Upload failed', details: err.message });
    }
  }
});

app.listen(port, () => {
  console.log(`🚀 Listening on port ${port}`);
});
