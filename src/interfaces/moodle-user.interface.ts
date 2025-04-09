export interface MoodleCriterion {
  key: string;
  value: string;
}

export interface MoodleUserResponse {
  users: MoodleUser[];
  warnings?: any[];
}

export interface MoodleUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  auth: string;
  suspended: number;
  confirmed: number;
}
