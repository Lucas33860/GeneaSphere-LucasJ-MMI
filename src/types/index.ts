export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "other" | null;
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  photo_url: string | null;
  bio: string | null;
  is_private: boolean;
  father_id: string | null;
  mother_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Spouse {
  id: string;
  member1_id: string;
  member2_id: string;
  union_type: 'couple' | 'marriage';
  union_date: string | null;
  separation_date: string | null;
}

