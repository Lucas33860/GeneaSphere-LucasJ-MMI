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
  tree_id: string;
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
  tree_id: string;
  member1_id: string;
  member2_id: string;
  union_type: 'couple' | 'marriage';
  union_date: string | null;
  separation_date: string | null;
}

export interface Tree {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  role?: "owner" | "admin" | "editor" | "reader";
  owner_name?: string;
  member_count?: number;
}

export interface TreeAccessEntry {
  id: string;
  tree_id: string;
  user_id: string;
  role: "reader" | "editor" | "admin";
  granted_at: string;
  user_name?: string;
  user_email?: string;
}
