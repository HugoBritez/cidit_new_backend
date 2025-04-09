import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class MoodleService {
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('MOODLE_URL') || '';
  }

  async callMoodleApi<T = any>(wsfunction: string, token: string, params = {}): Promise<T> {
    try {
      const formattedParams = this.flattenObject(params);
      
      console.log('Llamando a Moodle API:', {
        función: wsfunction,
        parámetros: formattedParams
      });

      const response = await axios.get(
        `${this.baseUrl}/webservice/rest/server.php`,
        {
          params: {
            wstoken: token,
            wsfunction,
            moodlewsrestformat: 'json',
            ...formattedParams
          }
        }
      );

      // Log detallado de la respuesta
      console.log('Respuesta completa de Moodle:', {
        status: response.status,
        data: response.data,
        headers: response.headers
      });

      // Moodle puede devolver errores con status 200
      if (response.data.exception || response.data.errorcode) {
        console.error('Error de Moodle con status 200:', response.data);
        throw new BadRequestException({
          message: response.data.message || response.data.error,
          errorcode: response.data.errorcode,
          exception: response.data.exception
        });
      }

      return response.data as T;
    } catch (error) {
      // Mejorar el logging del error
      if (error.response?.data) {
        console.error('Error detallado de Moodle:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else {
        console.error('Error no relacionado con la respuesta:', error);
      }

      // Si es un error que ya hemos formateado, lo pasamos directamente
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error.response?.data?.message || 
        error.response?.data?.error ||
        'Error en la comunicación con Moodle'
      );
    }
  }

  private flattenObject(obj: any, prefix = ''): any {
    const flattened = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}[${key}]` : key;

        if (value === null) {
          flattened[newKey] = '';
        } else if (typeof value === 'object') {
          if (Array.isArray(value)) {
            // Manejar arrays
            value.forEach((item, index) => {
              const arrayPrefix = `${newKey}[${index}]`;
              if (typeof item === 'object') {
                Object.assign(flattened, this.flattenObject(item, arrayPrefix));
              } else {
                flattened[arrayPrefix] = item;
              }
            });
          } else {
            // Manejar objetos anidados
            Object.assign(flattened, this.flattenObject(value, newKey));
          }
        } else {
          flattened[newKey] = value;
        }
      }
    }

    return flattened;
  }

  async getUserInfo(token: string) {
    return this.callMoodleApi('core_webservice_get_site_info', token);
  }

  async getCourses(token: string) {
    return this.callMoodleApi('core_course_get_courses', token);
  }
}
