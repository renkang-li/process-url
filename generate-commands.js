const fs = require('fs');

// 读取 SQL 查询结果文件
const inputFile = process.argv[2] || '_select_s_shop_s_id_from_spa_s_left_join_token_t_on_s_shop_t_sho_202601221828.json';
const outputFile = process.argv[3] || 'publish-commands.sh';

// 读取并解析 JSON
const jsonData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// 获取查询结果数组（取第一个 key 的值）
const data = Object.values(jsonData)[0];

// 按 shop 分组 spaIds
const grouped = {};

data.forEach(item => {
  const shop = item.shop;
  const id = item.id;
  
  if (!grouped[shop]) {
    grouped[shop] = [];
  }
  
  grouped[shop].push(id);
});

// 生成命令
const commands = [];

Object.keys(grouped).forEach(shop => {
  const spaIds = grouped[shop].join(',');
  const command = `npx ts-node ./cmd/publish-spa.ts --cmd=publishShopSpa --shop=${shop} --spaIds="${spaIds}" --yes=1`;
  commands.push(command);
});

// 用 && \ 连接所有命令
const shellScript = commands.join(' && \\\n');

// 写入文件
fs.writeFileSync(outputFile, shellScript, 'utf8');

console.log(`命令生成完成！`);
console.log(`共生成 ${commands.length} 个 shop 的发布命令`);
console.log(`输出文件: ${outputFile}`);
console.log('\n前 2 条示例:');
console.log(commands.slice(0, 2).join(' && \\\n'));
