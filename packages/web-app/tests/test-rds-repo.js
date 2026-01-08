/**
 * Test script specifically for RDS repository
 * Run with: node packages/web-app/scripts/test-rds-repo.js
 */

const http = require('http');

const testRepo = 'https://github.com/Time-Open-Source-Foundation/RDS';
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
      timeout: 300000, // 5 minutes timeout
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

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

function validateResponse(response) {
  const errors = [];
  const warnings = [];
  const info = [];

  if (!response.data) {
    errors.push('❌ Response missing data field');
    return { errors, warnings, info, valid: false };
  }

  const data = response.data;

  if (data.error) {
    errors.push(`❌ API returned error: ${data.error}`);
    return { errors, warnings, info, valid: false };
  }

  // Validate modules
  if (!Array.isArray(data.modules)) {
    errors.push('❌ modules must be an array');
  } else {
    info.push(`✅ Found ${data.modules.length} modules`);
    if (data.modules.length === 0) {
      warnings.push('⚠️  No modules found in response');
    } else {
      // Check first few modules
      data.modules.slice(0, 3).forEach((module, idx) => {
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
    info.push(`✅ Found ${data.relationships.length} relationships`);
  }

  // Validate summary
  if (!data.summary || typeof data.summary !== 'string') {
    errors.push('❌ summary must be a non-empty string');
  } else {
    info.push(`✅ Summary: ${data.summary.substring(0, 100)}...`);
  }

  // Validate pattern
  if (data.pattern) {
    if (!data.pattern.name) warnings.push('⚠️  Pattern missing name');
    if (typeof data.pattern.confidence !== 'number') warnings.push('⚠️  Pattern confidence should be a number');
    if (!data.pattern.description) warnings.push('⚠️  Pattern missing description');
    info.push(`✅ Pattern: ${data.pattern.name} (${Math.round(data.pattern.confidence * 100)}% confidence)`);
  } else {
    warnings.push('⚠️  No pattern found in response');
  }

  // Validate layers
  if (data.layers) {
    if (!Array.isArray(data.layers)) {
      errors.push('❌ layers must be an array');
    } else {
      info.push(`✅ Found ${data.layers.length} layers`);
    }
  }

  // Validate diagram
  if (!data.diagram || typeof data.diagram !== 'string') {
    errors.push('❌ diagram must be a non-empty string');
  } else {
    const validStarts = ['graph', 'flowchart', 'classDiagram', 'sequenceDiagram'];
    const isValid = validStarts.some(start => data.diagram.trim().toLowerCase().startsWith(start.toLowerCase()));
    if (!isValid) {
      errors.push(`❌ Invalid diagram format. Should start with one of: ${validStarts.join(', ')}`);
    } else {
      info.push(`✅ Diagram: ${data.diagram.substring(0, 50)}...`);
    }
  }

  // Validate repoInfo
  if (!data.repoInfo) {
    warnings.push('⚠️  No repoInfo in response');
  } else {
    info.push(`✅ Repo: ${data.repoInfo.owner}/${data.repoInfo.repo} (${data.repoInfo.branch})`);
    info.push(`✅ Files analyzed: ${data.repoInfo.fileCount}`);
  }

  return {
    errors,
    warnings,
    info,
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
  console.log('🧪 Testing CodeAtlas Backend API - RDS Repository\n');
  console.log(`📦 Repository: ${testRepo}`);
  console.log(`🔗 API endpoint: ${apiUrl}\n`);

  try {
    console.log('⏳ Sending request (this may take a few minutes)...');
    const startTime = Date.now();
    const response = await makeRequest(testRepo, 'ollama');
    const duration = Date.now() - startTime;

    console.log(`✅ Response received (${Math.round(duration / 1000)}s)\n`);

    if (response.status !== 200) {
      console.error(`❌ HTTP Status: ${response.status}`);
      console.error('Response:', JSON.stringify(response.data, null, 2));
      process.exit(1);
    }

    console.log('📊 Validating response structure...\n');
    const validation = validateResponse(response);

    // Print info
    if (validation.info.length > 0) {
      console.log('ℹ️  INFO:');
      validation.info.forEach(msg => console.log(`   ${msg}`));
      console.log('');
    }

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
        console.log('📝 Sample Modules (first 3):');
        response.data.modules.slice(0, 3).forEach((module, idx) => {
          console.log(`   ${idx + 1}. ${module.name} (${module.type}) - ${module.path}`);
        });
        console.log('');
      }

      if (response.data.pattern) {
        console.log('🏗️  Architectural Pattern:');
        console.log(`   Name: ${response.data.pattern.name}`);
        console.log(`   Confidence: ${Math.round(response.data.pattern.confidence * 100)}%`);
        console.log(`   Description: ${response.data.pattern.description}`);
        console.log('');
      }

      if (response.data.summary) {
        console.log('📄 Summary (first 300 chars):');
        console.log(`   ${response.data.summary.substring(0, 300)}...\n`);
      }

      if (response.data.diagram) {
        console.log('📐 Diagram Preview (first 300 chars):');
        console.log(response.data.diagram.substring(0, 300) + '...\n');
      }

      if (response.data.parsingWarnings && response.data.parsingWarnings.length > 0) {
        console.log('⚠️  Parsing Warnings:');
        response.data.parsingWarnings.forEach(warn => console.log(`   ${warn}`));
        console.log('');
      }

      console.log('✅ All tests passed! Backend is working correctly.');
      process.exit(0);
    } else {
      console.log('❌ Validation failed. See errors above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
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
  console.error('Please start the dev server with: npm run dev');
  process.exit(1);
});

checkReq.on('timeout', () => {
  checkReq.destroy();
  console.error('❌ Server connection timeout!');
  console.error('Please start the dev server with: npm run dev');
  process.exit(1);
});

checkReq.end();

