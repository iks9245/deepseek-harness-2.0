# Agent Note: Web 語系目錄中的繁體中文

Status: implemented

[English](2026-09-05-traditional-chinese-web-locale.md) | 中文

## Problem

Web 用戶端原本只提供 `zh` 的簡體中文與英文。使用繁體中文的讀者無法選擇完整翻譯的介面，而 `zh-Hant` 瀏覽器偏好會因主語言子標籤比對而解析為簡體中文。

## Decision

**內建目錄包含 `zh`、`zh-TW` 與 `en`。** `zh` 繼續作為已儲存偏好與瀏覽器比對使用的簡體中文。 `zh-TW` 在每個內建命名空間提供台灣慣用繁中，於設定中顯示為繁體中文，透過既有的 `locale.preference` 欄位保存，並設定 `<html lang="zh-TW">`。

**中文書寫系統比對會辨識繁中。** 精確的語系 id 仍優先。 `zh-Hant` 或 `zh-TW` 瀏覽器標籤選擇 `zh-TW`；其他中文標籤維持既有的 `zh` 主子標籤解析。

**產品錯誤提示會翻譯，診斷資料保持原文。** 字典擁有的失敗標籤與操作會以所選語言顯示。Provider、作業系統與 wire 訊息會保留為細節，因為翻譯它們會改變診斷使用的證據。

這項決定取代[完整用戶端語系推廣](../architecture/2026-07-30-client-locale-full-rollout.zh.md)中內建目錄僅兩種語言的事實，以及[瀏覽器衍生的初始語系](2026-07-31-browser-derived-initial-locale.zh.md)中繁中瀏覽器比對的事實。

## Alternatives considered

**以繁中取代 `zh`。** 不採用，因為這會變更既有明確偏好，並讓簡體中文不再可用。

**翻譯 Provider 與 wire 錯誤細節。** 不採用，因為這些字串是診斷資料而非產品文案；周邊 UI 文字已提供本地化情境。

## Consequences

- Typed 命名空間註冊需要三個內建 id 的字典，因此缺少繁中命名空間會在型別檢查失敗。
- 既有 `zh` 與 `en` 選擇維持相容；新的 id 僅由使用者選取，或由明確指定繁中的瀏覽器標籤選取。
- 語系測試固定目錄內容、文件語言、偏好保存與繁中瀏覽器偵測。
