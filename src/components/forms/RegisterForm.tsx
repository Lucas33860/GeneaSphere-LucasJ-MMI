"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

const registerSchema = z.object({
  full_name: z.string().min(2, "Nom complet requis (min. 2 caractères)").max(100),
  email: z.string().email("Email invalide"),
  password: z
    .string()
    .min(8, "Mot de passe trop court (min. 8 caractères)")
    .max(72),
});

type RegisterInput = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.full_name },
      },
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    setSuccess(true);
    // Si Supabase ne demande pas de confirmation d'email, on connecte directement
    setTimeout(() => router.push("/login"), 2000);
  };

  if (success) {
    return (
      <div className="text-center space-y-2">
        <div className="text-4xl">✓</div>
        <p className="text-green-700 font-medium">Compte créé avec succès !</p>
        <p className="text-sm text-gray-500">Redirection vers la connexion…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nom complet
        </label>
        <input
          {...register("full_name")}
          type="text"
          autoComplete="name"
          placeholder="Jean Dupont"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.full_name && (
          <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          {...register("email")}
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.email && (
          <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mot de passe
        </label>
        <input
          {...register("password")}
          type="password"
          autoComplete="new-password"
          placeholder="Min. 8 caractères"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.password && (
          <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors"
      >
        {isSubmitting ? "Création du compte…" : "Créer mon compte"}
      </button>

      <p className="text-sm text-center text-gray-500">
        Déjà un compte ?{" "}
        <a href="/login" className="text-blue-600 hover:underline font-medium">
          Se connecter
        </a>
      </p>
    </form>
  );
}
