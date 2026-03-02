"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { authFieldCls } from "@/lib/ui";

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
  };

  if (success) {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl">
          📧
        </div>
        <h2 className="text-lg font-bold text-white">Vérifiez vos mails !</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Un email de confirmation a été envoyé.<br />
          Cliquez sur le lien pour activer votre compte.
        </p>
        <p className="text-xs text-slate-500">Pensez à vérifier vos spams.</p>
        <a
          href="/login"
          className="block w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm mt-2"
        >
          Aller à la connexion
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Nom complet</label>
        <input
          {...register("full_name")}
          type="text"
          autoComplete="name"
          placeholder="Jean Dupont"
          className={authFieldCls}
        />
        {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Email</label>
        <input
          {...register("email")}
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          className={authFieldCls}
        />
        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Mot de passe</label>
        <input
          {...register("password")}
          type="password"
          autoComplete="new-password"
          placeholder="Min. 8 caractères"
          className={authFieldCls}
        />
        {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
      </div>

      {serverError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors mt-2"
      >
        {isSubmitting ? "Création du compte…" : "Créer mon compte"}
      </button>
    </form>
  );
}
