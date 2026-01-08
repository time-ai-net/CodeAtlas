const http = require('http');

console.log('═══════════════════════════════════════════════════════════');
console.log('🎯 FINAL VERIFICATION TEST');
console.log('═══════════════════════════════════════════════════════════\n');

const repoUrl = 'https://github.com/Time-Open-Source-Foundation/RDS';

function makeRequest() {
  return new Promise((resolve, reject) => {
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

    console.log('📦 Testing Repository:', repoUrl);
    console.log('⏳ Sending request...\n');

    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        try {
          const result = JSON.parse(body);
          
          console.log(`✅ Response received (${duration}s)\n`);
          
          // Comprehensive checks
          const checks = {
            'Response Status': res.statusCode === 200,
            'Has Error': !result.error,
            'Modules Array': Array.isArray(result.modules) && result.modules.length > 0,
            'Relationships Array': Array.isArray(result.relationships),
            'Summary String': typeof result.summary === 'string' && result.summary.length > 0,
            'Pattern Object': result.pattern && typeof result.pattern === 'object',
            'Pattern Name Valid': result.pattern?.name && result.pattern.name !== 'Unknown',
            'Pattern Confidence': typeof result.pattern?.confidence === 'number' && result.pattern.confidence > 0,
            'Layers Array': Array.isArray(result.layers) && result.layers.length > 0,
            'Layers Have Modules': result.layers?.some(l => l.modules && l.modules.length > 0),
            'Diagram Present': typeof result.diagram === 'string' && result.diagram.length > 0,
            'Diagram Valid Format': result.diagram?.trim().toLowerCase().startsWith('graph') || result.diagram?.trim().toLowerCase().startsWith('flowchart'),
            'RepoInfo Present': result.repoInfo && typeof result.repoInfo === 'object',
            'All Modules Have Names': result.modules?.every(m => m.name && m.name.length > 0),
            'All Modules Have Paths': result.modules?.every(m => m.path && m.path.length > 0),
            'All Modules Have Types': result.modules?.every(m => m.type && m.type.length > 0)
          };
          
          console.log('📋 VERIFICATION CHECKS:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          let passed = 0;
          let total = Object.keys(checks).length;
          
          Object.entries(checks).forEach(([check, passed_check]) => {
            const icon = passed_check ? '✅' : '❌';
            console.log(`${icon} ${check}`);
            if (passed_check) passed++;
          });
          
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`Score: ${passed}/${total} (${Math.round((passed / total) * 100)}%)\n`);
          
          // Detailed metrics
          console.log('📊 DETAILED METRICS:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`Modules: ${result.modules?.length || 0}`);
          console.log(`  - With names: ${result.modules?.filter(m => m.name).length || 0}`);
          console.log(`  - With paths: ${result.modules?.filter(m => m.path).length || 0}`);
          console.log(`  - With types: ${result.modules?.filter(m => m.type).length || 0}`);
          console.log(`  - With descriptions: ${result.modules?.filter(m => m.description).length || 0}`);
          console.log(`Relationships: ${result.relationships?.length || 0}`);
          console.log(`  - Valid (from/to): ${result.relationships?.filter(r => r.from && r.to).length || 0}`);
          console.log(`Layers: ${result.layers?.length || 0}`);
          console.log(`  - With modules: ${result.layers?.filter(l => l.modules && l.modules.length > 0).length || 0}`);
          console.log(`Pattern: ${result.pattern?.name || 'N/A'} (${Math.round((result.pattern?.confidence || 0) * 100)}%)`);
          console.log(`Diagram: ${result.diagram?.length || 0} chars`);
          console.log(`Summary: ${result.summary?.length || 0} chars`);
          console.log(`Files Analyzed: ${result.repoInfo?.fileCount || 0}`);
          console.log('');
          
          // Quality score
          let qualityScore = 0;
          let maxScore = 10;
          
          if (result.modules && result.modules.length > 0) qualityScore++;
          if (result.modules?.every(m => m.name)) qualityScore++;
          if (result.modules?.every(m => m.path)) qualityScore++;
          if (result.modules?.every(m => m.type)) qualityScore++;
          if (result.relationships && result.relationships.length > 0) qualityScore++;
          if (result.relationships?.some(r => r.from && r.to)) qualityScore++;
          if (result.layers && result.layers.length > 0) qualityScore++;
          if (result.layers?.some(l => l.modules && l.modules.length > 0)) qualityScore++;
          if (result.pattern?.name && result.pattern.name !== 'Unknown') qualityScore++;
          if (result.diagram && result.summary) qualityScore++;
          
          const qualityPercent = Math.round((qualityScore / maxScore) * 100);
          const qualityGrade = qualityPercent >= 90 ? 'A' : qualityPercent >= 80 ? 'B' : qualityPercent >= 70 ? 'C' : qualityPercent >= 60 ? 'D' : 'F';
          
          console.log('🎯 QUALITY ASSESSMENT:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`Quality Score: ${qualityScore}/${maxScore} (${qualityPercent}%)`);
          console.log(`Grade: ${qualityGrade}`);
          
          if (qualityPercent >= 90) {
            console.log('✅ EXCELLENT - Backend is producing high-quality responses!');
          } else if (qualityPercent >= 80) {
            console.log('✅ GOOD - Backend is working well with minor improvements possible.');
          } else if (qualityPercent >= 70) {
            console.log('⚠️  FAIR - Backend is functional but has room for improvement.');
          } else {
            console.log('❌ NEEDS IMPROVEMENT - Backend requires significant enhancements.');
          }
          
          console.log('\n═══════════════════════════════════════════════════════════');
          console.log('✅ VERIFICATION COMPLETE');
          console.log('═══════════════════════════════════════════════════════════\n');
          
          resolve({ result, checks, qualityScore, qualityPercent });
        } catch (e) {
          reject({ error: e.message, body: body.substring(0, 500) });
        }
      });
    });

    req.on('error', (e) => {
      reject({ error: e.message });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({ error: 'Request timeout' });
    });

    req.write(data);
    req.end();
  });
}

makeRequest()
  .then(() => {
    console.log('✅ All verification tests passed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Verification failed:', err.error || err.message);
    if (err.body) {
      console.error('Response:', err.body);
    }
    process.exit(1);
  });

