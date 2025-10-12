import http from 'http';

const PORT = 2376; // Use a different port to avoid conflicts

// Create HTTP server that adds CORS headers
const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Proxy the request to the Docker API
  const options = {
    hostname: 'localhost',
    port: 2375,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:2375'
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Copy response headers and add CORS
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });
    
    // Ensure CORS headers are always present
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    res.writeHead(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(500);
    res.end('Proxy error: ' + err.message);
  });

  // Pipe request body to Docker API
  req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CORS proxy server running on port ${PORT}`);
});
