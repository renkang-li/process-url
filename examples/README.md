# 示例文件说明

这个文件夹包含完整的示例数据，展示了工具处理的每个步骤。

## 文件说明

### 1-original-log.json
**原始日志文件（步骤 1 输入）**

NDJSON 格式（每行一个 JSON 对象），包含 Cloudflare 访问日志：
```json
{"CleanReferer":"https://www.shoplumaramagic.com/pages/news-hydroxyapatite-toothpaste"}
{"CleanReferer":"https://chicovel380.kingfish.chat/pages/dan-gao-a"}
...
```

### 2-grouped-log.json
**分组后的日志（步骤 1 输出 / 步骤 2 输入）**

按域名分组，每个域名下包含所有访问的路径：
```json
[
  {
    "domain": "www.availableu.com",
    "paths": [
      "pages/news-stainless-steel-kitchen-cutting-board"
    ]
  },
  ...
]
```

### 3-sql-conditions.txt
**SQL 查询条件（步骤 2 输出）**

生成的 SQL WHERE 条件，用于查询数据库：
```sql
(t.domain='www.availableu.com' and s.pagePath='pages/news-stainless-steel-kitchen-cutting-board') or 
(t.domain='www.makeinpoetry.com' and s.pagePath='pages/news-warm-thermal-gloves-for-cycling-running-and-driving') or 
...
```

**使用方式**：
```sql
SELECT s.shop, s.id
FROM spa s
LEFT JOIN token t ON s.shop = t.shop
WHERE 
  -- 粘贴 3-sql-conditions.txt 的内容
```

### 4-sql-result.json
**SQL 查询结果（步骤 3 输出 / 步骤 4 输入）**

从数据库导出的查询结果，JSON 格式：
```json
{
  "select s.shop,s.id from spa...": [
    {"shop": "akogqyf88.hotishop.com", "id": 147010},
    {"shop": "chicovel380.zenshopin.com", "id": 147035},
    ...
  ]
}
```

### 5-publish-commands.sh
**批量发布命令（步骤 4 输出）**

生成的批量发布命令，可直接在终端执行：
```bash
npx ts-node ./cmd/publish-spa.ts --cmd=publishShopSpa --shop=akogqyf88.hotishop.com --spaIds="147010" --yes=1 && \
npx ts-node ./cmd/publish-spa.ts --cmd=publishShopSpa --shop=chicovel380.zenshopin.com --spaIds="147035,146964" --yes=1 && \
...
```

## 如何使用这些示例

### 在 Web 界面中测试

1. 打开 `web-tool.html`
2. 复制 `1-original-log.json` 的内容到步骤 1
3. 点击"转换"，查看结果是否与 `2-grouped-log.json` 一致
4. 继续后续步骤

### 在命令行中测试

```bash
# 使用示例文件测试（在项目根目录执行）
node convert-log.js examples/1-original-log.json test-output.json
node generate-sql.js examples/2-grouped-log.json test-sql.txt
node generate-commands.js examples/4-sql-result.json test-commands.sh
```

## 数据统计

- **原始日志**: 100 条访问记录
- **分组后**: 74 个不同域名
- **SQL 条件**: 100 个查询条件
- **发布命令**: 72 个 shop，共 100 个 spa

## 文件命名规则

文件名以数字开头，表示处理流程的顺序：
- `1-` 原始输入
- `2-` 第一步处理结果
- `3-` 第二步处理结果
- `4-` 第三步处理结果（需手动执行 SQL）
- `5-` 最终输出

这样可以清楚地看到数据流转的顺序。
