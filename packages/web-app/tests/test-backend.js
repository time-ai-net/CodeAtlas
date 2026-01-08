/**
 * Test script to validate backend API response structure
 * Run with: node packages/web-app/scripts/test-backend.js
 */

const http = require('http');

const testRepo = 'https://github.com/aayush-time518/nexusgamingcasino';
const apiUrl = 'http://localhost:3000/api/analyze';

function makeRequest(repoUrl, provider = 'ollama') {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ repoUrl, provider });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/analyze',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}\nResponse: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

function validateResponse(response) {
  const errors = [];
  const warnings = [];

  // Check required fields
  if (!response.data) {
    errors.push('❌ Response missing data field');
    return { errors, warnings, valid: false };
  }

  const data = response.data;

  // Check for error response
  if (data.error) {
    errors.push(`❌ API returned error: ${data.error}`);
    return { errors, warnings, valid: false };
  }

  // Validate modules
  if (!Array.isArray(data.modules)) {
    errors.push('❌ modules must be an array');
  } else {
    if (data.modules.length === 0) {
      warnings.push('⚠️  No modules found in response');
    } else {
      data.modules.forEach((module, idx) => {
        if (!module.name) warnings.push(`⚠️  Module ${idx} missing name`);
        if (!module.path) warnings.push(`⚠️  Module ${idx} missing path`);
        if (!module.type) warnings.push(`⚠️  Module ${idx} missing type`);
      });
    }
  }

  // Validate relationships
  if (!Array.isArray(data.relationships)) {
    errors.push('❌ relationships must be an array');
  } else {
    data.relationships.forEach((rel, idx) => {
      if (!rel.from) warnings.push(`⚠️  Relationship ${idx} missing 'from'`);
      if (!rel.to) warnings.push(`⚠️  Relationship ${idx} missing 'to'`);
      if (!rel.type) warnings.push(`⚠️  Relationship ${idx} missing 'type'`);
    });
  }

  // Validate summary
  if (!data.summary || typeof data.summary !== 'string') {
    errors.push('❌ summary must be a non-empty string');
  }

  // Validate pattern
  if (data.pattern) {
    if (!data.pattern.name) warnings.push('⚠️  Pattern missing name');
    if (typeof data.pattern.confidence !== 'number') warnings.push('⚠️  Pattern confidence should be a number');
    if (!data.pattern.description) warnings.push('⚠️  Pattern missing description');
  } else {
    warnings.push('⚠️  No pattern found in response');
  }

  // Validate layers
  if (data.layers) {
    if (!Array.isArray(data.layers)) {
      errors.push('❌ layers must be an array');
    } else {
      data.layers.forEach((layer, idx) => {
        if (!layer.name) warnings.push(`⚠️  Layer ${idx} missing name`);
        if (!Array.isArray(layer.modules)) warnings.push(`⚠️  Layer ${idx} modules must be an array`);
      });
    }
  }

  // Validate diagram
  if (!data.diagram || typeof data.diagram !== 'string') {
    errors.push('❌ diagram must be a non-empty string');
  } else {
    // Check if diagram is valid Mermaid syntax
    const validStarts = ['graph', 'flowchart', 'classDiagram', 'sequenceDiagram'];
    const isValid = validStarts.some(start => data.diagram.trim().toLowerCase().startsWith(start.toLowerCase()));
    if (!isValid) {
      errors.push(`❌ Invalid diagram format. Should start with one of: ${validStarts.join(', ')}`);
    }
  }

  // Validate repoInfo
  if (!data.repoInfo) {
    warnings.push('⚠️  No repoInfo in response');
  } else {
    if (!data.repoInfo.owner) warnings.push('⚠️  repoInfo missing owner');
    if (!data.repoInfo.repo) warnings.push('⚠️  repoInfo missing repo');
    if (!data.repoInfo.branch) warnings.push('⚠️  repoInfo missing branch');
  }

  return {
    errors,
    warnings,
    valid: errors.length === 0,
    stats: {
      modules: data.modules?.length || 0,
      relationships: data.relationships?.length || 0,
      layers: data.layers?.length || 0,
      hasPattern: !!data.pattern,
      hasDiagram: !!data.diagram,
      diagramLength: data.diagram?.length || 0,
    },
  };
}

async function runTest() {
  console.log('🧪 Testing CodeAtlas Backend API\n');
  console.log(`📦 Testing repository: ${testRepo}`);
  console.log(`🔗 API endpoint: ${apiUrl}\n`);

  try {
    console.log('⏳ Sending request...');
    const startTime = Date.now();
    const response = await makeRequest(testRepo, 'ollama');
    const duration = Date.now() - startTime;

    console.log(`✅ Response received (${duration}ms)\n`);

    if (response.status !== 200) {
      console.error(`❌ HTTP Status: ${response.status}`);
      console.error('Response:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }

    console.log('📊 Validating response structure...\n');
    const validation = validateResponse(response);

    // Print stats
    console.log('📈 Response Statistics:');
    console.log(`   Modules: ${validation.stats.modules}`);
    console.log(`   Relationships: ${validation.stats.relationships}`);
    console.log(`   Layers: ${validation.stats.layers}`);
    console.log(`   Has Pattern: ${validation.stats.hasPattern ? '✅' : '❌'}`);
    console.log(`   Has Diagram: ${validation.stats.hasDiagram ? '✅' : '❌'}`);
    console.log(`   Diagram Length: ${validation.stats.diagramLength} chars\n`);

    // Print errors
    if (validation.errors.length > 0) {
      console.log('❌ ERRORS:');
      validation.errors.forEach(err => console.log(`   ${err}`));
      console.log('');
    }

    // Print warnings
    if (validation.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      validation.warnings.forEach(warn => console.log(`   ${warn}`));
      console.log('');
    }

    // Print sample data
    if (validation.valid) {
      console.log('✅ Response structure is valid!\n');
      
      if (response.data.modules && response.data.modules.length > 0) {
        console.log('📝 Sample Module:');
        console.log(JSON.stringify(response.data.modules[0], null, 2));
        console.log('');
      }

      if (response.data.pattern) {
        console.log('🏗️  Architectural Pattern:');
        console.log(JSON.stringify(response.data.pattern, null, 2));
        console.log('');
      }

      if (response.data.diagram) {
        console.log('📐 Diagram Preview (first 200 chars):');
        console.log(response.data.diagram.substring(0, 200) + '...\n');
      }

      console.log('✅ All tests passed!');
      process.exit(0);
    } else {
      console.log('❌ Validation failed. See errors above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check if server is running
console.log('🔍 Checking if server is running...\n');
const checkReq = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
    timeout: 2000,
  },
  () => {
    runTest();
  }
);

checkReq.on('error', () => {
  console.error('❌ Server is not running!');
  console.error('Please start the dev server with: npm run dev:web');
  process.exit(1);
});

checkReq.on('timeout', () => {
  checkReq.destroy();
  console.error('❌ Server connection timeout!');
  console.error('Please start the dev server with: npm run dev:web');
  process.exit(1);
});

checkReq.end();

