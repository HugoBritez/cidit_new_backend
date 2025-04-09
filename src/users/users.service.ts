import { Injectable, BadRequestException } from '@nestjs/common';
import { MoodleService } from '../services/moodle.service';
import { DatabaseService } from '../services/database.service';
import { ConfigService } from '@nestjs/config';
import { MoodleCriterion, MoodleUserResponse, MoodleUser } from '../interfaces/moodle-user.interface';

@Injectable()
export class UsersService {
  constructor(
    private moodleService: MoodleService,
    private dbService: DatabaseService,
    private configService: ConfigService
  ) {}

  private async getMoodleAdminToken(): Promise<string> {
    return this.configService.get('MOODLE_TOKEN') || '';
  }

  async getAllUsers(searchParams?: { field?: string; value?: string }) {
    try {
      let query = `
        SELECT 
          lu.*,
          CONCAT(lu.first_name, ' ', lu.last_name) as fullname
        FROM local_users lu
        WHERE is_active = TRUE
      `;
      
      const params: string[] = [];
      if (searchParams?.field && searchParams?.value) {
        const validFields = ['first_name', 'last_name', 'username', 'email'];
        if (validFields.includes(searchParams.field)) {
          query += ` AND ${searchParams.field} LIKE ?`;
          params.push(`%${searchParams.value}%`);
        }
      }

      const users = await this.dbService.query(query, params);
      return users;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw new BadRequestException('Error al obtener usuarios');
    }
  }

  async createLocalUser(moodleUser: MoodleUser, role: string = 'student') {
    const sql = `
      INSERT INTO local_users (
        moodle_user_id, username, email, first_name, last_name, role
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        role = VALUES(role)
    `;

    await this.dbService.query(sql, [
      moodleUser.id,
      moodleUser.username,
      moodleUser.email,
      moodleUser.firstname,
      moodleUser.lastname,
      role
    ]);
  }

  async changeRole(userId: string, newRole: string) {
    try {
      // Validar que el rol sea válido
      if (!['student', 'teacher', 'admin'].includes(newRole)) {
        throw new BadRequestException('Rol no válido');
      }

      // Primero actualizamos en nuestra base de datos local
      await this.dbService.query(
        'UPDATE local_users SET role = ? WHERE moodle_user_id = ?',
        [newRole, userId]
      );

      // Luego actualizamos en Moodle
      const roleMap = {
        'student': 5,
        'teacher': 3,
        'admin': 1
      };

      await this.moodleService.callMoodleApi(
        'core_role_assign_roles',
        await this.getMoodleAdminToken(),
        {
          assignments: [{
            roleid: roleMap[newRole],
            userid: parseInt(userId),
            contextid: 1
          }]
        }
      );

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
      // Primero buscamos en nuestra base de datos local
      const [localUser] = await this.dbService.query(
        'SELECT * FROM local_users WHERE moodle_user_id = ?',
        [id]
      );

      if (!localUser) {
        // Si no existe en local, buscamos en Moodle y lo creamos localmente
        const moodleUser = await this.moodleService.callMoodleApi(
          'core_user_get_users_by_field',
          await this.getMoodleAdminToken(),
          {
            field: 'id',
            values: [id]
          }
        );

        if (moodleUser && moodleUser[0]) {
          await this.createLocalUser(moodleUser[0]);
          return this.getUser(id); // Recursivamente obtenemos el usuario recién creado
        }
      }

      return localUser;
    } catch (error) {
      throw new BadRequestException('Usuario no encontrado');
    }
  }

  async updateLastLogin(userId: string) {
    await this.dbService.query(
      'UPDATE local_users SET last_login = CURRENT_TIMESTAMP WHERE moodle_user_id = ?',
      [userId]
    );
  }
}
