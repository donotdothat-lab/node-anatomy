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

    const initialState = {
      runContext: 'Main',
      parentId: null,
    };

    // 커스텀 Visitor 정의
    const visitors = {
      ...walk.base, // 기본 순회 로직 가져오기

      // [핵심] 블록문({ ... })을 우리가 직접 순회합니다.
      BlockStatement(node: any, state: any, c: any) {
        const body = node.body;

        // 블록 내부의 문장들을 하나씩 훑습니다.
        for (let i = 0; i < body.length; i++) {
          const stmt = body[i];

          // 1. 만약 이 문장이 'ExpressionStatement'이고, 그 안에 'AwaitExpression'이 있다면?
          // (예: await foo();)
          if (
            stmt.type === 'ExpressionStatement' &&
            stmt.expression.type === 'AwaitExpression'
          ) {
            const awaitNode = stmt.expression;

            // 1-1. Await의 대상(인자) 먼저 방문 (예: Promise.resolve())
            c(awaitNode.argument, state);

            // 1-2. 'await' 자체를 MicroTask로 등록 (일시정지 지점)
            const id = `async-${++asyncTaskCounter}`;
            executionPlan.push({
              id,
              type: 'MicroTask',
              name: 'await', // "일시정지 & 복귀" 작업
              line: stmt.loc.start.line,
              phase: 'Await Resume',
            });

            // 1-3. [Continuation] 남은 코드들을 묶어서 '뒷수습'으로 만듦
            const remainingStatements = body.slice(i + 1);

            if (remainingStatements.length > 0) {
              const nextState = {
                runContext: 'AsyncCallback', // 문맥 전환!
                parentId: id, // await가 끝나면 실행될 녀석들
              };

              // 남은 문장들을 '가상의 블록'으로 취급하고 순회
              remainingStatements.forEach((s) => c(s, nextState));
            }

            // [중요] 루프 종료!
            // 뒷부분은 이미 nextState로 처리했으므로, 현재 루프(Main Context)에서는 더 이상 진행하면 안 됨.
            return;
          }

          // 2. 일반 문장이면 그냥 방문
          c(stmt, state);
        }
      },

      // AwaitExpression 처리 (블록 밖이나 변수 할당 등에서 쓰일 때)
      AwaitExpression(node: any, state: any, c: any) {
        // 인자만 방문하고 넘어감 (복잡한 할당 구문 등은 MVP 범위 밖이므로 단순 처리)
        c(node.argument, state);
      },

      // 기존 로직들 (setTimeout, Promise, etc)
      CallExpression(node: any, state: any, c: any) {
        // [A] setTimeout
        if (node.callee.name === 'setTimeout') {
          const id = `async-${++asyncTaskCounter}`;
          executionPlan.push({
            id,
            type: 'MacroTask',
            phase: 'Timer',
            name: 'setTimeout',
            line: node.loc.start.line,
          });
          const nextState = { runContext: 'AsyncCallback', parentId: id };
          c(node.callee, state);
          node.arguments.forEach((arg) => {
            if (
              ['ArrowFunctionExpression', 'FunctionExpression'].includes(
                arg.type,
              )
            )
              c(arg, nextState);
            else c(arg, state);
          });
          return;
        }

        // [B] Promise.then / catch
        if (
          node.callee.type === 'MemberExpression' &&
          ['then', 'catch', 'finally'].includes(node.callee.property.name)
        ) {
          const id = `async-${++asyncTaskCounter}`;
          c(node.callee.object, state); // 체이닝 앞부분 먼저

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
              ['ArrowFunctionExpression', 'FunctionExpression'].includes(
                arg.type,
              )
            )
              c(arg, nextState);
            else c(arg, state);
          });
          return;
        }

        // [C] 일반 함수 호출
        let functionName = 'Anonymous';
        if (node.callee.type === 'Identifier') functionName = node.callee.name;
        else if (node.callee.type === 'MemberExpression') {
          functionName = `${node.callee.object.name}.${node.callee.property.name}`;
        }

        // 🔍 [NEW] 인자 추출 로직
        const args = node.arguments
          .map((arg) => {
            if (arg.type === 'Literal') {
              // 문자열이면 따옴표 붙여서 표시
              return typeof arg.value === 'string'
                ? `'${arg.value}'`
                : String(arg.value);
            }
            if (arg.type === 'Identifier') return arg.name; // 변수명
            if (
              arg.type === 'ArrowFunctionExpression' ||
              arg.type === 'FunctionExpression'
            )
              return '() => { ... }';
            return 'expr'; // 복잡한 수식 등
          })
          .join(', ');

        executionPlan.push({
          type: 'CallStack',
          runContext: state.runContext,
          parentId: state.parentId,
          name: functionName,
          args: args, // ★ 데이터를 추가합니다!
          line: node.loc.start.line,
        });

        c(node.callee, state);
        node.arguments.forEach((arg) => c(arg, state));
      },
    };

    walk.recursive(ast, initialState, visitors);
    return executionPlan;
  }
}
