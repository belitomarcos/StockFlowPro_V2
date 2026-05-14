-- Comandos SQL para habilitar RLS (Row Level Security) e criar políticas de acesso
-- Execute estes comandos no SQL Editor do seu painel do Supabase.

-- IMPORTANTE: Como a aplicação ainda não possui sistema de Login, precisamos permitir 
-- acesso anônimo (anon) temporariamente para que o banco consiga responder à aplicação.

-- 1. Habilitar RLS em todas as tabelas
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacao_estoque ENABLE ROW LEVEL SECURITY;

-- 2. Remover regras anteriores (se existirem)
DROP POLICY IF EXISTS "Acesso total para usuários autenticados" ON public.produtos;
DROP POLICY IF EXISTS "Acesso total para usuários autenticados" ON public.destinos;
DROP POLICY IF EXISTS "Acesso total para usuários autenticados" ON public.tecnicos;
DROP POLICY IF EXISTS "Acesso total para usuários autenticados" ON public.movimentacao_estoque;

-- 3. Criar políticas de acesso liberado para que a aplicação consiga ler e escrever sem Autenticação Logada
CREATE POLICY "Acesso total para aplicacao (anon e authenticated)" ON public.produtos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total para aplicacao (anon e authenticated)" ON public.destinos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total para aplicacao (anon e authenticated)" ON public.tecnicos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total para aplicacao (anon e authenticated)" ON public.movimentacao_estoque FOR ALL USING (true) WITH CHECK (true);

-- Tabela de Compras (Sugestoes de Reposicao)
CREATE TABLE IF NOT EXISTS public.compras (
  id uuid default gen_random_uuid() primary key,
  produto_id text,
  nome text not null,
  quantidade numeric not null default 1,
  status text not null default 'Pendente',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir operações livres na tabela compras"
ON public.compras
FOR ALL
USING (true)
WITH CHECK (true);
