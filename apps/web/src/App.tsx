import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEventLoop, type Task } from "./hooks/useEventLoop";

// [Motion] 움직이는 카드 컴포넌트
const TaskCard = ({ task }: { task: Task }) => {
  const theme =
    task.type === "MacroTask"
      ? "border-yellow-500 bg-yellow-500/10 text-yellow-200"
      : task.type === "MicroTask"
      ? "border-purple-500 bg-purple-500/10 text-purple-200"
      : "border-blue-500 bg-blue-500/10 text-blue-200";

  return (
    <motion.div
      layoutId={task.id || task.name + task.line} // 애니메이션 식별자
      initial={{ opacity: 0, y: -20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
      className={`p-3 mb-2 rounded border-l-4 ${theme} font-mono text-sm shadow-sm`}
    >
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2 truncate mr-2">
          <span className="font-bold">{task.name}</span>
          {task.args && (
            <span className="text-xs text-gray-400 truncate max-w-[150px]">
              ({task.args})
            </span>
          )}
        </div>
        <span className="text-[10px] opacity-50 whitespace-nowrap">
          L{task.line}
        </span>
      </div>
    </motion.div>
  );
};

function App() {
  const [code, setCode] = useState<string>(`async function test() {
  console.log('A');
  await Promise.resolve(); // 여기서 끊겨야 함
  console.log('B');        // 얘는 Await의 콜백(MicroTask)이 되어야 함
}
test();
console.log('C');`);

  // 커스텀 훅 장착!
  const {
    callStack,
    microQueue,
    macroQueue,
    logs,
    isRunning,
    initialize,
    runSimulation,
  } = useEventLoop();

  const [, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:3000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await response.json();

      // 엔진 초기화
      initialize(result.analysis);
    } catch (error) {
      console.error(error);
      alert("Error connecting to backend");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 lg:p-10 font-mono flex flex-col">
      <header className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            Node Anatomy 🧠
          </h1>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-6 flex-1">
        {/* Code Editor */}
        <section className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex-1">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-full bg-transparent text-gray-300 text-sm focus:outline-none resize-none"
              spellCheck={false}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAnalyze}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition-all"
            >
              1. Analyze
            </button>
            <button
              onClick={runSimulation}
              disabled={isRunning}
              className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                isRunning
                  ? "bg-emerald-800 text-gray-400"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {isRunning ? "Running..." : "2. Play ▶"}
            </button>
          </div>

          {/* Logs Panel */}
          <div className="h-32 bg-black rounded-lg p-2 overflow-y-auto text-xs text-green-400 font-mono border border-gray-800">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </section>

        {/* Visualizer Stage */}
        <section className="col-span-12 lg:col-span-8 grid grid-cols-2 grid-rows-2 gap-6 h-[600px]">
          {/* Call Stack */}
          <div className="row-span-2 bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-700 p-4 flex flex-col relative">
            <h2 className="text-center text-gray-400 font-bold mb-4">
              Call Stack 📥
            </h2>
            <div className="flex-1 flex flex-col-reverse gap-2 overflow-hidden pb-4">
              <AnimatePresence>
                {callStack.map((task, idx) => (
                  <TaskCard key={`${task.id}-${idx}`} task={task} />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Queues */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
            <h2 className="text-purple-400 font-bold mb-2">MicroTask Queue</h2>
            <div className="space-y-2">
              <AnimatePresence>
                {microQueue.map((task, idx) => (
                  <TaskCard key={idx} task={task} />
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
            <h2 className="text-yellow-400 font-bold mb-2">MacroTask Queue</h2>
            <div className="space-y-2">
              <AnimatePresence>
                {macroQueue.map((task, idx) => (
                  <TaskCard key={idx} task={task} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
