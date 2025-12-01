import { Injectable } from '@nestjs/common';
import * as acorn from 'acorn';

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
                locations: true // 코드의 위치 정보 포함
            })

            return {
                success: true,
                ast
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                location: error.loc
            }
        }
    }
}
