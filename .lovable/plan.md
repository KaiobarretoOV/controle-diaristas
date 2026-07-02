Plano para impedir que erros nas abas Escala e Demandas derrubem o site:

1. Reforçar o Error Boundary existente
- Manter um fallback amigável quando a aba falhar.
- Melhorar o reset do erro ao trocar/reabrir a aba.
- Remover a exibição de erro técnico cru para o usuário e deixar apenas mensagem simples.

2. Isolar Escala, Demandas e Escala em lote separadamente
- Envolver `EscalaTab` com boundary próprio.
- Envolver `DemandasTab` com boundary próprio.
- Envolver também o bloco `BulkEscalarDemanda`, porque ele fica dentro de Demandas e pode ser uma fonte separada de queda.

3. Adicionar proteção de runtime/try-catch nos pontos que não são capturados pelo Error Boundary
- Proteger cálculos e listas renderizadas com valores padrão seguros.
- Garantir que `diaristas`, `demandas` e `escalas` sempre sejam arrays antes de usar `.map`, `.filter`, `.reduce` ou `.find`.
- Tratar erros de carregamento, criação, exclusão e escala em lote com `toast.error`, sem deixar exceções subirem para a tela inteira.

4. Adicionar fallback visual por aba
- Se Escala falhar: mostrar um cartão dizendo que a aba foi protegida e botão “Tentar novamente”.
- Se Demandas falhar: mesmo comportamento, sem cair o restante do sistema.

5. Validar no preview
- Entrar no sistema com sessão disponível.
- Abrir Escala e Demandas várias vezes.
- Testar troca de abas repetida.
- Confirmar que, se alguma falha acontecer, apenas a aba mostra aviso e o site continua aberto.