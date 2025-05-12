import React, { useState, useEffect } from "react";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import toast from "react-hot-toast";
import { z } from "zod";

interface CSVData {
  data: string[][];
  headers: string[];
}

const AIReturnValue = z.object({
  table: z.array(z.array(z.string())),
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

      // 向 OpenAI API 發送請求
      const response = await client.responses.parse({
        model: model, // 使用用戶選擇的模型
        input: [
          {
            role: "system",
            content:
              "你是一個 CSV 數據處理專家。你的任務是根據用戶的指令修改 CSV 數據。始終以 CSV 格式返回完整的修改後數據，不要添加任何其他解釋。",
          },
          {
            role: "user",
            content: `這是我的 CSV 數據:\n\n${csvString}\n\n我想要你按照以下指令修改這些數據:\n${prompt}\n\n請只返回修改後的完整 CSV 數據，不要包含任何其他文字。`,
          },
        ],
        text: {
          format: zodTextFormat(AIReturnValue, "csv_table"),
        },
      });

      const csvTable = response.output_parsed;

      if (csvTable) {
        // 解析 AI 返回的結果
        if (csvTable.table.length > 0) {
          const newHeaders = csvTable.table[0];
          const newData = csvTable.table.slice(1).map((line) => line);

          // 更新 CSV 數據
          onDataUpdate({ headers: newHeaders, data: newData });
          toast.success("CSV 數據已更新", { id: "ai-processing" });
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
        <h2 className="text-lg font-medium flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI 助手
        </h2>
        <p className="mt-1 text-sm text-purple-100 opacity-90">
          使用AI幫助您快速處理和轉換CSV數據
        </p>
      </div>

      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center transition-colors focus:outline-none"
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
          <div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              OpenAI API 密鑰
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="sk-..."
              className="mb-2 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
          指示 AI 如何修改您的 CSV 數據
        </label>
        <textarea
          value={prompt}
          onChange={handlePromptChange}
          placeholder="例如：請將所有空單元格填充為 'N/A'、將第一列中的所有文本轉換為大寫、添加一個名為 '總計' 的新列並計算第 3 和第 4 列的總和..."
          className="h-32 w-full rounded-md border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-700"
        />

        <div className="mt-4">
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center transition-colors focus:outline-none"
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
            <div className="mt-3 p-4 bg-gray-50 rounded-md border border-gray-200">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                AI 模型
              </label>
              <input
                type="text"
                value={model}
                onChange={handleModelChange}
                placeholder="輸入模型名稱，例如：gpt-4.1、gpt-4o、gpt-3.5-turbo"
                className="mb-2 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
            className="w-full rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-white font-medium transition-all hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                處理中...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                使用 AI 處理
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIModifier;
