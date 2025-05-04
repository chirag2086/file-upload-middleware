const express = require('express');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json({ limit: '20mb' }));

// SAP Login Function
async function loginToSAP() {
  console.log('🔐 Logging in to SAP...');
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

  console.log('✅ SAP session established');
  return `${b1session}; ${routeId}`;
}

// Health Check Route
app.get('/', (req, res) => {
  res.send('✅ Middleware is alive and running');
});

// Upload Endpoint
app.post('/upload', async (req, res) => {
  try {
    const { fileName, fileContent } = req.body;

    if (!fileName || !fileContent) {
      return res.status(400).json({ error: 'Missing fileName or fileContent' });
    }

    // Decode and save file temporarily
    const buffer = Buffer.from(fileContent, 'base64');
    const tempPath = path.join(os.tmpdir(), fileName);
    fs.writeFileSync(tempPath, buffer);

    // Create multipart/form-data
    const form = new FormData();
    form.append('files', fs.createReadStream(tempPath), fileName); // ✅ Important fix: use name="files"

    const cookie = await loginToSAP();

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

    fs.unlinkSync(tempPath); // Clean up
    console.log('✅ File uploaded successfully to SAP');
    res.status(200).json(response.data);
  } catch (err) {
    console.error('❌ Upload Failed');
    if (err.response) {
      console.error('SAP Status:', err.response.status);
      console.error('SAP Error:', err.response.data);
      res.status(500).json({
        error: 'Upload failed',
        details: err.response.data
      });
    } else {
      console.error('Error:', err.message);
      res.status(500).json({
        error: 'Upload failed',
        details: err.message
      });
    }
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Middleware is running on port ${port}`);
});
