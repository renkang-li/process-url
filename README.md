# 日志处理和发布命令生成工具

这个工具集用于处理 Cloudflare 访问日志，生成 SQL 查询条件，并最终生成批量发布命令。

## 🚀 快速开始（推荐）

### 使用 Web 界面（最简单）

1. 双击打开 `web-tool.html`
2. 按照页面上的 4 个步骤操作：
   - 步骤 1: 粘贴原始日志，点击"转换"
   - 步骤 2: 点击"生成 SQL"，下载结果
   - 步骤 3: 在数据库中执行 SQL 查询
   - 步骤 4: 粘贴查询结果，生成发布命令

**特点**：
- ✅ 无需命令行，全程可视化
- ✅ 实时查看结果
- ✅ 一键下载生成的文件
- ✅ 适合所有用户

## 📁 项目结构

```
.
├── web-tool.html              # Web 界面工具（推荐使用）
├── convert-log.js             # 日志转换脚本（备用）
├── generate-sql.js            # SQL 生成脚本（备用）
├── generate-commands.js       # 命令生成脚本（备用）
├── README.md                  # 本文档
└── examples/                  # 示例文件夹
    ├── 1-original-log.json           # 原始日志示例
    ├── 2-grouped-log.json            # 分组后示例
    ├── 3-sql-conditions.txt          # SQL 条件示例
    ├── 4-sql-result.json             # SQL 查询结果示例
    ├── 5-publish-commands.sh         # 发布命令示例
    └── README.md                     # 示例说明
```

## 🛠️ 备用工具（命令行方式）

如果需要在命令行中使用，可以直接调用原始脚本：

```bash
# 步骤 1: 转换日志
node convert-log.js 输入文件.json 输出文件.json

# 步骤 2: 生成 SQL 条件
node generate-sql.js 输入文件.json 输出文件.txt

# 步骤 3: 生成发布命令
node generate-commands.js SQL结果.json 输出文件.sh
```

## 📝 工作流程说明

### 步骤 1: 转换日志为分组格式

**输入**: NDJSON 格式的访问日志
```json
{"CleanReferer":"https://www.example.com/pages/product"}
{"CleanReferer":"https://www.example.com/pages/about"}
```

**输出**: 按域名分组的 JSON
```json
[
  {
    "domain": "www.example.com",
    "paths": ["pages/product", "pages/about"]
  }
]
```

### 步骤 2: 生成 SQL 查询条件

**输入**: 步骤 1 的输出

**输出**: SQL WHERE 条件
```sql
(t.domain='www.example.com' and s.pagePath='pages/product') or 
(t.domain='www.example.com' and s.pagePath='pages/about')
```

### 步骤 3: 执行 SQL 查询（手动）

在数据库中执行：
```sql
SELECT s.shop, s.id
FROM spa s
LEFT JOIN token t ON s.shop = t.shop
WHERE 
  -- 粘贴步骤 2 生成的条件
```

导出结果为 JSON 格式。

### 步骤 4: 生成批量发布命令

**输入**: SQL 查询结果 JSON

**输出**: 批量发布命令
```bash
npx ts-node ./cmd/publish-spa.ts --cmd=publishShopSpa --shop=example.com --spaIds="123,456" --yes=1 && \
npx ts-node ./cmd/publish-spa.ts --cmd=publishShopSpa --shop=example2.com --spaIds="789" --yes=1
```

## 💡 示例文件

`examples/` 文件夹包含完整的示例数据，可以用来测试工具：

1. 查看 `1-original-log.json` - 原始日志格式
2. 查看 `2-grouped-log.json` - 转换后的格式
3. 查看 `3-sql-conditions.txt` - 生成的 SQL 条件
4. 查看 `4-sql-result.json` - SQL 查询结果格式
5. 查看 `5-publish-commands.sh` - 最终的发布命令

## ⚠️ 注意事项

1. 生成的 SQL 条件可能很长，注意数据库查询限制
2. 执行发布命令前建议先检查生成的命令是否正确
3. 批量发布命令会按顺序执行，如果某个失败会中断后续执行
4. 建议先用示例文件测试工具是否正常工作

## 🎯 推荐使用方式

- **首次使用**: 查看 `examples/` 文件夹了解数据格式
- **日常使用**: 直接使用 Web 界面 (`web-tool.html`)
- **批量处理**: 使用命令行脚本自动化处理
