const fs = require('fs');

// 读取分组后的 JSON 文件
const inputFile = process.argv[2] || 'wshop-cloudflare_access-log_grouped_new.json';
const outputFile = process.argv[3] || 'sql-conditions.txt';

// 读取并解析 JSON
const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// 生成 SQL 条件
const conditions = [];

data.forEach(item => {
  const domain = item.domain;
  item.paths.forEach(path => {
    conditions.push(`(t.domain='${domain}' and s.pagePath='${path}')`);
  });
});

// 用 or 连接所有条件
const sqlCondition = conditions.join(' or \n');

// 写入文件
fs.writeFileSync(outputFile, sqlCondition, 'utf8');

console.log(`SQL 条件生成完成！`);
console.log(`共生成 ${conditions.length} 个条件`);
console.log(`输出文件: ${outputFile}`);
console.log('\n前 3 条示例:');
console.log(conditions.slice(0, 3).join(' or \n'));
