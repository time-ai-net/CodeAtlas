const http = require('http');

const testRepos = [
  {
    name: 'RDS (Flask App)',
    url: 'https://github.com/Time-Open-Source-Foundation/RDS',
    expectedType: 'Flask/Python'
  },
  {
    name: 'Small React App',
    url: 'https://github.com/aayush-time518/nexusgamingcasino',
    expectedType: 'React/Next.js'
  },
  {
    name: 'DeepTutor',
    url: 'https://github.com/HKUDS/DeepTutor',
    expectedType: 'Python/ML'
  }
];

function testRepository(repo) {
  return new Promise((resolve, reject) => {
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

    console.log(`\n🧪 Testing: ${repo.name}`);
    console.log(`   URL: ${repo.url}`);
    console.log(`   Expected: ${repo.expectedType}`);
    console.log('   ⏳ Analyzing...');

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
          
          const testResult = {
            name: repo.name,
            url: repo.url,
            duration,
            status: res.statusCode,
            success: res.statusCode === 200 && !result.error,
            modules: result.modules?.length || 0,
            relationships: result.relationships?.length || 0,
            layers: result.layers?.length || 0,
            hasPattern: !!result.pattern && result.pattern.name !== 'Unknown',
            patternName: result.pattern?.name || 'N/A',
            patternConfidence: result.pattern?.confidence || 0,
            hasDiagram: !!result.diagram,
            diagramLength: result.diagram?.length || 0,
            hasSummary: !!result.summary,
            summaryLength: result.summary?.length || 0,
            fileCount: result.repoInfo?.fileCount || 0,
            hasError: !!result.error,
            error: result.error,
            parsingWarnings: result.parsingWarnings?.length || 0,
            // Check data quality
            modulesWithPath: result.modules?.filter(m => m.path && m.path.length > 0).length || 0,
            modulesWithName: result.modules?.filter(m => m.name && m.name.length > 0).length || 0,
            relationshipsWithFromTo: result.relationships?.filter(r => r.from && r.to && r.from.length > 0 && r.to.length > 0).length || 0,
            layersWithModules: result.layers?.filter(l => l.modules && l.modules.length > 0).length || 0,
            rawResponse: result.rawResponse ? result.rawResponse.substring(0, 200) : null
          };
          
          resolve(testResult);
        } catch (e) {
          reject({
            name: repo.name,
            url: repo.url,
            error: `Parse error: ${e.message}`,
            body: body.substring(0, 500)
          });
        }
      });
    });

    req.on('error', (e) => {
      reject({
        name: repo.name,
        url: repo.url,
        error: `Request error: ${e.message}`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        name: repo.name,
        url: repo.url,
        error: 'Request timeout'
      });
    });

    req.write(data);
    req.end();
  });
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 COMPREHENSIVE BACKEND TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Testing ${testRepos.length} repositories...\n`);

  const results = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < testRepos.length; i++) {
    const repo = testRepos[i];
    try {
      const result = await testRepository(repo);
      results.push(result);
      
      if (result.success) {
        passed++;
        console.log(`   ✅ PASSED (${result.duration}s)`);
        console.log(`      Modules: ${result.modules}, Relationships: ${result.relationships}`);
        console.log(`      Pattern: ${result.patternName} (${Math.round(result.patternConfidence * 100)}%)`);
        console.log(`      Diagram: ${result.diagramLength} chars`);
      } else {
        failed++;
        console.log(`   ❌ FAILED`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      }
    } catch (error) {
      failed++;
      results.push({
        name: repo.name,
        url: repo.url,
        success: false,
        error: error.error || error.message
      });
      console.log(`   ❌ FAILED: ${error.error || error.message}`);
    }
    
    // Small delay between tests
    if (i < testRepos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Total Tests: ${testRepos.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}\n`);

  // Detailed results
  results.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.name}`);
    console.log(`   URL: ${result.url}`);
    if (result.success) {
      console.log(`   ✅ Status: ${result.status} (${result.duration}s)`);
      console.log(`   📦 Files Analyzed: ${result.fileCount}`);
      console.log(`   📝 Modules: ${result.modules} (${result.modulesWithName} with names, ${result.modulesWithPath} with paths)`);
      console.log(`   🔗 Relationships: ${result.relationships} (${result.relationshipsWithFromTo} with valid from/to)`);
      console.log(`   🏗️  Layers: ${result.layers} (${result.layersWithModules} with modules)`);
      console.log(`   🎯 Pattern: ${result.patternName} (${Math.round(result.patternConfidence * 100)}% confidence)`);
      console.log(`   📐 Diagram: ${result.hasDiagram ? '✅' : '❌'} (${result.diagramLength} chars)`);
      console.log(`   📄 Summary: ${result.hasSummary ? '✅' : '❌'} (${result.summaryLength} chars)`);
      console.log(`   ⚠️  Parsing Warnings: ${result.parsingWarnings}`);
      
      // Data quality checks
      const qualityIssues = [];
      if (result.modulesWithPath < result.modules) {
        qualityIssues.push(`${result.modules - result.modulesWithPath} modules missing paths`);
      }
      if (result.relationshipsWithFromTo < result.relationships) {
        qualityIssues.push(`${result.relationships - result.relationshipsWithFromTo} relationships missing from/to`);
      }
      if (result.layersWithModules === 0 && result.layers > 0) {
        qualityIssues.push('Layers not mapped to modules');
      }
      if (result.patternName === 'Unknown' && result.patternConfidence > 0) {
        qualityIssues.push('Pattern identified as Unknown');
      }
      
      if (qualityIssues.length > 0) {
        console.log(`   ⚠️  Quality Issues: ${qualityIssues.join(', ')}`);
      } else {
        console.log(`   ✅ Data Quality: Excellent`);
      }
    } else {
      console.log(`   ❌ Failed: ${result.error || 'Unknown error'}`);
    }
    console.log('');
  });

  // Overall statistics
  const successfulResults = results.filter(r => r.success);
  if (successfulResults.length > 0) {
    const avgModules = successfulResults.reduce((sum, r) => sum + r.modules, 0) / successfulResults.length;
    const avgRelationships = successfulResults.reduce((sum, r) => sum + r.relationships, 0) / successfulResults.length;
    const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
    const avgPatternConfidence = successfulResults.reduce((sum, r) => sum + r.patternConfidence, 0) / successfulResults.length;
    
    console.log('📈 AVERAGE STATISTICS (Successful Tests):');
    console.log(`   Average Modules: ${Math.round(avgModules)}`);
    console.log(`   Average Relationships: ${Math.round(avgRelationships)}`);
    console.log(`   Average Duration: ${Math.round(avgDuration)}s`);
    console.log(`   Average Pattern Confidence: ${Math.round(avgPatternConfidence * 100)}%`);
    console.log(`   Diagram Generation Success: ${successfulResults.filter(r => r.hasDiagram).length}/${successfulResults.length}`);
    console.log('');
  }

  // Final verdict
  console.log('═══════════════════════════════════════════════════════════');
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED! Backend is working correctly.');
  } else if (passed > 0) {
    console.log(`⚠️  PARTIAL SUCCESS: ${passed}/${testRepos.length} tests passed.`);
  } else {
    console.log('❌ ALL TESTS FAILED. Check server and Ollama connection.');
  }
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Check if server is running first
console.log('🔍 Checking if server is running...');
const checkReq = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
    timeout: 5000,
  },
  () => {
    console.log('✅ Server is running!\n');
    runAllTests().catch(err => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
  }
);

checkReq.on('error', () => {
  console.error('❌ Server is not running!');
  console.error('Please start the dev server with: npm run dev');
  process.exit(1);
});

checkReq.on('timeout', () => {
  checkReq.destroy();
  // Try to run tests anyway - server might be slow to respond
  console.log('⚠️  Server check timeout, attempting tests anyway...\n');
  runAllTests().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
});

checkReq.end();

