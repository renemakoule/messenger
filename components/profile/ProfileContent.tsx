import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { LogOut, Mail, Phone, User, Calendar, Info, Edit2, Lock, Sun, Moon } from "lucide-react";
import { AtSign } from "lucide-react";

export default function ProfileContent({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { user, profile } = useAuth();
  const supabase = createClient();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [status, setStatus] = useState(profile?.status || "Disponible");
  const [theme, setTheme] = useState<'light' | 'dark'>(typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleThemeToggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleChangePassword = () => {
    window.location.href = '/auth/change-password';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName,
      username,
      avatar_url: avatarUrl,
      status,
      updated_at: new Date().toISOString(),
    }).eq("id", user?.id);
    setLoading(false);
    if (error) {
      setError("Erreur lors de la mise à jour du profil.");
    } else {
      setSuccess(true);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !user) return;
    setUploadingAvatar(true);
    setError("");
    try {
      const fileExt = avatarFile.name.split(".").pop();
      const fileName = `avatars/${user.id}_${Date.now()}.${fileExt}`;
      
      // Vérifier si le bucket avatars existe, sinon utiliser chat_attachments
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      console.log("Buckets disponibles:", buckets);
      console.log("Erreur bucket:", bucketError);
      
      if (bucketError) {
        console.error("Erreur lors de la vérification des buckets:", bucketError);
        throw new Error("Impossible d'accéder au stockage");
      }
      
      const avatarBucket = buckets?.find(bucket => bucket.name === "avatars");
      const chatAttachmentsBucket = buckets?.find(bucket => bucket.name === "chat_attachments");
      
      console.log("Avatar bucket trouvé:", avatarBucket);
      console.log("Chat attachments bucket trouvé:", chatAttachmentsBucket);
      
      let bucketName = "avatars";
      if (!avatarBucket && chatAttachmentsBucket) {
        bucketName = "chat_attachments";
        console.log("Bucket 'avatars' non trouvé, utilisation de 'chat_attachments'");
      } else if (!avatarBucket) {
        throw new Error("Aucun bucket de stockage disponible. Veuillez créer le bucket 'avatars' ou 'chat_attachments' dans votre projet Supabase.");
      }
      
      console.log("Utilisation du bucket:", bucketName);
      
      const { data, error } = await supabase.storage.from(bucketName).upload(fileName, avatarFile, {
        cacheControl: "3600",
        upsert: true,
        metadata: { owner: user.id },
      });
      
      if (error) {
        console.error("Erreur d'upload:", error);
        throw error;
      }
      
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(data.path);
      setAvatarUrl(urlData.publicUrl);
      setAvatarFile(null);
      setAvatarPreview(null);
      setSuccess(true);
    } catch (err: any) {
      console.error("Erreur complète:", err);
      const errorMessage = err.message || "Erreur lors de l'upload de l'avatar.";
      setError(errorMessage);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Mon profil</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={handleThemeToggle}>{theme === 'dark' ? <Sun /> : <Moon />}</Button>
        
          </div>
        </div>
      </div>
      
      <ScrollArea className="h-[450px]">
        <div className="p-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="flex flex-col items-center gap-2 mb-6 relative">
              <Avatar className="h-24 w-24 shadow-lg border-4 border-slate-200 dark:border-slate-800">
                {avatarPreview ? (
                  <Image src={avatarPreview} width={96} height={96} alt="Preview" className="rounded-full object-cover" />
                ) : (
                  <AvatarImage src={avatarUrl || undefined} />
                )}
                <AvatarFallback className="text-2xl">{displayName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <input type="file" accept="image/*" className="hidden" id="avatar-upload" onChange={handleAvatarChange} />
              <Button type="button" variant="outline" size="icon" className="absolute bottom-0 right-[calc(50%-24px)] rounded-full shadow bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700" onClick={() => document.getElementById('avatar-upload')?.click()} disabled={uploadingAvatar}><Edit2 className="h-5 w-5" /></Button>
              {avatarFile && (
                <Button type="button" size="sm" onClick={handleAvatarUpload} disabled={uploadingAvatar} className="mt-2">{uploadingAvatar ? "Upload..." : "Uploader"}</Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-lg border pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800" value={displayName} onChange={e => setDisplayName(e.target.value)} required placeholder="Nom d'affichage" />
              </div>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-lg border pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Nom d'utilisateur" />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-lg border pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800" value={user?.email || ""} disabled />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-lg border pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"} disabled />
              </div>
              <div className="relative">
                <Info className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select className="w-full rounded-lg border pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="Disponible">Disponible</option>
                  <option value="Occupé(e)">Occupé(e)</option>
                  <option value="En vacances">En vacances</option>
                  <option value="Ne pas déranger">Ne pas déranger</option>
                  <option value="Absent(e)">Absent(e)</option>
                  <option value="Autre">Autre...</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button type="submit" disabled={loading} className="flex-1 text-base font-semibold">
                {loading ? "Enregistrement..." : "Enregistrer"}
              </Button>
              <Button type="button" variant="outline" className="flex-1 text-base font-semibold" onClick={handleChangePassword}>
                <Lock className="mr-2 h-5 w-5" />Changer mot de passe
              </Button>
            </div>
            {success && <p className="text-green-600 text-sm text-center mt-2">Profil mis à jour !</p>}
            {error && <p className="text-red-600 text-sm text-center mt-2">{error}</p>}
          </form>
        </div>
      </ScrollArea>
    </div>
  );
} 