import { Injectable } from '@nestjs/common';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

@Injectable()
export class ParserService {
  /**
   * 자바스크립트 소스 코드를 입력받아 AST(Abstract Syntax Tree)로 변환.
   * 이 과정은 V8 엔진이 코드를 실행하기 전 가장 먼저 수행하는 '파싱(Parsing)' 단계와 유사함.
   */
  parseCode(sourceCode: string) {
    try {
      // acorn.parse 는 코드를 읽어 트리 구조의 객체(Node)로 만든다.
      const ast = acorn.parse(sourceCode, {
        ecmaVersion: 2025,
        locations: true, // 코드의 위치 정보 포함
      });
      const analysis = this.analyzeExecutionFlow(ast);

      return {
        success: true,
        ast,
        analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        location: error.loc,
      };
    }
  }

  private analyzeExecutionFlow(ast: any) {
    const executionPlan: any[] = [];
    let asyncTaskCounter = 0;

    // 1. 초기 상태: "여기는 메인 스레드(Main)입니다."
    const initialState = {
      runContext: 'Main',
      parentId: null,
    };

    // 2. 재귀 순회 (Recursive Walk) 시작
    // walk.base를 ...로 복사해서 기본 순회 기능을 가져옵니다.
    walk.recursive(ast, initialState, {
      ...walk.base,

      CallExpression(node: any, state: any, c: any) {
        // c(node, state)는 "이 노드를 이 상태로 방문해라"라는 명령어입니다.

        // [A] setTimeout 발견!
        if (node.callee.name === 'setTimeout') {
          const id = `async-${++asyncTaskCounter}`;

          // 계획표에 적기
          executionPlan.push({
            id,
            type: 'MacroTask',
            phase: 'Timer',
            name: 'setTimeout',
            line: node.loc.start.line,
          });

          // ★ 핵심: 자식(콜백 함수)에게 물려줄 "새로운 명찰" 만들기
          const nextState = {
            runContext: 'AsyncCallback',
            parentId: id,
          };

          // 1. callee(함수 이름)는 현재 문맥 그대로 방문
          c(node.callee, state);

          // 2. 인자들(arguments) 방문
          node.arguments.forEach((arg) => {
            // 만약 인자가 함수라면(콜백), 새 명찰(nextState)을 달아줍니다.
            if (
              arg.type === 'ArrowFunctionExpression' ||
              arg.type === 'FunctionExpression'
            ) {
              c(arg, nextState);
            } else {
              // 시간이 0초 같은 숫자라면 그냥 현재 문맥 유지
              c(arg, state);
            }
          });
          return;
        }

        // [B] process.nextTick 발견!
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'process' &&
          node.callee.property.name === 'nextTick'
        ) {
          const id = `async-${++asyncTaskCounter}`;
          executionPlan.push({
            id,
            type: 'MicroTask',
            priority: 'High',
            name: 'process.nextTick',
            line: node.loc.start.line,
          });

          const nextState = { runContext: 'AsyncCallback', parentId: id };

          c(node.callee, state);
          node.arguments.forEach((arg) => {
            if (
              arg.type === 'ArrowFunctionExpression' ||
              arg.type === 'FunctionExpression'
            ) {
              c(arg, nextState);
            } else {
              c(arg, state);
            }
          });
          return;
        }

        // [C] Promise 체이닝 감지 (.then / .catch / .finally)
        if (
          node.callee.type === 'MemberExpression' &&
          (node.callee.property.name === 'then' ||
            node.callee.property.name === 'catch' ||
            node.callee.property.name === 'finally')
        ) {
          const id = `async-${++asyncTaskCounter}`;

          // 먼저 안쪽(이전 체인)으로 파고들기
          // 이렇게 해야 이전 .then() 들이 먼저 배열에 담기게 됨.
          c(node.callee.object, state);

          // 돌아오면 기록
          const methodName = `Promise.${node.callee.property.name}`;

          executionPlan.push({
            id,
            type: 'MicroTask',
            priority: 'Normal',
            name: methodName,
            line: node.loc.start.line,
          });

          const nextState = { runContext: 'AsyncCallback', parentId: id };

          node.arguments.forEach((arg) => {
            if (
              arg.type === 'ArrowFunctionExpression' ||
              arg.type === 'FunctionExpression'
            ) {
              c(arg, nextState);
            } else {
              c(arg, state);
            }
          });
          return;
        }

        // [D] 그 외: 일반 동기 함수 (console.log 등)
        let functionName = 'Anonymous';
        if (node.callee.type === 'Identifier') functionName = node.callee.name;
        else if (node.callee.type === 'MemberExpression') {
          functionName = `${node.callee.object.name}.${node.callee.property.name}`;
        }

        executionPlan.push({
          type: 'CallStack',
          runContext: state.runContext, // ★ 부모가 물려준 명찰을 그대로 기록!
          parentId: state.parentId, // ★ 부모 ID도 그대로 기록!
          name: functionName,
          line: node.loc.start.line,
        });

        // 자식들도 현재 상태 그대로 계속 탐색
        c(node.callee, state);
        node.arguments.forEach((arg) => c(arg, state));
      },
    });

    return executionPlan;
  }
}
