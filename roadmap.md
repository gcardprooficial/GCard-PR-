# GCard-PRÓ — roadmap

## Concluído
- Banco de dados completo (produtos, planos, pacotes, pedidos, placas, financeiro, auditoria) com RLS e grants.
- Funções internas de papel movidas para espaço privado (fora da API pública).
- Imagens próprias: cena principal, cartão, plaquinha 10x10, plaquinha 10x15.
- Design novo: fundo branco, texto preto, detalhes em amarelo, animações leves.
- Página inicial enxuta com dois caminhos separados: Plano Lojista e Pack Renda Extra.
- Preços por faixa automática: lojista R$ 59,90 sem limite; revenda R$ 34,90 (1–9), R$ 24,90 (10–49), R$ 19,90 (50+). Clube Revenda VIP desativado.
- Busca do negócio pelo nome no Google (Places pelo servidor), com colar link como alternativa.
- Escolha do estilo (cartão / plaquinha de balcão) antes dos formulários; 10x15 em "L" marcada como "em breve".
- Compra guiada passo a passo com preço recalculado no servidor e pedido gravado como pendente.
- Redirecionamento `/r/{token}` com validação de host do Google e registro de leitura.

## Em aberto
- Pagamento Mercado Pago (Checkout Pro + webhook assinado + emissão idempotente de placas) — bloqueado: falta `MERCADOPAGO_ACCESS_TOKEN`.
- Trocar imagens e logo pelos mockups próprios quando você enviar.
- Painel administrativo: pedidos, financeiro 50/50, placas, leituras, auditoria.
- E-mails transacionais (confirmação e rastreio) — depende do domínio de envio.
- Páginas de termos, privacidade e grupo de WhatsApp (falta o link).
- Revisão de segurança final antes da divulgação.
