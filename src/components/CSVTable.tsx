import React, { useState, useCallback, useEffect, useRef } from "react";

interface CSVTableProps {
  headers: string[];
  data: string[][];
  onDataChange: (newData: string[][]) => void;
  onHeaderChange: (newHeaders: string[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const CSVTable: React.FC<CSVTableProps> = ({
  headers,
  data,
  onDataChange,
  onHeaderChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  // 內部狀態，用於確保UI渲染與外部數據同步
  const [internalHeaders, setInternalHeaders] = useState<string[]>([
    ...headers,
  ]);
  const [internalData, setInternalData] = useState<string[][]>(
    data.map((row) => [...row]),
  );
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [editingHeaderValue, setEditingHeaderValue] = useState<string>("");

  // 追蹤操作，防止多次渲染之間的競爭條件
  const isUpdatingRef = useRef(false);

  // 當外部headers或data變化時，更新內部狀態
  useEffect(() => {
    if (!isUpdatingRef.current) {
      setInternalHeaders([...headers]);
      setInternalData(data.map((row) => [...row]));
    }
  }, [headers, data]);

  // 確保每行的列數與表頭數量一致
  useEffect(() => {
    if (internalData.length > 0 && !isUpdatingRef.current) {
      const headerCount = internalHeaders.length;
      let needUpdate = false;

      const normalizedData = internalData.map((row) => {
        if (row.length !== headerCount) {
          needUpdate = true;
          if (row.length > headerCount) {
            return row.slice(0, headerCount);
          } else {
            return [...row, ...Array(headerCount - row.length).fill("")];
          }
        }
        return [...row]; // 返回新陣列以確保引用變更
      });

      if (needUpdate) {
        setInternalData(normalizedData);
        onDataChange(normalizedData);
      }
    }
  }, [internalHeaders, internalData, onDataChange]);

  const handleCellClick = (row: number, col: number, value: string) => {
    setEditingCell({ row, col });
    setEditingValue(value);
  };

  const handleCellChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingValue(e.target.value);
  };

  const handleCellBlur = useCallback(() => {
    if (editingCell) {
      const newData = internalData.map((row) => [...row]);
      if (
        newData[editingCell.row] &&
        editingCell.col < internalHeaders.length
      ) {
        newData[editingCell.row][editingCell.col] = editingValue;
        setInternalData(newData);
        onDataChange(newData);
      }
      setEditingCell(null);
    }
  }, [
    editingCell,
    editingValue,
    internalData,
    internalHeaders.length,
    onDataChange,
  ]);

  const handleHeaderClick = (index: number, value: string) => {
    setEditingHeader(index);
    setEditingHeaderValue(value);
  };

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingHeaderValue(e.target.value);
  };

  const handleHeaderBlur = useCallback(() => {
    if (editingHeader !== null) {
      const newHeaders = [...internalHeaders];
      newHeaders[editingHeader] = editingHeaderValue;
      setInternalHeaders(newHeaders);
      onHeaderChange(newHeaders);
      setEditingHeader(null);
    }
  }, [editingHeader, editingHeaderValue, internalHeaders, onHeaderChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (editingCell) {
        handleCellBlur();
      } else if (editingHeader !== null) {
        handleHeaderBlur();
      }
    }
  };

  const addRow = useCallback(() => {
    // 設置標記，表示正在進行更新，防止useEffect觸發額外的更新
    isUpdatingRef.current = true;

    try {
      const newRow = new Array(internalHeaders.length).fill("");
      const newData = [...internalData, newRow];
      setInternalData(newData);
      onDataChange(newData);
    } finally {
      // 確保在操作完成後重置標記
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [internalData, internalHeaders.length, onDataChange]);

  const deleteRow = useCallback(
    (rowIndex: number) => {
      // 設置標記，表示正在進行更新，防止useEffect觸發額外的更新
      isUpdatingRef.current = true;

      try {
        const newData = internalData.filter((_, index) => index !== rowIndex);
        setInternalData(newData);
        onDataChange(newData);
      } finally {
        // 確保在操作完成後重置標記
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 0);
      }
    },
    [internalData, onDataChange],
  );

  const addColumn = useCallback(() => {
    // 設置標記，表示正在進行更新，防止useEffect觸發額外的更新
    isUpdatingRef.current = true;

    try {
      // 創建新的數據副本，避免引用原始數據
      const newHeaders = [
        ...internalHeaders,
        `欄位 ${internalHeaders.length + 1}`,
      ];
      const newData = internalData.map((row) => {
        // 確保每行是一個新的陣列
        const newRow = [...row];
        // 添加新列
        newRow.push("");
        return newRow;
      });

      // 先更新內部狀態
      setInternalHeaders(newHeaders);
      setInternalData(newData);

      // 同步更新父組件狀態
      onHeaderChange(newHeaders);
      onDataChange(newData);
    } finally {
      // 確保在操作完成後重置標記
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [internalData, internalHeaders, onDataChange, onHeaderChange]);

  const deleteColumn = useCallback(
    (colIndex: number) => {
      // 設置標記，表示正在進行更新，防止useEffect觸發額外的更新
      isUpdatingRef.current = true;

      try {
        // 創建新的數據副本，避免引用原始數據
        const newHeaders = internalHeaders.filter(
          (_, index) => index !== colIndex,
        );

        // 確保所有行都有正確的列數
        const newData = internalData.map((row) => {
          // 確保行長度匹配當前表頭數量
          const paddedRow =
            row.length < internalHeaders.length
              ? [...row, ...Array(internalHeaders.length - row.length).fill("")]
              : [...row];

          // 刪除指定列
          return paddedRow.filter((_, index) => index !== colIndex);
        });

        // 先更新內部狀態
        setInternalHeaders(newHeaders);
        setInternalData(newData);

        // 同步更新父組件狀態
        onHeaderChange(newHeaders);
        onDataChange(newData);
      } finally {
        // 確保在操作完成後重置標記
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 0);
      }
    },
    [internalHeaders, internalData, onHeaderChange, onDataChange],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-3 text-lg font-medium text-gray-800">數據表格</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={addRow}
            className="focus:ring-opacity-50 flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <svg
              className="mr-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            新增行
          </button>
          <button
            onClick={addColumn}
            className="focus:ring-opacity-50 flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <svg
              className="mr-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 0H3m6 0v6m0-6V6"
              />
            </svg>
            新增列
          </button>

          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-all focus:outline-none ${
                !canUndo
                  ? "cursor-not-allowed bg-gray-300 text-gray-500"
                  : "focus:ring-opacity-50 bg-amber-600 text-white hover:bg-amber-700 focus:ring-2 focus:ring-amber-500"
              }`}
            >
              <svg
                className="mr-1.5 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              撤銷
            </button>
          )}

          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-all focus:outline-none ${
                !canRedo
                  ? "cursor-not-allowed bg-gray-300 text-gray-500"
                  : "focus:ring-opacity-50 bg-amber-600 text-white hover:bg-amber-700 focus:ring-2 focus:ring-amber-500"
              }`}
            >
              <svg
                className="mr-1.5 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
              重做
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="w-12 p-3 text-left text-xs font-medium tracking-wider text-gray-600">
                #
              </th>
              {internalHeaders.map((header, index) => (
                <th
                  key={`header-${index}-${header}`}
                  className="p-3 text-left text-xs font-medium tracking-wider text-gray-600"
                >
                  {editingHeader === index ? (
                    <input
                      value={editingHeaderValue}
                      onChange={handleHeaderChange}
                      onBlur={handleHeaderBlur}
                      onKeyDown={handleKeyDown}
                      autoFocus
                      className="w-full rounded border border-blue-300 p-1 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  ) : (
                    <div className="flex items-center">
                      <span
                        onClick={() => handleHeaderClick(index, header)}
                        className="flex-grow cursor-pointer transition-colors hover:text-blue-600"
                      >
                        {header || (
                          <span className="text-gray-400 italic">[空]</span>
                        )}
                      </span>
                      <button
                        onClick={() => deleteColumn(index)}
                        className="ml-2 text-gray-400 transition-colors hover:text-red-600"
                        title="刪除此列"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {internalData.map((row, rowIndex) => (
              <tr
                key={`row-${rowIndex}`}
                className="transition-colors hover:bg-gray-50"
              >
                <td className="flex items-center justify-between p-3 text-sm whitespace-nowrap text-gray-500">
                  <span className="font-medium text-gray-700">
                    {rowIndex + 1}
                  </span>
                  <button
                    onClick={() => deleteRow(rowIndex)}
                    className="text-gray-400 transition-colors hover:text-red-600"
                    title="刪除此行"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </td>
                {internalHeaders.map((_, colIndex) => {
                  // 確保行數據有足夠的長度
                  const cell = colIndex < row.length ? row[colIndex] : "";
                  return (
                    <td
                      key={`cell-${rowIndex}-${colIndex}`}
                      className="p-3 text-sm whitespace-nowrap text-gray-700"
                    >
                      {editingCell?.row === rowIndex &&
                      editingCell?.col === colIndex ? (
                        <input
                          value={editingValue}
                          onChange={handleCellChange}
                          onBlur={handleCellBlur}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          className="w-full rounded border border-blue-300 p-1 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      ) : (
                        <div
                          onClick={() =>
                            handleCellClick(rowIndex, colIndex, cell)
                          }
                          className="-m-1 min-h-[24px] cursor-pointer rounded p-1 transition-colors hover:bg-blue-50"
                        >
                          {cell || (
                            <span className="text-gray-400 italic">[空]</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CSVTable;
