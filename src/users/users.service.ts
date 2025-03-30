import { Injectable, BadRequestException } from '@nestjs/common';
import { MoodleService } from '../services/moodle.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(
    private moodleService: MoodleService,
    private configService: ConfigService
  ) {}

  private async getMoodleAdminToken(): Promise<string> {
    return this.configService.get('MOODLE_TOKEN') || '';
  }

  async getAllUsers() {
    try {
      const users = await this.moodleService.callMoodleApi(
        'core_user_get_users',
        await this.getMoodleAdminToken(),
        {
          criteria: [] // Traer todos los usuarios
        }
      );

      return users.map(user => ({
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.roles?.[0]?.shortname || 'student'
      }));
    } catch (error) {
      throw new BadRequestException('Error al obtener usuarios');
    }
  }

  async changeRole(userId: string, newRole: string) {
    try {
      // Validar que el rol sea válido
      if (!['student', 'teacher', 'admin', 'manager'].includes(newRole)) {
        throw new BadRequestException('Rol no válido');
      }

      const roleMap = {
        'student': 5,
        'teacher': 4,    // Non-editing teacher
        'admin': 1,      // Manager
        'manager': 1     // Manager (mismo que admin)
      };

      const response = await this.moodleService.callMoodleApi(
        'core_role_assign_roles',
        await this.getMoodleAdminToken(),
        {
          assignments: [{
            roleid: roleMap[newRole],
            userid: parseInt(userId),
            contextid: 1,  // Contexto del sistema
          }]
        }
      );

      // Si no hay error, el rol se asignó correctamente
      return {
        success: true,
        message: `Rol actualizado a ${newRole}`,
        role: newRole
      };
    } catch (error) {
      console.error('Error al cambiar rol:', error);
      throw new BadRequestException('Error al cambiar el rol del usuario');
    }
  }

  async getUser(id: string) {
    try {
      const user = await this.moodleService.callMoodleApi(
        'core_user_get_users_by_field',
        await this.getMoodleAdminToken(),
        {
          field: 'id',
          values: [id]
        }
      );

      return user[0];
    } catch (error) {
      throw new BadRequestException('Usuario no encontrado');
    }
  }
}
