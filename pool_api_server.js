// pool_api_server.js
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ✅ In-memory registry of pool systems (you could replace with DB or file)
let poolSystems = [
  // Example: {
  //   username: 'user1',
  //   apiUrl: 'https://iaqualink.poolpilot.app/iapool1/data',
  //   controlUrl: 'https://iaqualink.poolpilot.app/iapool1/control'
  // }
];

// 🔧 POST /createServer – register a pool system
app.post('/createServer', (req, res) => {
  const { username, apiUrl, controlUrl } = req.body;

  if (!username || !apiUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Avoid duplicate entries
  const existing = poolSystems.find(p => p.username === username);
  if (!existing) {
    poolSystems.push({ username, apiUrl, controlUrl });
  }

  res.json({ success: true, message: 'Pool system registered' });
});

// 📋 GET /poolList – flattened list of all pools
app.get('/poolList', async (req, res) => {
  const allPools = [];

  for (const system of poolSystems) {
    try {
      const response = await axios.get(system.apiUrl);
      const data = response.data;

      for (const [systemId, pool] of Object.entries(data)) {
        allPools.push({
          systemId,
          name: pool.name || 'Unnamed Pool',
          status: pool.status,
          dataEndpoint: `${req.protocol}://${req.get('host')}/pool?systemId=${systemId}`,
          controlEndpoint: `${req.protocol}://${req.get('host')}/control` // can be same for all
        });
      }
    } catch (err) {
      console.error(`❌ Error fetching data for ${system.username}:`, err.message);
    }
  }

  res.json(allPools);
});

// 📡 GET /pool?systemId=XYZ – live data for one pool
app.get('/pool', async (req, res) => {
  const { systemId } = req.query;
  if (!systemId) return res.status(400).json({ error: 'Missing systemId' });

  for (const system of poolSystems) {
    try {
      const response = await axios.get(system.apiUrl);
      const data = response.data;
      const pool = data[systemId];

      if (pool) {
        return res.json({
          systemId,
          name: pool.name,
          status: pool.status,
          ...pool.devices
        });
      }
    } catch (err) {
      console.error(err.message);
    }
  }

  res.status(404).json({ error: 'Pool not found' });
});

// 🎮 POST /control – receive control command
app.post('/control', async (req, res) => {
  const { systemId, action, value } = req.body;
  if (!systemId || !action) return res.status(400).json({ error: 'Missing systemId or action' });

  const system = poolSystems.find(p => p.apiUrl.includes(systemId.slice(0, 6))); // crude match
  if (!system) return res.status(404).json({ error: 'System not found' });

  try {
    const result = await axios.post(system.controlUrl, { systemId, action, value });
    res.json({ success: true, response: result.data });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to send control command' });
  }
});

app.listen(PORT, () => console.log(`🚀 Pool API Server running on port ${PORT}`));
