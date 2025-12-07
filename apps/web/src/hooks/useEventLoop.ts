import { useState, useRef, useCallback } from "react";

export interface Task {
  id?: string;
  type: "CallStack" | "MacroTask" | "MicroTask";
  runContext?: "Main" | "AsyncCallback";
  parentId?: string | null;
  phase?: string;
  priority?: string;
  name: string;
  line: number;
}

export const useEventLoop = () => {
  const [callStack, setCallStack] = useState<Task[]>([]);
  const [microQueue, setMicroQueue] = useState<Task[]>([]);
  const [macroQueue, setMacroQueue] = useState<Task[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // [핵심] 상태의 최신 값을 참조하기 위한 Refs
  const microQueueRef = useRef<Task[]>([]);
  const macroQueueRef = useRef<Task[]>([]);
  const scenarioRef = useRef<{
    mainScript: Task[];
    callbackMap: Map<string, Task[]>;
  } | null>(null);

  // 큐 상태를 업데이트할 때 Ref도 같이 업데이트하는 헬퍼
  const updateMicroQueue = (tasks: Task[]) => {
    setMicroQueue(tasks);
    microQueueRef.current = tasks;
  };
  const updateMacroQueue = (tasks: Task[]) => {
    setMacroQueue(tasks);
    macroQueueRef.current = tasks;
  };

  const initialize = useCallback((analysisData: Task[]) => {
    const mainScript: Task[] = [];
    const callbackMap = new Map<string, Task[]>();

    analysisData.forEach((task) => {
      if (task.runContext === "Main" || !task.parentId) {
        mainScript.push(task);
      } else {
        const pid = task.parentId;
        const existing = callbackMap.get(pid) || [];
        callbackMap.set(pid, [...existing, task]);
      }
    });

    scenarioRef.current = { mainScript, callbackMap };

    // 초기화
    setCallStack([]);
    updateMicroQueue([]);
    updateMacroQueue([]);
    setLogs(["Analysis loaded. Ready."]);
    setIsRunning(false);
  }, []);

  const runSimulation = async () => {
    if (!scenarioRef.current) return;
    setIsRunning(true);
    setLogs((p) => [...p, "🚀 Engine Start!"]);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // [Helper] 작업 실행 및 자식 스케줄링
    const executeTask = async (task: Task) => {
      // 1. Call Stack에 올림 (실행 모습)
      setCallStack([task]);

      // 2. 자식(Callback) 스케줄링 확인
      if (task.id) {
        const callbacks = scenarioRef.current?.callbackMap.get(task.id) || [];

        if (callbacks.length > 0) {
          // [수정된 로직] 부모의 타입에 따라 자식들을 해당 큐로 보냄

          // Case A: 부모가 마이크로 태스크 (Promise, nextTick)
          if (task.type === "MicroTask") {
            updateMicroQueue([...microQueueRef.current, ...callbacks]);
            setLogs((p) => [
              ...p,
              `✨ Scheduled ${callbacks.length} MicroTasks (by ${task.name})`,
            ]);
          }
          // Case B: 부모가 매크로 태스크 (setTimeout)
          else if (task.type === "MacroTask") {
            updateMacroQueue([...macroQueueRef.current, ...callbacks]);
            setLogs((p) => [
              ...p,
              `⏰ Scheduled ${callbacks.length} MacroTasks (by ${task.name})`,
            ]);
          }
          // (CallStack 타입이 비동기 ID를 가진 경우는 거의 없지만, 있다면 처리 로직 추가 가능)
        }
      }

      await sleep(600); // 실행 시간 시뮬레이션

      // 3. Stack에서 제거
      setCallStack([]);
      await sleep(200);
    };

    // === PHASE 1: Main Script ===
    for (const task of scenarioRef.current.mainScript) {
      await executeTask(task);
    }
    setLogs((p) => [...p, "✅ Main Script Done. Event Loop Running..."]);
    await sleep(500);

    // === PHASE 2: Event Loop ===
    // 조건: 큐가 다 빌 때까지 반복
    while (
      microQueueRef.current.length > 0 ||
      macroQueueRef.current.length > 0
    ) {
      // Rule 1: MicroTask Queue가 비어있지 않으면 다 털어버린다.
      if (microQueueRef.current.length > 0) {
        const task = microQueueRef.current[0]; // Peek
        updateMicroQueue(microQueueRef.current.slice(1)); // Shift

        setLogs((p) => [...p, `⚡ Run Micro: ${task.name}`]);
        await executeTask(task);
        continue; // 다시 루프 처음으로 (마이크로가 또 생겼을 수도 있으니까)
      }

      // Rule 2: Micro가 비었으면 Macro 하나를 실행한다.
      if (macroQueueRef.current.length > 0) {
        const task = macroQueueRef.current[0];
        updateMacroQueue(macroQueueRef.current.slice(1));

        setLogs((p) => [...p, `🐢 Run Macro: ${task.name}`]);
        await executeTask(task);
        // 매크로 하나 실행 후엔 다시 루프 처음으로 가서 마이크로를 확인한다 (중요!)
        continue;
      }
    }

    setLogs((p) => [...p, "🎉 All Done!"]);
    setIsRunning(false);
  };

  return {
    callStack,
    microQueue,
    macroQueue,
    logs,
    isRunning,
    initialize,
    runSimulation,
  };
};
