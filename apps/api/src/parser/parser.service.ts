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
    const executionPlan: any = [];

    // AST 순회하며 CallExpression 찾기
    walk.simple(ast, {
      CallExpression(node: any) {
        // 1. setTimeout 감지 (MacroTask)
        if (node.callee.name === 'setTimeout') {
          executionPlan.push({
            type: 'MacroTask',
            phase: 'Timer',
            name: 'setTimeout',
            line: node.loc.start.line,
          });
          return;
        }

        // 2. process.nextTick 감지(MicroTask - High Priority)
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'process' &&
          node.callee.property.name === 'nextTick'
        ) {
          executionPlan.push({
            type: 'MicroTask',
            priority: 'High',
            name: 'process.nextTick',
            line: node.loc.start.line,
          });
          return;
        }

        // 3. Promise 감지 (MicroTask)
        // 예: Promise.resolve().then(...) 형태 감지
        // (단순화를 위해 'then' 메서드 호출을 감지하는 약식 로직)
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'then'
        ) {
          executionPlan.push({
            type: 'MicroTask',
            priority: 'Normal',
            name: 'Promise.then',
            line: node.loc.start.line,
          });
          return;
        }

        // 4. 동기(Sync) 작업
        let functionName = 'Anonymous';

        if (node.callee.type === 'Identifier') {
          functionName = node.callee.name;
        } else if (node.callee.type === 'MemberExpression') {
          functionName = `${node.callee.object.name}.${node.callee.property.name}`;
        }

        executionPlan.push({
          type: 'CallStack',
          name: functionName,
          line: node.loc.start.line,
        });
      },
    });
    return executionPlan;
  }
}
