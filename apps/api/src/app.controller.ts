import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ParserService } from './parser/parser.service';

@Controller('analyze')
export class AppController {
  constructor(private readonly appService: AppService, private readonly parserService: ParserService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post()
  analyzeCode(@Body('code') code: string) {
    return this.parserService.parseCode(code);
  }
}
