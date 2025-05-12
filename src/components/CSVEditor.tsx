import Papa from "papaparse";
import React, { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import AIModifier from "./AIModifier";
import CSVTable from "./CSVTable";
import UploadButton from "./UploadButton";

interface CSVData {
  data: string[][];
  headers: string[];
}

type HistoryState = {
  csvData: CSVData | null;
  fileName: string;
};

const CSVEditor: React.FC = () => {
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [fileName, setFileName] = useState<string>("data.csv");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 歷史記錄相關狀態
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);

  // 添加標記避免無限循環
  const isInitializedRef = useRef(false);
  const skipNextSaveRef = useRef(false);

  // 從 localStorage 恢復上次的 CSV 數據
  useEffect(() => {
    // 如果已經初始化過，跳過
    if (isInitializedRef.current) {
      return;
    }

    const savedData = localStorage.getItem("csvData");
    const savedFileName = localStorage.getItem("csvFileName");

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);

        // 設置標記，跳過下一次保存操作
        skipNextSaveRef.current = true;

        setCsvData(parsedData);
        if (savedFileName) setFileName(savedFileName);

        // 初始化歷史記錄
        setHistory([
          { csvData: parsedData, fileName: savedFileName || "data.csv" },
        ]);
        setCurrentHistoryIndex(0);

        toast.success("已從本地存儲恢復數據");
      } catch (error) {
        console.error("恢復數據失敗:", error);
        toast.error("無法恢復數據");
      } finally {
        // 標記已完成初始化
        isInitializedRef.current = true;
      }
    } else {
      // 即使沒有數據也標記為已初始化
      isInitializedRef.current = true;
    }
  }, []);

  // 保存到 localStorage
  useEffect(() => {
    // 跳過初始化過程中觸發的保存操作
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    // 只有在初始化完成後才保存數據
    if (isInitializedRef.current && csvData) {
      localStorage.setItem("csvData", JSON.stringify(csvData));
      localStorage.setItem("csvFileName", fileName);
    }
  }, [csvData, fileName]);

  // 更新歷史記錄
  const updateHistory = useCallback(
    (newCsvData: CSVData | null, newFileName: string) => {
      // 截斷當前索引之後的歷史記錄
      const newHistory = history.slice(0, currentHistoryIndex + 1);

      // 添加新的歷史記錄
      newHistory.push({ csvData: newCsvData, fileName: newFileName });

      // 如果歷史記錄太長，刪除最舊的記錄
      if (newHistory.length > 50) {
        newHistory.shift();
      }

      setHistory(newHistory);
      setCurrentHistoryIndex(newHistory.length - 1);
    },
    [history, currentHistoryIndex],
  );

  // 數據更新時添加歷史記錄
  const updateDataWithHistory = useCallback(
    (newCsvData: CSVData | null, newFileName?: string) => {
      const fileNameToUse = newFileName !== undefined ? newFileName : fileName;
      setCsvData(newCsvData);
      if (newFileName !== undefined) {
        setFileName(newFileName);
      }
      updateHistory(newCsvData, fileNameToUse);
    },
    [fileName, updateHistory],
  );

  // 撤銷操作
  const handleUndo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      const previousState = history[newIndex];

      setCsvData(previousState.csvData);
      setFileName(previousState.fileName);
      setCurrentHistoryIndex(newIndex);

      toast.success("已撤銷上一步操作");
    } else {
      toast.error("無法撤銷操作");
    }
  }, [currentHistoryIndex, history]);

  // 重做操作
  const handleRedo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      const nextState = history[newIndex];

      setCsvData(nextState.csvData);
      setFileName(nextState.fileName);
      setCurrentHistoryIndex(newIndex);

      toast.success("已重做操作");
    } else {
      toast.error("無法重做操作");
    }
  }, [currentHistoryIndex, history]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(file.name);
    setIsLoading(true);

    Papa.parse(file, {
      complete: (result) => {
        const parsedData = result.data as string[][];

        if (parsedData.length > 0) {
          const headers = parsedData[0];
          const data = parsedData.slice(1);

          const newCsvData = { headers, data };
          setCsvData(newCsvData);
          updateHistory(newCsvData, file.name);
          toast.success("CSV 文件已成功上傳");
        } else {
          toast.error("CSV 文件為空");
        }
        setIsLoading(false);
      },
      error: (error) => {
        console.error("解析錯誤:", error);
        toast.error("解析 CSV 文件時出錯");
        setIsLoading(false);
      },
    });
  };

  const handleDataChange = (newData: string[][]) => {
    if (csvData) {
      const newCsvData = { ...csvData, data: newData };
      setCsvData(newCsvData);
      updateHistory(newCsvData, fileName);
    }
  };

  const handleHeaderChange = (newHeaders: string[]) => {
    if (csvData) {
      const newCsvData = { ...csvData, headers: newHeaders };
      setCsvData(newCsvData);
      updateHistory(newCsvData, fileName);
    }
  };

  const handleDownload = () => {
    if (!csvData) return;

    const csv = Papa.unparse({
      fields: csvData.headers,
      data: csvData.data,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV 文件已下載");
  };

  const createTemplate = () => {
    const templateHeaders = ["欄位1", "欄位2", "欄位3"];
    const templateData = [
      ["", "", ""],
      ["", "", ""],
      ["", "", ""],
    ];

    const newCsvData = { headers: templateHeaders, data: templateData };
    updateDataWithHistory(newCsvData, "template.csv");
    toast.success("已創建 CSV 模板");
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-6">
      <header className="mb-8">
        <h1 className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-3xl font-bold text-gray-800 text-transparent">
          ChatGPT Powered CSV Editor
        </h1>
        <p className="mt-2 text-gray-600">輕鬆編輯、處理和優化您的CSV數據</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-4">
        <UploadButton onFileUpload={handleFileUpload} isLoading={isLoading} />

        <button
          onClick={createTemplate}
          className="focus:ring-opacity-50 rounded-md bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-2 text-white transition-all hover:from-purple-700 hover:to-purple-800 hover:shadow-md focus:ring-2 focus:ring-purple-500 focus:outline-none"
        >
          使用模板
        </button>

        {csvData && (
          <>
            <button
              onClick={handleDownload}
              className="focus:ring-opacity-50 rounded-md bg-gradient-to-r from-green-600 to-green-700 px-4 py-2 text-white transition-all hover:from-green-700 hover:to-green-800 hover:shadow-md focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              下載 CSV
            </button>
          </>
        )}
      </div>

      {csvData ? (
        <div className="space-y-8">
          <AIModifier
            csvData={csvData}
            onDataUpdate={(newData) => {
              updateDataWithHistory(newData);
            }}
          />
          <CSVTable
            headers={csvData.headers}
            data={csvData.data}
            onDataChange={handleDataChange}
            onHeaderChange={handleHeaderChange}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={currentHistoryIndex > 0}
            canRedo={currentHistoryIndex < history.length - 1}
          />
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-10 text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <svg
              className="h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-lg text-gray-600">
              上傳一個 CSV 文件開始編輯，或點擊「使用模板」按鈕創建一個新模板
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CSVEditor;
