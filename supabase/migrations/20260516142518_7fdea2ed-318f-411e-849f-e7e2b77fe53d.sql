ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS share_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_share_token_idx
  ON public.conversations(share_token);

-- Public read accessor: returns conversation + messages only when is_public = true
CREATE OR REPLACE FUNCTION public.get_shared_conversation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv RECORD;
  msgs jsonb;
BEGIN
  SELECT id, character_id, title, created_at, updated_at
    INTO conv
    FROM public.conversations
    WHERE share_token = _token AND is_public = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'role', m.role,
    'content', m.content,
    'created_at', m.created_at
  ) ORDER BY m.created_at ASC), '[]'::jsonb)
  INTO msgs
  FROM public.messages m
  WHERE m.conversation_id = conv.id;

  RETURN jsonb_build_object(
    'id', conv.id,
    'character_id', conv.character_id,
    'title', conv.title,
    'created_at', conv.created_at,
    'updated_at', conv.updated_at,
    'messages', msgs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_conversation(uuid) TO anon, authenticated;