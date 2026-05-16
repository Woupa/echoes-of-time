
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own conversations select" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own conversations insert" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own conversations update" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own conversations delete" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "own messages select" ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own messages insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own messages delete" ON public.messages FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_conversation
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();
