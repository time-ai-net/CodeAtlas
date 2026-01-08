const http = require('http');

// Stress test with multiple repositories in sequence
const testRepos = [
  {
    name: 'RDS Flask App',
    url: 'https://github.com/Time-Open-Source-Foundation/RDS',
    expectedPattern: 'Layered'
  },
  {
    name: 'Nexus Gaming Casino',
    url: 'https://github.com/aayush-time518/nexusgamingcasino',
    expectedPattern: 'Layered'
  },
  {
    name: 'DeepTutor',
    url: 'https://github.com/HKUDS/DeepTutor',
    expectedPattern: 'Layered'
  }
];

let testResults = [];
let totalDuration = 0;
let passed = 0;
let failed = 0;

function testRepo(repo, index) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ repoUrl: repo.url, provider: 'ollama' });
    
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

    console.log(`\n[${index + 1}/${testRepos.length}] 🧪 Testing: ${repo.name}`);
    console.log(`   URL: ${repo.url}`);

    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        const duration = Math.round((Date.now() - startTime) / 1000);
        totalDuration += duration;
        
        try {
          const result = JSON.parse(body);
          
          const testResult = {
            name: repo.name,
            url: repo.url,
            duration,
            success: res.statusCode === 200 && !result.error,
            status: res.statusCode,
            modules: result.modules?.length || 0,
            relationships: result.relationships?.length || 0,
            layers: result.layers?.length || 0,
            pattern: result.pattern?.name || 'N/A',
            patternConfidence: result.pattern?.confidence || 0,
            hasDiagram: !!result.diagram,
            diagramLength: result.diagram?.length || 0,
            hasSummary: !!result.summary,
            summaryLength: result.summary?.length || 0,
            fileCount: result.repoInfo?.fileCount || 0,
            error: result.error,
            // Quality metrics
            modulesWithPath: result.modules?.filter(m => m.path && m.path.length > 0).length || 0,
            relationshipsWithFromTo: result.relationships?.filter(r => r.from && r.to && r.from.length > 0 && r.to.length > 0).length || 0,
            layersWithModules: result.layers?.filter(l => l.modules && Array.isArray(l.modules) && l.modules.length > 0).length || 0,
            patternIsUnknown: result.pattern?.name === 'Unknown'
          };
          
          if (testResult.success) {
            passed++;
            console.log(`   ✅ PASSED (${duration}s)`);
            console.log(`   📊 Modules: ${testResult.modules}, Relationships: ${testResult.relationships}, Layers: ${testResult.layers}`);
            console.log(`   🎯 Pattern: ${testResult.pattern} (${Math.round(testResult.patternConfidence * 100)}%)`);
            console.log(`   📐 Diagram: ${testResult.diagramLength} chars`);
            
            // Quality check
            const qualityIssues = [];
            if (testResult.modulesWithPath < testResult.modules) {
              qualityIssues.push(`${testResult.modules - testResult.modulesWithPath} modules missing paths`);
            }
            if (testResult.relationshipsWithFromTo < testResult.relationships) {
              qualityIssues.push(`${testResult.relationships - testResult.relationshipsWithFromTo} relationships invalid`);
            }
            if (testResult.layersWithModules === 0 && testResult.layers > 0) {
              qualityIssues.push('Layers not mapped');
            }
            if (testResult.patternIsUnknown) {
              qualityIssues.push('Pattern Unknown');
            }
            
            if (qualityIssues.length > 0) {
              console.log(`   ⚠️  Issues: ${qualityIssues.join(', ')}`);
            } else {
              console.log(`   ✅ Quality: Excellent`);
            }
          } else {
            failed++;
            console.log(`   ❌ FAILED`);
            if (testResult.error) {
              console.log(`   Error: ${testResult.error}`);
            }
          }
          
          testResults.push(testResult);
          resolve(testResult);
        } catch (e) {
          failed++;
          console.log(`   ❌ FAILED: Parse error`);
          testResults.push({
            name: repo.name,
            url: repo.url,
            success: false,
            error: e.message,
            duration
          });
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      failed++;
      console.log(`   ❌ FAILED: ${e.message}`);
      testResults.push({
        name: repo.name,
        url: repo.url,
        success: false,
        error: e.message,
        duration: Math.round((Date.now() - startTime) / 1000)
      });
      resolve(null);
    });

    req.on('timeout', () => {
      failed++;
      console.log(`   ❌ TIMEOUT`);
      testResults.push({
        name: repo.name,
        url: repo.url,
        success: false,
        error: 'Timeout',
        duration: 300
      });
      req.destroy();
      resolve(null);
    });

    req.write(data);
    req.end();
  });
}

async function runStressTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔥 STRESS TEST - Multiple Repositories');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Testing ${testRepos.length} repositories in sequence...\n`);

  const startTime = Date.now();

  // Run tests sequentially
  for (let i = 0; i < testRepos.length; i++) {
    await testRepo(testRepos[i], i);
    
    // Small delay between tests
    if (i < testRepos.length - 1) {
      console.log('\n   ⏳ Waiting 3 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);

  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 STRESS TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Total Tests: ${testRepos.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalTime}s`);
  console.log(`📈 Average Duration: ${Math.round(totalDuration / testRepos.length)}s\n`);

  // Detailed results
  testResults.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.name}`);
    if (result.success) {
      console.log(`   ✅ Status: ${result.status} (${result.duration}s)`);
      console.log(`   📦 Files: ${result.fileCount}`);
      console.log(`   📝 Modules: ${result.modules} (${result.modulesWithPath} with paths)`);
      console.log(`   🔗 Relationships: ${result.relationships} (${result.relationshipsWithFromTo} valid)`);
      console.log(`   🏗️  Layers: ${result.layers} (${result.layersWithModules} with modules)`);
      console.log(`   🎯 Pattern: ${result.pattern} (${Math.round(result.patternConfidence * 100)}%)`);
      console.log(`   📐 Diagram: ${result.hasDiagram ? '✅' : '❌'} (${result.diagramLength} chars)`);
      console.log(`   📄 Summary: ${result.hasSummary ? '✅' : '❌'} (${result.summaryLength} chars)`);
      
      // Quality score
      let qualityScore = 0;
      let maxScore = 5;
      if (result.modulesWithPath === result.modules) qualityScore++;
      if (result.relationshipsWithFromTo === result.relationships || result.relationships === 0) qualityScore++;
      if (result.layersWithModules > 0 || result.layers === 0) qualityScore++;
      if (!result.patternIsUnknown) qualityScore++;
      if (result.hasDiagram && result.hasSummary) qualityScore++;
      
      const qualityPercent = Math.round((qualityScore / maxScore) * 100);
      console.log(`   📊 Quality Score: ${qualityScore}/${maxScore} (${qualityPercent}%)`);
    } else {
      console.log(`   ❌ Failed: ${result.error || 'Unknown error'}`);
    }
    console.log('');
  });

  // Statistics
  const successfulResults = testResults.filter(r => r.success);
  if (successfulResults.length > 0) {
    const avgModules = successfulResults.reduce((sum, r) => sum + r.modules, 0) / successfulResults.length;
    const avgRelationships = successfulResults.reduce((sum, r) => sum + r.relationships, 0) / successfulResults.length;
    const avgLayers = successfulResults.reduce((sum, r) => sum + r.layers, 0) / successfulResults.length;
    const avgPatternConfidence = successfulResults.reduce((sum, r) => sum + r.patternConfidence, 0) / successfulResults.length;
    const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
    
    console.log('📈 AVERAGE STATISTICS:');
    console.log(`   Modules: ${Math.round(avgModules)}`);
    console.log(`   Relationships: ${Math.round(avgRelationships)}`);
    console.log(`   Layers: ${Math.round(avgLayers)}`);
    console.log(`   Pattern Confidence: ${Math.round(avgPatternConfidence * 100)}%`);
    console.log(`   Duration: ${Math.round(avgDuration)}s`);
    console.log(`   Success Rate: ${Math.round((passed / testRepos.length) * 100)}%`);
    console.log('');
  }

  // Final verdict
  console.log('═══════════════════════════════════════════════════════════');
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED! Backend is robust and reliable.');
  } else if (passed > 0) {
    console.log(`⚠️  PARTIAL SUCCESS: ${passed}/${testRepos.length} tests passed.`);
  } else {
    console.log('❌ ALL TESTS FAILED. Check server and Ollama connection.');
  }
  console.log('═══════════════════════════════════════════════════════════\n');

  process.exit(failed === 0 ? 0 : 1);
}

// Check server
const checkReq = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
    timeout: 5000,
  },
  () => {
    runStressTest();
  }
);

checkReq.on('error', () => {
  console.error('❌ Server is not running!');
  console.error('Please start the dev server with: npm run dev');
  process.exit(1);
});

checkReq.on('timeout', () => {
  checkReq.destroy();
  console.log('⚠️  Server check timeout, attempting tests anyway...\n');
  runStressTest();
});

checkReq.end();

