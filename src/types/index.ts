export type UserRole = "admin" | "user";

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
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Parentage {
  id: string;
  child_id: string;
  father_id: string | null;
  mother_id: string | null;
}

export interface Spouse {
  id: string;
  member1_id: string;
  member2_id: string;
  union_date: string | null;
  separation_date: string | null;
}

export interface Relation {
  type: "parent" | "child" | "spouse";
  member: Member;
}

export interface FamilyTreeNode {
  member: Member;
  children: FamilyTreeNode[];
  spouses: Member[];
  parents: {
    father: Member | null;
    mother: Member | null;
  };
}

export interface FamilyStats {
  total_members: number;
  oldest_member: Member | null;
  youngest_member: Member | null;
  average_lifespan: number | null;
  most_common_first_name: string | null;
  generations: number;
}
