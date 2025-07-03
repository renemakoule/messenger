-- #############################################
-- #          1. CRÉATION DES TABLES           #
-- #############################################

-- Extension pour générer des UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table des profils utilisateurs
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.profiles IS 'Stores public profile information for each user.';

-- Table des conversations
CREATE TABLE public.chats (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  is_group boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.chats IS 'Represents a chat conversation, either 1-on-1 or a group.';

-- Table des membres des conversations
CREATE TABLE public.chat_members (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id uuid NOT NULL REFERENCES public.chats ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, profile_id)
);
COMMENT ON TABLE public.chat_members IS 'Associates users with chats.';

-- Table des messages
CREATE TABLE public.messages (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id uuid NOT NULL REFERENCES public.chats ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  content text,
  attachment_url text,
  attachment_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.messages IS 'Stores individual messages for each chat.';

-- Table pour le suivi des lectures de messages
CREATE TABLE public.message_reads (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL REFERENCES public.messages ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, profile_id)
);
COMMENT ON TABLE public.message_reads IS 'Tracks read status of messages for each user.';

-- Table pour les labels de chat
CREATE TABLE public.chat_labels (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, name)
);
COMMENT ON TABLE public.chat_labels IS 'User-defined labels to organize chats.';

-- Table pour l'assignation des labels aux chats
CREATE TABLE public.chat_label_assignments (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id uuid NOT NULL REFERENCES public.chats ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.chat_labels ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, label_id, profile_id)
);
COMMENT ON TABLE public.chat_label_assignments IS 'Assigns a label to a chat for a specific user.';


-- #############################################
-- #         2. CRÉATION DES FONCTIONS         #
-- #############################################

-- Fonction pour obtenir les détails d'un chat pour la sidebar
create or replace function public.get_chat_details(chat_id_param uuid, user_id_param uuid)
returns table (
  id uuid,
  name text,
  is_group boolean,
  created_at timestamptz,
  updated_at timestamptz,
  last_message json,
  unread_count bigint
)
language plpgsql
as $$
begin
  return query
  select
    c.id,
    -- Pour les chats 1-to-1, le nom est le nom de l'autre participant.
    case
      when c.is_group = false then (
        select p.display_name
        from public.chat_members cm
        join public.profiles p on cm.profile_id = p.id
        where cm.chat_id = c.id and cm.profile_id <> user_id_param
        limit 1
      )
      else c.name
    end as name,
    c.is_group,
    c.created_at,
    c.updated_at,
    -- Récupère le dernier message sous forme de JSON
    (
      select
        json_build_object(
          'id', m.id,
          'content', m.content,
          'sender_id', m.sender_id,
          'sender_name', p.display_name,
          'created_at', m.created_at,
          'has_attachment', m.attachment_url is not null
        )
      from public.messages m
      join public.profiles p on m.sender_id = p.id
      where m.chat_id = c.id
      order by m.created_at desc
      limit 1
    ) as last_message,
    -- Compte les messages non lus pour l'utilisateur courant
    (
      select count(*)
      from public.messages m
      where m.chat_id = c.id
      and m.sender_id <> user_id_param
      and not exists (
        select 1
        from public.message_reads mr
        where mr.message_id = m.id and mr.profile_id = user_id_param
      )
    ) as unread_count
  from
    public.chats c
  where
    c.id = chat_id_param;
end;
$$;


-- #############################################
-- #          3. CRÉATION DES TRIGGERS         #
-- #############################################

-- Fonction pour créer un profil lors de la création d'un utilisateur auth
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    -- Utilise la partie de l'email avant le '@' comme nom d'utilisateur par défaut
    substring(new.email from 1 for position('@' in new.email) - 1),
    -- Utilise le nom complet fourni par Google/OAuth comme nom d'affichage
    new.raw_user_meta_data->>'full_name',
    -- Utilise l'URL de l'avatar fourni par Google/OAuth
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- Trigger qui appelle la fonction après l'insertion dans auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();


-- #############################################
-- #           4. POLITIQUES DE STOCKAGE       #
-- #############################################

-- Création du bucket de stockage pour les pièces jointes
insert into storage.buckets (id, name, public)
values ('chat_attachments', 'chat_attachments', true)
on conflict (id) do nothing;

-- RLS: Tout le monde peut voir les pièces jointes (car les URLs sont partagées)
create policy "Allow public read access"
on storage.objects for select
using ( bucket_id = 'chat_attachments' );

-- RLS: Les utilisateurs authentifiés peuvent uploader des fichiers
create policy "Allow authenticated uploads"
on storage.objects for insert
with check ( bucket_id = 'chat_attachments' and auth.role() = 'authenticated' );

-- RLS: Les utilisateurs ne peuvent modifier/supprimer que leurs propres fichiers
create policy "Allow user to manage their own files"
on storage.objects for update
using ( bucket_id = 'chat_attachments' and auth.uid() = owner )
with check ( auth.uid() = owner );

create policy "Allow user to delete their own files"
on storage.objects for delete
using ( bucket_id = 'chat_attachments' and auth.uid() = owner );