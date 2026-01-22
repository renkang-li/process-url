const fs = require('fs');

// 读取 NDJSON 文件
const inputFile = process.argv[2] || 'wshop-cloudflare_access-log_20260122_171120.json';
const outputFile = process.argv[3] || 'wshop-cloudflare_access-log_grouped.json';

// 读取并解析每一行
const data = fs.readFileSync(inputFile, 'utf8')
  .trim()
  .split('\n')
  .map(line => JSON.parse(line));

// 按域名分组
const grouped = {};

data.forEach(item => {
  try {
    const url = new URL(item.CleanReferer);
    const domain = url.hostname;
    const path = url.pathname.substring(1); // 去掉开头的 /

    if (!grouped[domain]) {
      grouped[domain] = [];
    }

    // 避免重复路径
    if (path && !grouped[domain].includes(path)) {
      grouped[domain].push(path);
    }
  } catch (e) {
    console.error('解析失败:', item.CleanReferer);
  }
});

// 转换为数组格式
const result = Object.keys(grouped).map(domain => ({
  domain,
  paths: grouped[domain]
}));

// 写入文件
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');

console.log(`转换完成！共 ${result.length} 个域名`);
console.log(`输出文件: ${outputFile}`);
