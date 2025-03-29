import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MoodleService {
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('MOODLE_URL') || '';
  }

  async callMoodleApi(wsfunction: string, token: string, params = {}) {
    const response = await axios.get(
      `${this.baseUrl}/webservice/rest/server.php`,
      {
        params: {
          wstoken: token,
          wsfunction,
          moodlewsrestformat: 'json',
          ...params,
        },
      },
    );

    if (response.data.exception) {
      throw new Error(response.data.message);
    }

    return response.data;
  }

  async getUserInfo(token: string) {
    return this.callMoodleApi('core_webservice_get_site_info', token);
  }

  async getCourses(token: string) {
    return this.callMoodleApi('core_course_get_courses', token);
  }
}
