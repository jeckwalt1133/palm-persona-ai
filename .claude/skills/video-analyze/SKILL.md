---
name: video-analyze
description: Download video from URL, extract keyframes with ffmpeg, analyze frames via DeepSeek Vision API, output structured learning report. Use when user posts a video link.
---

# Video Analyze — 视频下载→拆帧→AI分析→输出报告

## 触发条件

用户发送视频链接（抖音/B站/YouTube/任意），并期望自动分析视频内容。识别到视频 URL 时自动调用此 skill。

## 输入

- `URL`: 视频链接（必需）
- `REPORT_TYPE`: `learning`（学习笔记）/ `summary`（摘要）/ `full`（逐帧完整）（默认 `learning`）

---

## Phase 1: 下载视频

### 1.1 判断平台，选择下载策略

```bash
URL="用户提供的链接"

# 抖音 / B站 / YouTube：优先 yt-dlp
if echo "$URL" | grep -qE 'douyin\.com|bilibili\.com|youtube\.com|youtu\.be'; then
  # 先检查 yt-dlp 是否存在
  if ! which yt-dlp >/dev/null 2>&1; then
    pip install yt-dlp 2>/dev/null || \
    curl -L -o /tmp/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" && chmod +x /tmp/yt-dlp
  fi
fi
```

### 1.2 尝试方式（按优先级）

**方式 A — 直接 curl 提取 CDN 直链（无 cookies 场景）**：
```bash
# 对于抖音：通过短链接重定向拿到 video_id，再从页面 JSON 提取 play_addr
PAGE=$(curl -sL -A "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15" "$URL")
# 提取 video_id
VIDEO_ID=$(echo "$PAGE" | grep -oP 'video/(\d+)' | head -1 | cut -d/ -f2)

# 若拿到 play_addr，带 Referer 请求获取 302 重定向到 CDN
CDN_URL=$(curl -sI -A "Mozilla/5.0 ..." -H "Referer: https://www.iesdouyin.com/" \
  "https://aweme.snssdk.com/aweme/v1/playwm/?video_id=VIDEO_ID" 2>&1 | grep -i location | cut -d' ' -f2)

curl -L -o /tmp/video_analyze_source.mp4 -A "Mozilla/5.0 ..." -H "Referer: https://www.iesdouyin.com/" "$CDN_URL"
```

**方式 B — yt-dlp（有 cookies 或有浏览器登录态）**：
```bash
yt-dlp --cookies-from-browser chrome -o /tmp/video_analyze_source.mp4 "$URL"
# 如果 chrome 锁定，试 edge
yt-dlp --cookies-from-browser edge -o /tmp/video_analyze_source.mp4 "$URL"
```

**方式 C — 直接 curl 下载（通用直链）**：
```bash
curl -L -o /tmp/video_analyze_source.mp4 -A "Mozilla/5.0" "$URL"
```

### 1.3 验证下载

```bash
file /tmp/video_analyze_source.mp4  # 应为 ISO Media / MP4
ls -lh /tmp/video_analyze_source.mp4
```

若文件不是有效视频 → 报告失败，让用户手动提供视频文件或检查登录态。

---

## Phase 2: 安装/确认 ffmpeg

```bash
# 检查是否已有
if ! which ffmpeg >/dev/null 2>&1; then
  # 下载静态二进制（无需 sudo）
  curl -L -o /tmp/ffmpeg.tar.xz "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
  tar -xf /tmp/ffmpeg.tar.xz -C /tmp
  FFMPEG=$(ls /tmp/ffmpeg-*-amd64-static/ffmpeg | head -1)
  FFPROBE=$(ls /tmp/ffmpeg-*-amd64-static/ffprobe | head -1)
else
  FFMPEG=ffmpeg
  FFPROBE=ffprobe
fi
```

---

## Phase 3: 提取视频元数据 & 关键帧

### 3.1 获取视频信息

```bash
$FFPROBE -v quiet -print_format json -show_format -show_streams /tmp/video_analyze_source.mp4
```

从中提取：时长、分辨率、帧率、编码、总帧数。

### 3.2 提取关键帧

```bash
mkdir -p /tmp/video_frames

# 每 10 秒一帧（平衡覆盖面和数量）
$FFMPEG -i /tmp/video_analyze_source.mp4 -vf "fps=1/10" -q:v 3 /tmp/video_frames/time_%04d.jpg

# 场景切换帧（捕获内容突变）
$FFMPEG -i /tmp/video_analyze_source.mp4 -vf "select='gt(scene,0.4)'" -vsync vfr -q:v 3 /tmp/video_frames/scene_%04d.jpg
```

### 3.3 提取音频（可选，如有语音识别可用）

```bash
$FFMPEG -i /tmp/video_analyze_source.mp4 -q:a 2 /tmp/video_audio.mp3
```

---

## Phase 4: DeepSeek Vision API 逐帧分析

### 4.1 API 配置

从项目 `.env` 或环境变量读取 `DEEPSEEK_API_KEY`。若缺失，提示用户配置。

```bash
# 检查 API Key
if [ -z "$DEEPSEEK_API_KEY" ]; then
  # 尝试从项目 .env 读取
  source .env 2>/dev/null
  if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "⚠️ 请设置 DEEPSEEK_API_KEY 环境变量或在 .env 中配置"
    echo "获取地址: https://platform.deepseek.com/api_keys"
    exit 1
  fi
fi
```

### 4.2 逐帧调用 Vision API

对每个关键帧（先排序，优先场景切换帧 + 均匀采样），**最多 30 帧**避免超预算：

```bash
# 选出要分析的帧（最多 30 帧，优先场景切换帧）
ls /tmp/video_frames/scene_*.jpg | head -20 > /tmp/frames_to_analyze.txt
ls /tmp/video_frames/time_*.jpg | sort -R | head -10 >> /tmp/frames_to_analyze.txt
```

对每帧调用 API：

```bash
#!/bin/bash
REPORT=""
FRAME_COUNT=$(wc -l < /tmp/frames_to_analyze.txt)
CURRENT=0

while IFS= read -r frame; do
  CURRENT=$((CURRENT + 1))
  echo "[${CURRENT}/${FRAME_COUNT}] 分析: $frame"

  # 转 base64
  BASE64=$(base64 -w0 "$frame")

  # 调用 DeepSeek Vision API（OpenAI 兼容格式）
  RESP=$(curl -s https://api.deepseek.com/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
    -d '{
      "model": "deepseek-chat",
      "messages": [{
        "role": "user",
        "content": [
          {"type": "text", "text": "请用中文详细描述这张视频截图的画面内容：人物是谁、在说什么（如有文字/字幕请逐字抄录）、场景是什么、关键信息点。要求：200字以内，客观准确，不编造。"},
          {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,'$BASE64'"}}
        ]
      }],
      "max_tokens": 500,
      "temperature": 0.3
    }')

  # 提取回答
  ANSWER=$(echo "$RESP" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  print(d['choices'][0]['message']['content'])
except:
  print('[API ERROR]')
" 2>/dev/null)

  # 获取帧时间戳（从文件名推断）
  FRAME_NUM=$(echo "$frame" | grep -oP '\d+')
  REPORT="${REPORT}\n\n### 帧 ${FRAME_NUM}\n${ANSWER}"

  # 控制频率，避免限流（每秒 1 帧）
  sleep 1
done < /tmp/frames_to_analyze.txt
```

### 4.3 处理视频元数据（额外上下文）

从页面获取视频标题、描述、作者等：

```bash
# 尝试从页面提取 JSON 元数据（抖音/通用）
curl -sL -A "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" "$URL" | \
  python3 -c "
import re,json,sys
html=sys.stdin.read()
m=re.search(r'window\._ROUTER_DATA\s*=\s*(\{.+?\})\s*</script>', html)
if m:
  d=json.loads(m.group(1))
  # 遍历到 item_list
  def find_items(obj, depth=0):
    if depth>10: return None
    if isinstance(obj, dict):
      if 'item_list' in obj: return obj['item_list']
      if 'aweme_id' in obj: return [obj]
      for v in obj.values():
        r=find_items(v, depth+1)
        if r: return r
    return None
  items = find_items(d)
  if items:
    i=items[0]
    print(f'标题: {i.get(\"desc\",\"?\")}')
    print(f'作者: {i.get(\"author\",{}).get(\"nickname\",\"?\")}')
    print(f'时长: {i.get(\"video\",{}).get(\"duration\",0)/1000:.0f}秒')
    tags=[t.get('hashtag_name','') for t in i.get('text_extra',[])]
    print(f'标签: {\" \".join(tags)}')
"
```

---

## Phase 5: 生成报告

### 5.1 获取页面 Metadata（已有则跳过）

### 5.2 组装最终报告

按以下结构输出到 `docs/video-report-{标题}-{日期}.md`：

```markdown
# 视频分析报告：{标题}

**来源**: {URL} | **作者**: {作者} | **时长**: {时长} | **分析帧数**: {N}

---

## 一、视频概览

- 标题、作者、平台、时长、标签
- 一句话总结

## 二、帧分析结果

{按时间顺序排列的帧描述}

## 三、内容结构

- 时间轴 + 主题分段
- 每个段落的主题和关键信息

## 四、关键观点提取

- 核心论点（3-5条）
- 论据支撑

## 五、学习要点

{只有 REPORT_TYPE=learning 时输出}
- 可落地的行动项
- 关键认知

## 六、附录

- 下载链接（如有）
- 分析帧清单
```

### 5.3 报告风格要求

- 所有文字使用简体中文
- 客观、准确、不编造
- 逐字抄录字幕/文字（OCR 结果）
- 标注帧时间戳
- 对无法识别的内容标注 `[无法识别]`

---

## Phase 6: 清理

```bash
# 保留视频和报告，清理临时帧
rm -rf /tmp/video_frames /tmp/frames_to_analyze.txt
# 可选保留音频：/tmp/video_audio.mp3
# 可选保留视频：/tmp/video_analyze_source.mp4
```

---

## 错误处理

| 错误场景 | 处理 |
|---------|------|
| yt-dlp 无 cookies | 尝试 curl + 页面解析提取 CDN 直链 |
| 页面无 JSON 数据 | 仅用帧分析，跳过元数据 |
| API Key 缺失 | 提示用户去 platform.deepseek.com 获取 |
| API 限流 429 | 加大 sleep 间隔，重试 |
| 帧数太多（>50） | 智能采样：场景切换帧优先 + 均匀抽 10 帧 |
| 视频下载失败 | 提示用户提供本地文件路径 |
| ffmpeg 安装失败 | 尝试 apt/pip/静态二进制 |

---

## 成本告警

DeepSeek Vision API 按 token 计费。每帧约 500-2000 token（含图片）。30 帧约 15K-60K token。
对 11 分钟视频（30 帧），成本约 ¥0.1-0.5。
分析前需告知用户估算成本，超过 ¥1 需确认。

---

## 示例

```bash
/video-analyze https://v.douyin.com/85IbbQ71wrI/
```
