import { describe, expect, it } from "vitest"
import { extractTitle } from "@/server/ai/title-extractor"

describe("title extractor", () => {
  it("extracts 托福 from recurring schedule shell", () => {
    const result = extractTitle("接下来一周我每天晚上9点要做30分钟托福", "schedule_subject")
    expect(result.title).toBe("托福")
    expect(result.confidence).toBeGreaterThanOrEqual(0.95)
  })

  it("extracts 单词 from 背30分钟单词", () => {
    const result = extractTitle("接下来三天每天早上7点背30分钟单词", "schedule_subject")
    expect(result.title).toBe("单词")
    expect(result.confidence).toBeGreaterThanOrEqual(0.95)
  })

  it("extracts 吉他练习 from 练1小时吉他", () => {
    const result = extractTitle("未来一周每晚8点练1小时吉他", "schedule_subject")
    expect(result.title).toBe("吉他练习")
    expect(result.confidence).toBeGreaterThanOrEqual(0.95)
  })

  it("extracts 写报告 from one-off schedule", () => {
    const result = extractTitle("明天下午三点写报告半小时", "schedule_subject")
    expect(result.title).toBe("写报告")
    expect(result.confidence).toBeGreaterThanOrEqual(0.95)
  })

  it("extracts 吃药 from reminder utterance", () => {
    const result = extractTitle("我明天中午十二点要吃药", "task")
    expect(result.title).toBe("吃药")
    expect(result.confidence).toBeGreaterThanOrEqual(0.95)
  })
})
