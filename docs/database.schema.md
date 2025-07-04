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







-- =================================================================
-- SCRIPT COMPLET ET CORRIGÉ POUR LA RÉCUPÉRATION OPTIMISÉE DES CHATS
-- Exécutez ce bloc en une seule fois dans l'éditeur SQL de Supabase.
-- =================================================================

-- ÉTAPE 1: NETTOYAGE ET CRÉATION DU TYPE DE RETOUR
-- On supprime l'ancien type s'il existe pour permettre les modifications.
DROP TYPE IF EXISTS public.chat_details_type CASCADE;

-- On crée le type qui définit la structure de chaque ligne retournée.
-- Assurez-vous que cela correspond à ce que votre application attend.
CREATE TYPE public.chat_details_type AS (
    id uuid,
    name text,
    is_group boolean,
    created_at timestamptz,
    updated_at timestamptz,
    last_message json,
    unread_count bigint
);


-- ÉTAPE 2: CRÉATION OU REMPLACEMENT DE LA FONCTION RPC
CREATE OR REPLACE FUNCTION public.get_chats_details_for_user(
    user_id_param uuid
)
RETURNS SETOF public.chat_details_type -- Retourne un ensemble de lignes du type défini ci-dessus
LANGUAGE plpgsql
SECURITY DEFINER -- Exécute la fonction avec les droits du créateur (admin), contournant les RLS si nécessaire.
AS $$
DECLARE
    chat_ids_list uuid[];
BEGIN
    -- Récupère tous les chat_id auxquels l'utilisateur appartient.
    SELECT ARRAY_AGG(cm.chat_id)
    INTO chat_ids_list
    FROM public.chat_members cm
    WHERE cm.profile_id = user_id_param;

    -- Si l'utilisateur n'est dans aucun chat, on arrête l'exécution.
    IF chat_ids_list IS NULL OR array_length(chat_ids_list, 1) = 0 THEN
        RETURN;
    END IF;

    -- Retourne les détails pour chaque chat trouvé.
    RETURN QUERY
    WITH last_messages AS (
        SELECT
            c.id AS chat_id,
            (
                SELECT
                    json_build_object(
                        'id', m.id,
                        'content', m.content,
                        'sender_id', m.sender_id,
                        'sender_name', p.display_name,
                        'created_at', m.created_at,
                        'has_attachment', m.attachment_url IS NOT NULL
                    )
                FROM public.messages m
                LEFT JOIN public.profiles p ON m.sender_id = p.id
                WHERE m.chat_id = c.id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) AS message_data
        FROM public.chats c
        WHERE c.id = ANY(chat_ids_list)
    ),
    unread_counts AS (
        SELECT
            m.chat_id,
            count(*) FILTER (WHERE NOT mr.is_read) AS count
        FROM public.messages m
        LEFT JOIN (
            SELECT message_id, true as is_read
            FROM public.message_reads
            WHERE profile_id = user_id_param
        ) mr ON m.id = mr.message_id
        WHERE m.chat_id = ANY(chat_ids_list)
        AND m.sender_id <> user_id_param
        GROUP BY m.chat_id
    )
    SELECT
        c.id,
        CASE
            WHEN c.is_group THEN c.name
            ELSE (
                SELECT p.display_name
                FROM public.chat_members cm
                JOIN public.profiles p ON cm.profile_id = p.id
                WHERE cm.chat_id = c.id AND cm.profile_id <> user_id_param
                LIMIT 1
            )
        END AS name,
        c.is_group,
        c.created_at,
        c.updated_at,
        lm.message_data AS last_message,
        COALESCE(uc.count, 0) AS unread_count
    FROM public.chats c
    LEFT JOIN last_messages lm ON c.id = lm.chat_id
    LEFT JOIN unread_counts uc ON c.id = uc.chat_id -- CORRECTION APPLIQUÉE ICI
    WHERE c.id = ANY(chat_ids_list);

END;
$$;


-- ÉTAPE 3: ACCORDER LES PERMISSIONS D'EXÉCUTION
-- Accorde au rôle `authenticated` (tous les utilisateurs connectés) le droit d'exécuter cette fonction.
GRANT EXECUTE ON FUNCTION public.get_chats_details_for_user(user_id_param uuid) TO authenticated;

-- (Optionnel mais recommandé) Assurez-vous que l'owner de la fonction est bien le super-utilisateur `postgres`
ALTER FUNCTION public.get_chats_details_for_user(uuid) OWNER TO postgres;