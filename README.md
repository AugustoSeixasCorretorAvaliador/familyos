This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## OCR de documentos

O modulo de documentos usa uma interface de provedores desacoplada:

- `OCR_PROVIDER=openai`: extracao visual e estruturada pela Responses API.
- `OCR_PROVIDER=google`: Google Vision legado, mantido como alternativa.
- `OCR_PROVIDER=manual`: salva o documento privado sem processamento automatico.
- Sem `OCR_PROVIDER`: usa OpenAI quando `OPENAI_API_KEY` existe; caso contrario, usa o modo manual.

O modelo pode ser definido por `OPENAI_OCR_MODEL`. O fallback central e `gpt-5-mini`,
compativel com imagens, PDF, Responses API e Structured Outputs. JPEG, PNG e WEBP usam
entrada visual; PDF usa a entrada oficial de arquivo em Base64. TIFF continua aceito no upload,
mas recebe uma mensagem operacional clara no OCR porque nao ha conversor seguro instalado.

Configuracoes opcionais:

```dotenv
OCR_MAX_RETRIES=3
OCR_TIMEOUT_MS=60000
OCR_MAX_FILE_SIZE_MB=20
OCR_CONFIDENCE_REVIEW_THRESHOLD=0.80
```

A confianca por campo e uma estimativa do modelo para orientar a revisao humana, nao uma
probabilidade estatistica garantida. O documento sempre permanece salvo quando o OCR falha.
As chamadas usam `store: false`; o historico local registra somente metadados operacionais,
sem chave, Base64, arquivo, texto integral ou resposta bruta. O conteudo do documento e enviado
ao provedor configurado exclusivamente pelo servidor e continua sujeito as politicas de dados
desse provedor.

Em termos qualitativos, `gpt-5-mini` tem custo baixo por processamento, mas o valor varia com
quantidade de paginas, resolucao visual e volume do texto retornado. Limites de tamanho,
timeout, tentativas controladas e processamento apenas no upload ou reprocessamento evitam
chamadas desnecessarias.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
