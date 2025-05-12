import React, { useState, useEffect } from "react";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import toast from "react-hot-toast";
import { z } from "zod";

interface CSVData {
  data: string[][];
  headers: string[];
}

// AI返回值結構，由AI自行判斷是否需要修改數據
const AIReturnValue = z.object({
  needsModification: z.boolean(), // 是否需要修改數據（由AI判斷）
  message: z.string(), // 檢查結果或分析信息
  table: z.array(z.array(z.string())), // 數據表格（原始或修改後）
});

interface AIModifierProps {
  csvData: CSVData;
  onDataUpdate: (newData: CSVData) => void;
}

const AIModifier: React.FC<AIModifierProps> = ({ csvData, onDataUpdate }) => {
  const [prompt, setPrompt] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>("gpt-4.1");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string>(""); // 儲存AI分析結果

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    // 將 API 密鑰存儲在 localStorage 中
    localStorage.setItem("openai_api_key", e.target.value);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModel(e.target.value);
    // 將選擇的模型存儲在 localStorage 中
    localStorage.setItem("openai_model", e.target.value);
  };

  // 在組件加載時嘗試從 localStorage 讀取 API 密鑰和模型
  useEffect(() => {
    const savedApiKey = localStorage.getItem("openai_api_key");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    
    const savedModel = localStorage.getItem("openai_model");
    if (savedModel) {
      setModel(savedModel);
    }
  }, []);

  const processWithAI = async () => {
    if (!apiKey) {
      setShowApiKeyInput(true);
      toast.error("請輸入您的 OpenAI API 密鑰");
      return;
    }

    if (!prompt.trim()) {
      toast.error("請輸入指令");
      return;
    }

    setIsProcessing(true);
    setAnalysisResult(""); // 清除先前的分析結果
    toast.loading("正在處理您的請求...", { id: "ai-processing" });

    try {
      const client = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true, // 警告：在生產環境中，API 密鑰應該在服務器端處理
      });

      // 將 CSV 數據轉換為可讀的字符串形式
      const csvString = [
        csvData.headers.join(","),
        ...csvData.data.map((row) => row.join(",")),
      ].join("\n");

      // 系統提示詞
      const systemContent = 
        "你是一個CSV數據分析專家。你的任務是根據用戶的指令分析CSV數據。" + 
        "請先判斷數據是否需要修改。如果需要修改，返回修改後的數據；如果不需要修改，返回原始數據。" + 
        "在任何情況下，都要提供分析結果或建議。";

      // 用戶提示詞
      const userContent = 
        `這是我的CSV數據:\n\n${csvString}\n\n` +
        `請根據以下指令分析和處理這些數據:\n${prompt}\n\n` +
        `請先判斷數據是否需要修改(needsModification)，` +
        `提供明確的分析結果(message)，並返回適當的數據表格(table)。` +
        `如果數據不需要修改，請在表格中返回原始數據。`;

      // 向 OpenAI API 發送請求
      const response = await client.responses.parse({
        model: model, // 使用用戶選擇的模型
        input: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        text: {
          format: zodTextFormat(AIReturnValue, "csv_table"),
        },
      });

      const result = response.output_parsed;

      if (result) {
        // 解析 AI 返回的結果
        if (result.table.length > 0) {
          // 保存分析結果
          setAnalysisResult(result.message);
          
          // 根據AI判斷決定是否更新數據
          if (result.needsModification) {
            const newHeaders = result.table[0];
            const newData = result.table.slice(1);

            // 更新 CSV 數據
            onDataUpdate({ headers: newHeaders, data: newData });
            toast.success("根據分析，CSV數據已更新", { id: "ai-processing" });
          } else {
            toast.success("數據分析完成，無需修改", { id: "ai-processing" });
          }
        } else {
          toast.error("AI 返回了無效的數據格式", { id: "ai-processing" });
        }
      } else {
        toast.error("未能從 AI 獲取有效響應", { id: "ai-processing" });
      }
    } catch (error) {
      console.error("處理 AI 請求時出錯:", error);
      toast.error(
        `處理失敗: ${error instanceof Error ? error.message : "未知錯誤"}`,
        { id: "ai-processing" },
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
        <h2 className="flex items-center text-lg font-medium">
          <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI 助手
        </h2>
        <p className="mt-1 text-sm text-purple-100 opacity-90">
          使用AI幫助您分析和處理CSV數據
        </p>
      </div>

      <div className="border-b border-gray-200 p-4">
        <button
          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          className="flex items-center text-sm text-indigo-600 transition-colors hover:text-indigo-800 focus:outline-none"
        >
          {showApiKeyInput ? "隱藏API設定" : "配置API密鑰"}
          <svg 
            className={`ml-1 h-4 w-4 transition-transform ${showApiKeyInput ? "rotate-180" : ""}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showApiKeyInput && (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              OpenAI API 密鑰
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="sk-..."
              className="mb-2 w-full rounded-md border border-gray-300 p-2 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500">
              您的 API
              密鑰將僅存儲在本地瀏覽器中。在生產環境中，應該使用後端服務來處理 API
              請求。
            </p>
          </div>
        )}
      </div>

      <div className="p-4">
        <label className="mb-1 block text-sm font-medium text-gray-700">
          指示 AI 如何分析和處理您的 CSV 數據
        </label>
        <textarea
          value={prompt}
          onChange={handlePromptChange}
          placeholder="例如：檢查數據是否有空值、分析郵箱格式是否正確、檢查數值是否在合理範圍、自動填充空單元格、轉換格式..."
          className="h-32 w-full rounded-md border border-gray-300 p-3 text-gray-700 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {/* AI分析結果顯示區域 */}
        {analysisResult && (
          <div className="mt-4 rounded-md border border-indigo-100 bg-indigo-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-indigo-800">AI 分析結果：</h3>
            <div className="whitespace-pre-wrap text-sm text-gray-700">{analysisResult}</div>
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="flex items-center text-sm text-indigo-600 transition-colors hover:text-indigo-800 focus:outline-none"
          >
            {showAdvancedSettings ? "隱藏進階設定" : "顯示進階設定"}
            <svg 
              className={`ml-1 h-4 w-4 transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showAdvancedSettings && (
            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                AI 模型
              </label>
              <input
                type="text"
                value={model}
                onChange={handleModelChange}
                placeholder="輸入模型名稱，例如：gpt-4.1、gpt-4o、gpt-3.5-turbo"
                className="mb-2 w-full rounded-md border border-gray-300 p-2 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500">
                輸入您想使用的 OpenAI 模型。預設為 gpt-4.1
              </p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={processWithAI}
            disabled={isProcessing}
            className="flex w-full items-center justify-center rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 font-medium text-white transition-all hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isProcessing ? (
              <>
                <svg className="mr-2 -ml-1 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                處理中...
              </>
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                使用 AI 分析並處理
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIModifier;
