import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { MoodleService } from '../services/moodle.service';
import { RegisterDto } from './dto/registrer.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private moodleService: MoodleService,
  ) {}

  @Post('login')
  async login(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    return this.authService.login(username, password);
  }

  @UseGuards(AuthGuard)
  @Get('courses')
  async getCourses(@Request() req) {
    return this.moodleService.getCourses(req.user.moodleToken);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('change-role')
  async changeRole(
    @Body() data: { userId: string, newRole: string }
  ) {
    return this.authService.changeRole(data.userId, data.newRole);
  }
}
