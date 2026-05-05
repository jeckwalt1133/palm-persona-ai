# palm-mcp-server

掌心人格局 MCP Server — 基于 Model Context Protocol 的合规检查、报告查询和文案生成服务。

## 快速开始

```bash
pnpm install
pnpm dev        # 开发运行
pnpm build      # 构建
pnpm typecheck  # 类型检查
```

## MCP 能力

### 3 Tools
| 工具 | 描述 |
|------|------|
| `check_compliance` | 27项禁用词检查，返回违规词和替换建议 |
| `query_reports` | 查询人格报告(ID/类型/日期筛选) |
| `analyze_persona` | 五维人格分析+文案生成 |

### 3 Resources
| URI | 内容 |
|-----|------|
| `palm://compliance/terms` | 27项禁用词(5类分组) |
| `palm://compliance/replacements` | 禁用词→替换映射 |
| `palm://persona/dimensions` | 五维人格维度说明 |

### 3 Prompts
| Prompt | 用途 |
|--------|------|
| `analyze_report` | 全面报告分析 |
| `draft_caption` | 社交文案生成(weapp/tt) |
| `compliance_check` | 三级合规检查 |

## 配置 Claude Code

在 `.mcp.json` 中添加：
```json
{
  "mcpServers": {
    "palm": {
      "command": "npx",
      "args": ["palm-mcp-server"]
    }
  }
}
```

## 合规说明

实现微信小程序审核合规：
- 27项禁用词自动检测替换
- 5类分组：命理/命运/关系/绝对化/灾祸
- 三级审查：阻断/警告/建议

## 技术栈
- TypeScript strict + MCP SDK v1.29+
- STDIO传输 + Streamable HTTP可选
- MIT License — 富贵军团
