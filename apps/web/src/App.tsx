import { useState } from "react";

const TaskCard = ({ task }: { task: any }) => {
  // [1] 이름 다듬기: 큐에 있을 때는 'Task' 느낌 내기
  let displayName = task.name;
  if (task.type === "MacroTask" && task.name === "setTimeout") {
    displayName = "⏱️ Timer Callback";
  } else if (task.type === "MicroTask" && task.name === "Promise.then") {
    displayName = "🤞 Promise Reaction";
  }

  // 색상 테마
  const theme =
    task.type === "MacroTask"
      ? "border-yellow-500 bg-yellow-500/10 text-yellow-200"
      : task.type === "MicroTask"
      ? "border-purple-500 bg-purple-500/10 text-purple-200"
      : "border-blue-500 bg-blue-500/10 text-blue-200";

  return (
    <div
      className={`p-3 mb-2 rounded border-l-4 ${theme} font-mono text-sm shadow-sm transition-all hover:scale-105`}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold truncate mr-2">{displayName}</span>
        <span className="text-[10px] opacity-50 bg-black/30 px-1.5 py-0.5 rounded">
          L{task.line}
        </span>
      </div>

      {/* [2] 하단 메타정보: 문맥(Context)이나 페이즈 표시 */}
      <div className="flex justify-between text-[10px] opacity-75 uppercase tracking-wider mt-1">
        <span>
          {task.type === "CallStack"
            ? task.runContext
            : task.phase || task.priority}
        </span>

        {/* 부모 ID가 있으면 표시 */}
        {task.parentId && (
          <span className="text-gray-400">↳ {task.parentId}</span>
        )}
      </div>
    </div>
  );
};

function App() {
  const [code, setCode] = useState<string>(`console.log('Start');
setTimeout(() => { console.log('Timeout'); }, 0);
Promise.resolve().then(() => console.log('Promise'));
console.log('End');`);

  const [analysis, setAnalysis] = useState<any[]>([]); // 초기값 빈 배열로 변경
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:3000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error("Failed");
      const result = await response.json();
      setAnalysis(result.analysis);
    } catch (error) {
      alert("분석 실패! 백엔드를 확인하세요.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // [2] 데이터 필터링 (렌더링 테스트용)
  // 실제 애니메이션 때는 큐에서 하나씩 꺼내겠지만, 지금은 그냥 다 보여줍니다.
  const mainStackItems = analysis.filter(
    (t) => t.type === "CallStack" && t.runContext === "Main"
  );

  // 2. MicroTask Queue: 큐에 대기 중인 비동기 트리거들 (Promise.then 등)
  const microTaskItems = analysis.filter((t) => t.type === "MicroTask");

  // 3. MacroTask Queue: 큐에 대기 중인 비동기 트리거들 (setTimeout 등)
  const macroTaskItems = analysis.filter((t) => t.type === "MacroTask");

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 lg:p-10 font-mono flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            Node Anatomy 🧠
          </h1>
          <p className="text-gray-500 text-sm mt-1">Event Loop Visualizer</p>
        </div>
        <div className="text-xs text-gray-600">
          Status: <span className="text-emerald-500">Ready</span>
        </div>
      </header>

      {/* Main Grid */}
      <main className="grid grid-cols-12 gap-6 flex-1">
        {/* [Zone 1] Code Editor (Left, 4 cols) */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="bg-gray-800 rounded-xl p-1 border border-gray-700 flex-1 flex flex-col">
            <div className="px-4 py-2 border-b border-gray-700 text-gray-400 text-xs font-bold uppercase tracking-wider flex justify-between">
              <span>Source Code</span>
              <span>JS</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 bg-gray-950 text-gray-300 p-4 text-sm leading-6 resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Analysing..." : "RUN & ANALYZE ▶"}
          </button>
        </section>

        {/* [Zone 2] Visualization Stage (Right, 8 cols) */}
        <section className="col-span-12 lg:col-span-8 grid grid-cols-2 grid-rows-2 gap-6 h-[600px] lg:h-auto">
          {/* Call Stack (Left, Full Height) */}
          <div className="row-span-2 bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-700 p-4 flex flex-col relative overflow-hidden">
            <h2 className="text-gray-400 text-xs font-bold uppercase mb-4 text-center">
              Call Stack 📥
            </h2>
            {/* 스택은 아래에서 위로 쌓이므로 flex-col-reverse */}
            <div className="flex-1 flex flex-col-reverse gap-2 overflow-y-auto p-2 bg-gray-900/50 rounded-lg">
              {mainStackItems.map((item, idx) => (
                <TaskCard key={idx} task={item} />
              ))}
              {mainStackItems.length === 0 && (
                <div className="text-center text-gray-600 text-xs py-10">
                  Empty Stack
                </div>
              )}
            </div>
          </div>

          {/* MicroTask Queue (Top Right) */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 flex flex-col">
            <h2 className="text-purple-400 text-xs font-bold uppercase mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              MicroTask Queue (VIP)
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 bg-gray-900/30 rounded-lg p-2">
              {microTaskItems.map((item, idx) => (
                <TaskCard key={idx} task={item} />
              ))}
            </div>
          </div>

          {/* MacroTask Queue (Bottom Right) */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 flex flex-col">
            <h2 className="text-yellow-400 text-xs font-bold uppercase mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              MacroTask Queue
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 bg-gray-900/30 rounded-lg p-2">
              {macroTaskItems.map((item, idx) => (
                <TaskCard key={idx} task={item} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
