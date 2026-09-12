"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Loader2, Check, Camera, Trash2 } from "lucide-react";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB

export function MeuPerfilPanel() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null | undefined>(undefined); // undefined = sem alteração pendente
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentImage = photoPreview !== undefined ? photoPreview : user?.image ?? null;

  async function refreshSession() {
    try {
      await createSupabaseBrowserClient().auth.refreshSession();
    } catch {
      // não crítico — o dado já foi salvo, apenas a sessão local pode ficar defasada até o próximo login
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("A imagem deve ter no máximo 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (password && password.length < 6) {
      setError("A nova senha deve ter ao menos 6 caracteres");
      return;
    }
    if (password && password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const body: Record<string, string | null> = {};
      if (name && name !== user.name) body.name = name;
      if (password) body.password = password;
      if (photoPreview !== undefined) body.image = photoPreview;

      if (Object.keys(body).length === 0) { setSaving(false); return; }

      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Não foi possível salvar as alterações");
      }
      setPassword("");
      setConfirmPassword("");
      setPhotoPreview(undefined);
      await refreshSession();
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-md">
      <div className="flex items-center gap-4 mb-5">
        <div className="relative group shrink-0">
          <Avatar name={user?.name} image={currentImage} size={56} className="text-xl" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Alterar foto"
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
          >
            <Camera size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">{user?.name}</p>
          <p className="text-xs text-gray-400">{user?.email}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-medium text-accent hover:text-accent-dark transition-colors">
              Alterar foto
            </button>
            {currentImage && (
              <button type="button" onClick={() => setPhotoPreview(null)} className="text-xs font-medium text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1">
                <Trash2 size={11} /> Remover
              </button>
            )}
          </div>
        </div>
      </div>
      {photoError && <p className="text-xs text-red-600 mb-3">{photoError}</p>}

      <form onSubmit={handleSave} className="space-y-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="E-mail" value={user?.email ?? ""} disabled className="opacity-60 cursor-not-allowed" />

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-3">Alterar senha (opcional)</p>
          <div className="space-y-3">
            <Input label="Nova senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixe em branco para manter a atual" />
            <Input label="Confirmar nova senha" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        {success && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <Check size={14} /> Alterações salvas.
          </p>
        )}

        <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-accent hover:bg-accent-dark disabled:opacity-50 text-white rounded-lg transition-colors">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Salvar alterações
        </button>
      </form>
    </div>
  );
}
