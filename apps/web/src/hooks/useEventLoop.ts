import { useState, useCallback } from "react";

// 데이터 타입 정의 (백엔드와 맞춤)
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
  // [1] 가상 메모리 상태 (State)
  const [callStack, setCallStack] = useState<Task[]>([]);
  const [microQueue, setMicroQueue] = useState<Task[]>([]);
  const [macroQueue, setMacroQueue] = useState<Task[]>([]);

  // 현재 실행 중인 단계 (Step)
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // 원본 데이터 저장소
  const [scenario, setScenario] = useState<{
    mainScript: Task[]; // 메인 스레드에서 실행될 코드들
    callbackMap: Map<string, Task[]>; // 비동기 ID별로 예약된 콜백들
  } | null>(null);

  // 시뮬레이션 초기화 (데이터 파싱)
  const initialize = useCallback((analysisData: Task[]) => {
    const mainScript: Task[] = [];
    const callbackMap = new Map<string, Task[]>();

    // 1. 데이터를 "메인"과 "콜백"으로 분류
    analysisData.forEach((task) => {
      if (task.runContext === "Main" || !task.parentId) {
        mainScript.push(task); // 메인 스레드 작업
      } else {
        // 콜백 작업들은 부모 ID별로 묶어서 저장
        const pid = task.parentId;
        const existing = callbackMap.get(pid) || [];
        callbackMap.set(pid, [...existing, task]);
      }
    });

    setScenario({ mainScript, callbackMap });
    setCallStack([]);
    setMicroQueue([]);
    setMacroQueue([]);
    setLogs(["Analysis loaded. Ready to run."]);
    setIsRunning(false);
  }, []);

  // [2] 시뮬레이션 실행기 (The Engine)
  const runSimulation = async () => {
    if (!scenario) return;
    setIsRunning(true);
    setLogs((prev) => [...prev, "🚀 V8 Engine Started..."]);

    // Helper: 잠시 멈춤 (애니메이션 볼 시간 확보)
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // --- Phase 1: Main Script Execution ---
    for (const task of scenario.mainScript) {
      // 1. 스택에 푸시
      setCallStack((prev) => [...prev, task]);
      await sleep(800);

      // 2. 비동기 트리거라면? (큐에 예약)
      if (task.type !== "CallStack" && task.id) {
        const callbacks = scenario.callbackMap.get(task.id) || [];

        if (task.type === "MicroTask") {
          setMicroQueue((prev) => [...prev, ...callbacks]); // 단순화를 위해 콜백 내용 자체를 큐에 넣음
          setLogs((prev) => [...prev, `✨ MicroTask Scheduled: ${task.name}`]);
        } else {
          setMacroQueue((prev) => [...prev, ...callbacks]);
          setLogs((prev) => [...prev, `⏰ MacroTask Scheduled: ${task.name}`]);
        }
      }

      // 3. 스택에서 팝 (실행 완료)
      setCallStack((prev) => prev.slice(0, -1));
      await sleep(500);
    }

    setLogs((prev) => [...prev, "✅ Main Script Done. Checking Queues..."]);
    await sleep(1000);

    // --- Phase 2: Event Loop (Queue Consumption) ---
    // (간단한 버전: 마이크로 큐 다 비우고 -> 매크로 큐 하나 실행 -> 반복)

    // 재귀적으로 큐를 비우는 함수가 필요하지만,
    // 지금은 간단하게 "남은 큐 털기"로 구현합니다.

    // 1. MicroTask Queue 비우기
    while (true) {
      // State updater의 비동기성 때문에 실제 구현은 ref나 더 정교한 로직이 필요하지만
      // 지금은 시각적 연출을 위해 임시 변수 사용 없이 setState 콜백 패턴 활용 불가하므로
      // 개념적 시퀀스로 구현합니다. (실제로는 useEffect나 reducer로 해야 완벽함)
      // -> *MVP 단계에서는 일단 '보여주기식' 루프로 갑니다.*

      // *주의: 리액트 상태는 즉시 반영 안 되므로, 이 방식은 데모용입니다.
      // 완벽한 구현을 위해선 'Step' 기반 상태 머신으로 가야 합니다.
      // 오늘은 '맛보기'로 갑시다.
      break;
    }

    // (일단 엔진 뼈대만 잡고, 실제 루프 로직은 다음 단계에서 완성합시다)
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
