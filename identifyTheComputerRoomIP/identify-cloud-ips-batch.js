const fs = require('fs');
const path = require('path');
const http = require('http');

const csvFile = path.join(__dirname, 'Discover_2026-March-20_96118.csv');
const cacheFile = path.join(__dirname, 'ip-cache.json');
const resultFile = path.join(__dirname, 'cloud-ips-result.json');

const cloudProviders = {
  'AWS': ['amazon', 'aws', 'ec2'],
  'Google Cloud': ['google', 'gcp', 'cloud'],
  'Microsoft Azure': ['microsoft', 'azure'],
  'Alibaba Cloud': ['alibaba', 'aliyun', 'alicloud'],
  'Tencent Cloud': ['tencent'],
  'DigitalOcean': ['digitalocean'],
  'Linode': ['linode'],
  'Vultr': ['vultr'],
  'OVH': ['ovh'],
  'Hetzner': ['hetzner'],
  'Cloudflare': ['cloudflare'],
  'Akamai': ['akamai'],
  'Oracle Cloud': ['oracle'],
  'IBM Cloud': ['ibm'],
  'Huawei Cloud': ['huawei'],
  'Rackspace': ['rackspace'],
  'Contabo': ['contabo']
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeReadJson(file, defaultValue) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {
    console.warn(`读取 ${file} 失败，使用默认值`);
  }
  return defaultValue;
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadIPsFromCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n')
    .map(line => line.trim())
    .filter(line => line && line !== 'user.ip' && line !== '""');
  
  const ipCount = {};
  for (const ip of lines) {
    if (isIPv4(ip)) {
      ipCount[ip] = (ipCount[ip] || 0) + 1;
    }
  }
  
  return { lines, ipCount };
}

function isIPv4(ip) {
  const parts = ip.split('.');
  return parts.length === 4 && 
         parts.every(p => /^\d+$/.test(p) && +p >= 0 && +p <= 255);
}

function identifyCloudProvider(info) {
  const searchText = `${info.isp || ''} ${info.org || ''} ${info.as || ''}`.toLowerCase();
  
  for (const [provider, keywords] of Object.entries(cloudProviders)) {
    if (keywords.some(keyword => searchText.includes(keyword))) {
      return provider;
    }
  }
  
  if (info.hosting) return 'Other Cloud/Hosting';
  return null;
}

function pickIPs(ipCount) {
  const frequentIPs = Object.entries(ipCount)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([ip, count]) => ({ ip, count }));
  
  const lowFreqIPs = Object.entries(ipCount)
    .filter(([, count]) => count === 1)
    .map(([ip]) => ip);
  
  const sampleSize = Math.min(50, lowFreqIPs.length);
  const shuffled = lowFreqIPs.sort(() => Math.random() - 0.5);
  const sampledIPs = shuffled.slice(0, sampleSize);
  
  return {
    frequentIPs,
    sampledIPs,
    ipsToCheck: [
      ...frequentIPs.map(x => x.ip),
      ...sampledIPs
    ]
  };
}

function postBatchQuery(ips) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(ips);
    
    const req = http.request({
      hostname: 'ip-api.com',
      path: '/batch?fields=status,message,country,isp,org,as,hosting,query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Node-IP-Batch-Checker/1.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });
    
    req.on('error', (err) => {
      resolve({
        statusCode: 0,
        headers: {},
        data: null,
        error: err.message
      });
    });
    
    req.write(payload);
    req.end();
  });
}

async function batchQueryIPs(ipsToCheck, ipCount, cache, startTime) {
  const results = [];
  const cloudIPs = [];
  const uncached = ipsToCheck.filter(ip => !cache[ip]);
  
  console.log(`总共待查 ${ipsToCheck.length} 个 IP，其中缓存命中 ${ipsToCheck.length - uncached.length} 个，需新查 ${uncached.length} 个\n`);
  
  // 先使用缓存
  for (const ip of ipsToCheck) {
    const info = cache[ip];
    if (!info) continue;
    
    const result = {
      ip,
      count: ipCount[ip] || 0,
      country: info.country,
      isp: info.isp,
      org: info.org,
      asn: info.as,
      hosting: info.hosting,
      cloudProvider: identifyCloudProvider(info)
    };
    
    results.push(result);
    if (result.cloudProvider) cloudIPs.push(result);
  }
  
  // 批量查询未命中的
  const chunkSize = 100; // batch 接口最多 100 个
  for (let i = 0; i < uncached.length; i += chunkSize) {
    const chunk = uncached.slice(i, i + chunkSize);
    const batchNum = Math.floor(i / chunkSize) + 1;
    const totalBatches = Math.ceil(uncached.length / chunkSize);
    const progress = Math.round((i / uncached.length) * 100);
    
    console.log(`查询批次 ${batchNum}/${totalBatches} (${progress}%): ${i + 1}-${Math.min(i + chunkSize, uncached.length)}/${uncached.length}`);
    
    const response = await postBatchQuery(chunk);
    
    if (!Array.isArray(response.data)) {
      console.log(`  ✗ 批量查询失败: HTTP ${response.statusCode}, ${response.error || '返回非 JSON/非数组'}`);
      await sleep(3000);
      continue;
    }
    
    for (const info of response.data) {
      const ip = info.query;
      if (!ip) continue;
      
      cache[ip] = info;
      
      if (info.status !== 'success') {
        console.log(`  ✗ ${ip} - ${info.message || '查询失败'}`);
        continue;
      }
      
      const result = {
        ip,
        count: ipCount[ip] || 0,
        country: info.country,
        isp: info.isp,
        org: info.org,
        asn: info.as,
        hosting: info.hosting,
        cloudProvider: identifyCloudProvider(info)
      };
      
      results.push(result);
      
      if (result.cloudProvider) {
        cloudIPs.push(result);
        console.log(`  ✓ ${ip} (出现${result.count}次) - ${result.cloudProvider} | ${result.org || result.isp || 'Unknown'}`);
      }
    }
    
    // 保存缓存
    saveJson(cacheFile, cache);
    
    // 智能限流
    const remaining = Number(response.headers['x-rl']);
    const ttl = Number(response.headers['x-ttl']);
    
    if (!Number.isNaN(remaining) && !Number.isNaN(ttl)) {
      console.log(`  当前限额剩余: ${remaining}, 重置倒计时: ${ttl}s`);
      
      if (remaining <= 0 && i + chunkSize < uncached.length) {
        console.log(`  等待 ${ttl + 1}s 后继续...\n`);
        await sleep((ttl + 1) * 1000);
      }
    } else {
      // 兜底等待
      if (i + chunkSize < uncached.length) {
        await sleep(1500);
      }
    }
    
    // 显示预估剩余时间
    if (i + chunkSize < uncached.length) {
      const elapsed = Date.now() - startTime;
      const avgTimePerBatch = elapsed / (batchNum);
      const remainingBatches = totalBatches - batchNum;
      const eta = Math.round((avgTimePerBatch * remainingBatches) / 1000);
      console.log(`  预计剩余时间: ${eta}秒\n`);
    }
  }
  
  return { results, cloudIPs, cache };
}

function summarize(lines, ipCount, checkedIPs, results, cloudIPs) {
  const providerStats = {};
  let totalCloudCount = 0;
  
  for (const item of cloudIPs) {
    if (!providerStats[item.cloudProvider]) {
      providerStats[item.cloudProvider] = { ips: 0, totalCount: 0 };
    }
    providerStats[item.cloudProvider].ips += 1;
    providerStats[item.cloudProvider].totalCount += item.count;
    totalCloudCount += item.count;
  }
  
  return {
    summary: {
      totalRecords: lines.length,
      uniqueIPs: Object.keys(ipCount).length,
      checkedIPs,
      cloudIPs: cloudIPs.length,
      cloudRecords: totalCloudCount,
      providerStats
    },
    cloudIPs: cloudIPs.sort((a, b) => b.count - a.count),
    allResults: results.sort((a, b) => b.count - a.count)
  };
}

(async () => {
  const startTime = Date.now();
  
  const { lines, ipCount } = loadIPsFromCSV(csvFile);
  const { frequentIPs, sampledIPs, ipsToCheck } = pickIPs(ipCount);
  const cache = safeReadJson(cacheFile, {});
  
  console.log(`总共 ${lines.length} 条记录，${Object.keys(ipCount).length} 个唯一 IP`);
  console.log(`高频 IP: ${frequentIPs.length} 个，采样 IP: ${sampledIPs.length} 个，总计待查: ${ipsToCheck.length}\n`);
  
  const { results, cloudIPs } = await batchQueryIPs(ipsToCheck, ipCount, cache, startTime);
  
  const output = summarize(lines, ipCount, ipsToCheck.length, results, cloudIPs);
  output.summary.queryTime = `${Math.round((Date.now() - startTime) / 1000)} 秒`;
  
  saveJson(resultFile, output);
  
  console.log('\n=== 云服务商 IP 统计 ===');
  console.log(`识别出 ${cloudIPs.length} 个云服务商 IP，共出现 ${output.summary.cloudRecords} 次\n`);
  
  Object.entries(output.summary.providerStats)
    .sort((a, b) => b[1].totalCount - a[1].totalCount)
    .forEach(([provider, stats]) => {
      console.log(`${provider}: ${stats.ips} 个 IP，出现 ${stats.totalCount} 次`);
    });
  
  console.log(`\n结果已保存到: ${resultFile}`);
  console.log(`缓存已保存到: ${cacheFile}`);
  console.log(`查询耗时: ${output.summary.queryTime}`);
})();
