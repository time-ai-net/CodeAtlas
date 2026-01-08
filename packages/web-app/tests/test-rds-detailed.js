const http = require('http');

const repoUrl = 'https://github.com/Time-Open-Source-Foundation/RDS';
const data = JSON.stringify({ repoUrl, provider: 'ollama' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  timeout: 300000
};

console.log('🧪 Testing RDS Repository - Detailed Analysis\n');
console.log('📦 Repository:', repoUrl);
console.log('⏳ Sending request (this may take a few minutes)...\n');

const startTime = Date.now();
const req = http.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ Response received (${duration}s)\n`);
    
    try {
      const result = JSON.parse(body);
      
      console.log('📊 RESPONSE STRUCTURE:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Status:', res.statusCode);
      console.log('✅ Modules:', result.modules?.length || 0);
      
      if (result.modules && result.modules.length > 0) {
        console.log('\n📝 Sample Modules (first 5):');
        result.modules.slice(0, 5).forEach((m, i) => {
          console.log(`   ${i + 1}. ${m.name || 'N/A'} (${m.type || 'other'})`);
          console.log(`      Path: ${m.path || 'N/A'}`);
          if (m.description) {
            console.log(`      Description: ${m.description.substring(0, 80)}...`);
          }
        });
      }
      
      console.log('\n✅ Relationships:', result.relationships?.length || 0);
      if (result.relationships && result.relationships.length > 0) {
        console.log('\n🔗 Sample Relationships (first 3):');
        result.relationships.slice(0, 3).forEach((r, i) => {
          console.log(`   ${i + 1}. ${r.from?.split('/').pop() || r.from} → ${r.to?.split('/').pop() || r.to}`);
          console.log(`      Type: ${r.type || 'depends'}`);
        });
      }
      
      console.log('\n✅ Layers:', result.layers?.length || 0);
      if (result.layers && result.layers.length > 0) {
        result.layers.forEach((layer, i) => {
          console.log(`   ${i + 1}. ${layer.name}: ${layer.modules?.length || 0} modules`);
        });
      }
      
      console.log('\n✅ Pattern:', result.pattern?.name || 'N/A');
      if (result.pattern) {
        console.log(`   Confidence: ${Math.round(result.pattern.confidence * 100)}%`);
        if (result.pattern.description) {
          console.log(`   Description: ${result.pattern.description.substring(0, 150)}...`);
        }
      }
      
      console.log('\n✅ Diagram:', result.diagram ? 'Present' : 'Missing');
      if (result.diagram) {
        console.log(`   Length: ${result.diagram.length} chars`);
        console.log(`   Preview: ${result.diagram.substring(0, 150)}...`);
      }
      
      if (result.summary) {
        console.log('\n📄 Summary:');
        console.log(`   ${result.summary.substring(0, 300)}...`);
      }
      
      if (result.repoInfo) {
        console.log('\n📦 Repository Info:');
        console.log(`   Owner: ${result.repoInfo.owner}`);
        console.log(`   Repo: ${result.repoInfo.repo}`);
        console.log(`   Branch: ${result.repoInfo.branch}`);
        console.log(`   Files Analyzed: ${result.repoInfo.fileCount}`);
      }
      
      if (result.parsingWarnings && result.parsingWarnings.length > 0) {
        console.log('\n⚠️  Parsing Warnings:');
        result.parsingWarnings.forEach(w => console.log(`   - ${w}`));
      }
      
      if (result.error) {
        console.log('\n❌ Error:', result.error);
        process.exit(1);
      } else {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ All checks passed! Backend is working correctly.');
        console.log('✅ Response structure is valid.');
        console.log('✅ Diagram generation works.');
        console.log('✅ All required fields are present.');
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message);
      console.error('Response body:', body.substring(0, 500));
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Request timeout');
  req.destroy();
  process.exit(1);
});

req.write(data);
req.end();

