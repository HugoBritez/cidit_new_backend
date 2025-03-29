import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AppService {
  private readonly moodleUrl: string;
  private readonly token: string;

  constructor(private configService: ConfigService) {
    this.moodleUrl = this.configService.get<string>('MOODLE_URL') || '';
    this.token = this.configService.get<string>('MOODLE_TOKEN') || '';

    if (!this.moodleUrl || !this.token) {
      throw new Error('Missing Moodle configuration');
    }
  }

  async testMoodleConnection() {
    try {
      const response = await axios.get(this.moodleUrl, {
        params: {
          wstoken: this.token,
          wsfunction: 'core_course_get_courses',
          moodlewsrestformat: 'json',
        },
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  }
}
