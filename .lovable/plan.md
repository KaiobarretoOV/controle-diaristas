## Ajustes solicitados

### 1. Valor de domingo/feriado corrigido

- Alterar o cálculo: domingo ou feriado agora é **R$ 130 + R$ 20 de passagem = R$ 150** (antes estava 150+20).
- Dia normal continua **R$ 100 + R$ 20 = R$ 120**.
- Ajustar a função `calcularValor()` em `src/routes/_authenticated/index.tsx` e os textos que mostram os valores nas abas Escala e Demandas.

### 2. Aviso de diarista bloqueado

- Investigar por que o `toast.error` não aparece ao tentar escalar bloqueado. Provavelmente o filtro do `<Select>` está escondendo bloqueados antes de chegar na validação — vou passar a **mostrar todos** no select (marcando "(Bloqueado)" no label) e deixar o toast aparecer no clique de "Adicionar".
- Garantir que o `<Toaster />` (sonner) está montado no `__root.tsx`.

### 3. Escalar vários diaristas de uma vez

- Trocar o `<Select>` de um único diarista por uma **lista com checkboxes** (busca por nome + selecionar vários) tanto em **Escala do dia** quanto em **Demandas**.
- Botão "Escalar selecionados (N)" insere todos numa única operação. Bloqueados no meio: pula, mostra toast `"Fulano está bloqueado"` por pessoa e escala o resto.

### 4. Escalar o mesmo diarista em dias diferentes na mesma demanda

- Hoje há restrição impedindo repetir diarista na mesma demanda. Vou permitir múltiplas escalas do mesmo diarista desde que a **data seja diferente** (a chave passa a ser diarista+data, não diarista+demanda).
- Na tela de Demandas, adicionar um seletor de intervalo (data início → data fim, opcional "só dias úteis / todos os dias / só domingos") que gera automaticamente uma escala por dia para os diaristas selecionados.
- Ajustar constraint no banco: remover `UNIQUE(diarista_id, demanda_id)` se existir; manter `UNIQUE(diarista_id, data)` para não duplicar no mesmo dia.

### 5. Aumentar limite de "hospedagem" (armazenamento de arquivos)

- Confirmar: você fala do **upload de fotos** das diaristas, certo? Hoje o limite é do bucket de Storage padrão (50 MB por arquivo). Vou:
  - Aumentar o limite por arquivo para **10 MB** por foto (suficiente para foto de câmera) — se preferir maior, me diz o número.
  - Adicionar compressão no cliente antes do upload (reduz para no máx. 1600px de largura) para não estourar cota.
- Se você quis dizer outra coisa por "hospedagem de pessoas nos arquivos", me corrige. quero dizer de poder cadastra mais diaristas

### 6. Tema vermelho, preto e branco

- Reescrever os tokens em `src/styles.css`:
  - `--background`: branco puro
  - `--foreground`: preto
  - `--primary`: vermelho vivo (`oklch(0.55 0.22 25)` ~ #D62828)
  - `--primary-foreground`: branco
  - `--card`, `--muted`: cinzas neutros
  - `--destructive`: vermelho mais escuro
  - Modo escuro: fundo preto, texto branco, primário vermelho
- Ajustar componentes onde ainda houver cor hardcoded para usar tokens.
- Cabeçalho ganha faixa vermelha com título em branco para reforçar identidade.

---

## Detalhes técnicos

- **Migração**: `ALTER TABLE escalas DROP CONSTRAINT IF EXISTS escalas_diarista_id_demanda_id_key;` + garantir `UNIQUE(diarista_id, data)`.
- **Multi-select**: componente `<Command>` do shadcn com checkboxes; estado local `selectedIds: Set<string>`.
- **Bulk insert**: um único `.insert([...])` no Supabase com filtro prévio de bloqueados.
- **Cores**: apenas `src/styles.css` — nada de classe `bg-red-500` solta em componente.

## Fora do escopo

- Login/autenticação (segue como está).
- Exportação PDF do financeiro (fica para depois se quiser).
- quero tbm adicionar uma tela de login mesmo sera permitido somente 5 logins o primeiro sera o adminstrador (eu) os outros serão quem vai fazer as escalar os "lider'    
**Confirma o ponto 5 (é upload de fotos, 10 MB por foto?) antes de eu implementar?**
- &nbsp;