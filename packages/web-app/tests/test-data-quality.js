const http = require('http');

// Test with RDS repository and check data quality in detail
const repoUrl = 'https://github.com/Time-Open-Source-Foundation/RDS';

function testDataQuality() {
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

    console.log('🔍 DETAILED DATA QUALITY TEST');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📦 Repository: ${repoUrl}\n`);

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
          
          console.log('✅ RESPONSE RECEIVED\n');
          
          // 1. Check response structure
          console.log('1️⃣  RESPONSE STRUCTURE CHECK:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          const structureChecks = {
            'Has modules array': Array.isArray(result.modules),
            'Has relationships array': Array.isArray(result.relationships),
            'Has summary string': typeof result.summary === 'string' && result.summary.length > 0,
            'Has pattern object': result.pattern && typeof result.pattern === 'object',
            'Has layers array': Array.isArray(result.layers),
            'Has diagram string': typeof result.diagram === 'string' && result.diagram.length > 0,
            'Has repoInfo object': result.repoInfo && typeof result.repoInfo === 'object'
          };
          
          Object.entries(structureChecks).forEach(([check, passed]) => {
            console.log(`   ${passed ? '✅' : '❌'} ${check}`);
          });
          
          // 2. Check modules quality
          console.log('\n2️⃣  MODULES QUALITY CHECK:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`   Total Modules: ${result.modules?.length || 0}`);
          
          if (result.modules && result.modules.length > 0) {
            const modulesWithName = result.modules.filter(m => m.name && m.name.length > 0).length;
            const modulesWithPath = result.modules.filter(m => m.path && m.path.length > 0).length;
            const modulesWithType = result.modules.filter(m => m.type && m.type.length > 0).length;
            const modulesWithDescription = result.modules.filter(m => m.description && m.description.length > 0).length;
            
            console.log(`   ✅ Modules with name: ${modulesWithName}/${result.modules.length}`);
            console.log(`   ${modulesWithPath === result.modules.length ? '✅' : '⚠️ '} Modules with path: ${modulesWithPath}/${result.modules.length}`);
            console.log(`   ${modulesWithType === result.modules.length ? '✅' : '⚠️ '} Modules with type: ${modulesWithType}/${result.modules.length}`);
            console.log(`   ${modulesWithDescription > 0 ? '✅' : '⚠️ '} Modules with description: ${modulesWithDescription}/${result.modules.length}`);
            
            // Show sample modules
            console.log('\n   Sample Modules:');
            result.modules.slice(0, 3).forEach((m, i) => {
              console.log(`   ${i + 1}. ${m.name || 'N/A'}`);
              console.log(`      Path: ${m.path || 'MISSING'}`);
              console.log(`      Type: ${m.type || 'MISSING'}`);
              console.log(`      Layer: ${m.layer || 'N/A'}`);
              console.log(`      Description: ${m.description ? m.description.substring(0, 60) + '...' : 'MISSING'}`);
            });
          }
          
          // 3. Check relationships quality
          console.log('\n3️⃣  RELATIONSHIPS QUALITY CHECK:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`   Total Relationships: ${result.relationships?.length || 0}`);
          
          if (result.relationships && result.relationships.length > 0) {
            const relsWithFrom = result.relationships.filter(r => r.from && r.from.length > 0).length;
            const relsWithTo = result.relationships.filter(r => r.to && r.to.length > 0).length;
            const relsWithFromTo = result.relationships.filter(r => r.from && r.to && r.from.length > 0 && r.to.length > 0).length;
            const relsWithType = result.relationships.filter(r => r.type && r.type.length > 0).length;
            
            console.log(`   ${relsWithFrom === result.relationships.length ? '✅' : '⚠️ '} Relationships with 'from': ${relsWithFrom}/${result.relationships.length}`);
            console.log(`   ${relsWithTo === result.relationships.length ? '✅' : '⚠️ '} Relationships with 'to': ${relsWithTo}/${result.relationships.length}`);
            console.log(`   ${relsWithFromTo === result.relationships.length ? '✅' : '⚠️ '} Relationships with both from/to: ${relsWithFromTo}/${result.relationships.length}`);
            console.log(`   ${relsWithType === result.relationships.length ? '✅' : '⚠️ '} Relationships with type: ${relsWithType}/${result.relationships.length}`);
            
            // Show sample relationships
            if (result.relationships.length > 0) {
              console.log('\n   Sample Relationships:');
              result.relationships.slice(0, 3).forEach((r, i) => {
                console.log(`   ${i + 1}. ${r.from || 'MISSING'} → ${r.to || 'MISSING'}`);
                console.log(`      Type: ${r.type || 'MISSING'}`);
                console.log(`      Strength: ${r.strength || 'N/A'}`);
              });
            }
          }
          
          // 4. Check pattern quality
          console.log('\n4️⃣  PATTERN QUALITY CHECK:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          if (result.pattern) {
            console.log(`   ✅ Pattern Name: ${result.pattern.name || 'MISSING'}`);
            console.log(`   ${result.pattern.name !== 'Unknown' ? '✅' : '⚠️ '} Pattern is not 'Unknown'`);
            console.log(`   ✅ Confidence: ${Math.round(result.pattern.confidence * 100)}%`);
            console.log(`   ${result.pattern.description ? '✅' : '⚠️ '} Has Description: ${result.pattern.description ? 'Yes' : 'No'}`);
            if (result.pattern.description) {
              console.log(`   Description: ${result.pattern.description.substring(0, 150)}...`);
            }
          } else {
            console.log('   ❌ No pattern object found');
          }
          
          // 5. Check layers quality
          console.log('\n5️⃣  LAYERS QUALITY CHECK:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`   Total Layers: ${result.layers?.length || 0}`);
          
          if (result.layers && result.layers.length > 0) {
            const layersWithName = result.layers.filter(l => l.name && l.name.length > 0).length;
            const layersWithModules = result.layers.filter(l => l.modules && Array.isArray(l.modules) && l.modules.length > 0).length;
            const totalModulesInLayers = result.layers.reduce((sum, l) => sum + (l.modules?.length || 0), 0);
            
            console.log(`   ✅ Layers with name: ${layersWithName}/${result.layers.length}`);
            console.log(`   ${layersWithModules === result.layers.length ? '✅' : '⚠️ '} Layers with modules: ${layersWithModules}/${result.layers.length}`);
            console.log(`   Total modules in layers: ${totalModulesInLayers}`);
            
            result.layers.forEach((layer, i) => {
              console.log(`\n   Layer ${i + 1}: ${layer.name || 'N/A'}`);
              console.log(`      Modules: ${layer.modules?.length || 0}`);
              if (layer.modules && layer.modules.length > 0) {
                layer.modules.slice(0, 3).forEach(m => console.log(`         - ${m}`));
              }
            });
          }
          
          // 6. Check diagram quality
          console.log('\n6️⃣  DIAGRAM QUALITY CHECK:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          if (result.diagram) {
            const validStarts = ['graph', 'flowchart', 'classDiagram', 'sequenceDiagram'];
            const isValidStart = validStarts.some(start => result.diagram.trim().toLowerCase().startsWith(start.toLowerCase()));
            
            console.log(`   ✅ Diagram present: ${result.diagram.length} chars`);
            console.log(`   ${isValidStart ? '✅' : '❌'} Valid Mermaid format: ${isValidStart ? 'Yes' : 'No'}`);
            console.log(`   Preview: ${result.diagram.substring(0, 200)}...`);
          } else {
            console.log('   ❌ No diagram found');
          }
          
          // 7. Check summary quality
          console.log('\n7️⃣  SUMMARY QUALITY CHECK:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          if (result.summary) {
            console.log(`   ✅ Summary present: ${result.summary.length} chars`);
            console.log(`   Preview: ${result.summary.substring(0, 200)}...`);
          } else {
            console.log('   ❌ No summary found');
          }
          
          // 8. Overall quality score
          console.log('\n8️⃣  OVERALL QUALITY SCORE:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          
          let score = 0;
          let maxScore = 0;
          
          // Structure (7 points)
          maxScore += 7;
          score += Object.values(structureChecks).filter(Boolean).length;
          
          // Modules quality (4 points)
          if (result.modules && result.modules.length > 0) {
            maxScore += 4;
            const modulesWithName = result.modules.filter(m => m.name && m.name.length > 0).length;
            const modulesWithPath = result.modules.filter(m => m.path && m.path.length > 0).length;
            const modulesWithType = result.modules.filter(m => m.type && m.type.length > 0).length;
            const modulesWithDescription = result.modules.filter(m => m.description && m.description.length > 0).length;
            
            if (modulesWithName === result.modules.length) score += 1;
            if (modulesWithPath === result.modules.length) score += 1;
            if (modulesWithType === result.modules.length) score += 1;
            if (modulesWithDescription > 0) score += 1;
          }
          
          // Relationships quality (4 points)
          if (result.relationships && result.relationships.length > 0) {
            maxScore += 4;
            const relsWithFromTo = result.relationships.filter(r => r.from && r.to && r.from.length > 0 && r.to.length > 0).length;
            const relsWithType = result.relationships.filter(r => r.type && r.type.length > 0).length;
            
            if (relsWithFromTo === result.relationships.length) score += 2;
            if (relsWithType === result.relationships.length) score += 2;
          }
          
          // Pattern quality (3 points)
          maxScore += 3;
          if (result.pattern) {
            if (result.pattern.name && result.pattern.name !== 'Unknown') score += 1;
            if (result.pattern.confidence > 0) score += 1;
            if (result.pattern.description) score += 1;
          }
          
          // Layers quality (2 points)
          if (result.layers && result.layers.length > 0) {
            maxScore += 2;
            const layersWithModules = result.layers.filter(l => l.modules && Array.isArray(l.modules) && l.modules.length > 0).length;
            if (layersWithModules > 0) score += 1;
            if (layersWithModules === result.layers.length) score += 1;
          }
          
          const qualityPercentage = Math.round((score / maxScore) * 100);
          const qualityGrade = qualityPercentage >= 90 ? 'A' : qualityPercentage >= 80 ? 'B' : qualityPercentage >= 70 ? 'C' : qualityPercentage >= 60 ? 'D' : 'F';
          
          console.log(`   Score: ${score}/${maxScore} (${qualityPercentage}%)`);
          console.log(`   Grade: ${qualityGrade}`);
          
          if (qualityPercentage >= 80) {
            console.log(`   ✅ Excellent quality!`);
          } else if (qualityPercentage >= 60) {
            console.log(`   ⚠️  Good quality, but has room for improvement`);
          } else {
            console.log(`   ❌ Quality needs improvement`);
          }
          
          console.log('\n═══════════════════════════════════════════════════════════');
          console.log('✅ DATA QUALITY TEST COMPLETE');
          console.log('═══════════════════════════════════════════════════════════\n');
          
          resolve({ result, qualityPercentage, score, maxScore });
        } catch (e) {
          reject({
            error: `Parse error: ${e.message}`,
            body: body.substring(0, 500)
          });
        }
      });
    });

    req.on('error', (e) => {
      reject({ error: `Request error: ${e.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({ error: 'Request timeout' });
    });

    req.write(data);
    req.end();
  });
}

testDataQuality()
  .then(({ qualityPercentage }) => {
    if (qualityPercentage >= 80) {
      console.log('✅ Backend is producing high-quality responses!');
      process.exit(0);
    } else {
      console.log('⚠️  Backend is working but data quality could be improved.');
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('❌ Test failed:', err.error || err.message);
    if (err.body) {
      console.error('Response:', err.body);
    }
    process.exit(1);
  });

